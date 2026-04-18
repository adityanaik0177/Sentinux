"""
server.py — Nexus-Sentinel Phase 1
====================================
The pygls Language Server Protocol brain.

Lifecycle:
  1. On startup, indexes every .py file already open in the workspace.
  2. On textDocument/didOpen  → indexes the file into the dependency graph.
  3. On textDocument/didChange → updates the in-memory graph (no disk I/O).
  4. On textDocument/didSave   → recalculates Blast Radius and pushes
                                  Diagnostic Warnings to every Consumer file.
  5. On textDocument/didClose  → clears diagnostics for that file.

READ-ONLY GUARANTEE:
  This server NEVER writes to, patches, or modifies any user source file.
  All output is LSP diagnostic payloads sent via JSON-RPC over stdio.
"""

from __future__ import annotations

import logging
import sys
import threading
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlparse

# ── pygls ────────────────────────────────────────────────────────────────────
from pygls.server import LanguageServer
from pygls.protocol import LanguageServerProtocol
from lsprotocol.types import (
    # Capabilities
    InitializeParams,
    ServerCapabilities,
    TextDocumentSyncKind,
    # Notification params
    DidOpenTextDocumentParams,
    DidChangeTextDocumentParams,
    DidSaveTextDocumentParams,
    DidCloseTextDocumentParams,
    # Diagnostics
    PublishDiagnosticsParams,
    Diagnostic,
    # Methods
    TEXT_DOCUMENT_DID_OPEN,
    TEXT_DOCUMENT_DID_CHANGE,
    TEXT_DOCUMENT_DID_SAVE,
    TEXT_DOCUMENT_DID_CLOSE,
)

# ── Internal modules ─────────────────────────────────────────────────────────
from analyzers.blast_radius import make_engine, BlastRadiusReport
from analyzers.import_extractor import ExtractionResult
from analyzers.crawler import WorkspaceCrawler, FreshnessCalculator
from analyzers.gemini_service import GeminiService

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    stream=sys.stderr,  # stderr so it doesn't pollute the JSON-RPC stdout pipe
)
logger = logging.getLogger("nexus-sentinel.server")

# ---------------------------------------------------------------------------
# Server instance
# ---------------------------------------------------------------------------
server = LanguageServer(
    name="nexus-sentinel",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# Core engine (wired at import time; shared across all handlers)
# ---------------------------------------------------------------------------
graph, extractor, calculator = make_engine()
freshness_calc = FreshnessCalculator(graph)
gemini = GeminiService()

# In-memory storage for discovered duplicate smells
# Format: list of dicts with keys: file_path, function_name, duplicates (list), suggestion (str)
duplicate_smells = []
ai_dead_code_cache = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def uri_to_path(uri: str) -> str:
    """Convert a file:// URI to an OS file-system path string."""
    parsed = urlparse(uri)
    # On Windows, urlparse gives a leading '/' before 'C:' — strip it
    path = unquote(parsed.path)
    if sys.platform == "win32" and path.startswith("/"):
        path = path[1:]
    return path


def index_document(uri: str, source: str) -> ExtractionResult:
    """Parse *source*, update the graph, return the ExtractionResult."""
    file_path = uri_to_path(uri)
    result = extractor.extract_from_source(source, file_path)
    graph.update_file(result)
    logger.debug(
        "Indexed %s → %d imports, %d defined symbols",
        Path(file_path).name,
        len(result.imports),
        len(result.defined_symbols),
    )
    return result


def push_blast_radius_diagnostics(uri: str) -> None:
    """
    Recalculate the Blast Radius for the saved file and push Diagnostics
    to every Consumer that imports from it.

    Any Consumer that is no longer affected has its diagnostics cleared.
    """
    file_path = uri_to_path(uri)
    role = graph.get_role(file_path)

    if role is None:
        logger.warning("push_blast_radius: %s not in graph — skipping.", file_path)
        return

    if not role.is_producer:
        logger.debug(
            "%s is not a Producer (no defined symbols) — no Blast Radius.",
            Path(file_path).name,
        )
        return

    report: BlastRadiusReport = calculator.calculate(file_path)

    if report.is_empty:
        logger.info(
            "%s is a Producer but has zero consumers — Blast Radius = 0.",
            Path(file_path).name,
        )
        return

    logger.info(
        "⚡ Blast Radius for %s: %d consumer(s) affected.",
        Path(file_path).name,
        report.consumer_count,
    )

    # Push diagnostic payloads to each affected consumer
    for consumer_path, diagnostics in report.affected_consumers.items():
        consumer_uri = Path(consumer_path).as_uri()
        server.publish_diagnostics(
            uri=consumer_uri,
            diagnostics=diagnostics,
        )
        logger.debug("  → Published %d diagnostic(s) to %s", len(diagnostics), consumer_path)


def clear_diagnostics(uri: str) -> None:
    """Clear all Nexus-Sentinel diagnostics for the given file URI."""
    server.publish_diagnostics(uri=uri, diagnostics=[])


# ---------------------------------------------------------------------------
# LSP Lifecycle
# ---------------------------------------------------------------------------

@server.feature("initialize")
def on_initialize(ls: LanguageServer, params: InitializeParams) -> None:
    """
    Called once when the client handshakes with this server.
    Pre-indexes all .py files in the workspace root so the graph is
    populated before the user opens a single file.
    """
    logger.info("Nexus-Sentinel LSP Brain initialised.")
    root = params.root_uri or ""
    logger.info("Root URI: %s", root)

    if root:
        root_path = uri_to_path(root)
        try:
            crawler = WorkspaceCrawler(root_path)
            ws_graph = crawler.crawl()
            # Absorb all crawled extractions into our live graph
            for node in ws_graph.nodes:
                fpath = node.id
                result = extractor.extract_from_file(fpath)
                graph.update_file(result)
            logger.info(
                "Startup crawl complete: %d files indexed, avg F-Score=%.1f%%",
                ws_graph.total_files,
                ws_graph.avg_freshness,
            )
            
            # Seed Dead Code AI suggestions in a background daemon
            def _warmup_dead_code_ai():
                logger.info("Warming up Dead Code AI cache from Gemini using BULK generation...")
                bulk_funcs = {}
                for dc in graph.find_dead_code_in_workspace():
                    fpath = dc["file"]
                    fname = dc["symbol"]
                    ckey = f"{fpath}::{fname}"
                    if ckey not in ai_dead_code_cache:
                        dc_role = graph.get_role(fpath)
                        if dc_role and fname in dc_role.symbol_bodies:
                            bulk_funcs[ckey] = { "name": fname, "code": dc_role.symbol_bodies[fname] }
                
                if bulk_funcs:
                    logger.info(f"Sending bulk AI prompt for {len(bulk_funcs)} dead code items...")
                    results = gemini.generate_bulk_dead_code_suggestions(bulk_funcs)
                    for ckey, sugg in results.items():
                        ai_dead_code_cache[ckey] = sugg
                    logger.info("Bulk generation complete.")
                    
            threading.Thread(target=_warmup_dead_code_ai, daemon=True).start()

        except Exception as exc:
            logger.warning("Startup crawl failed: %s", exc)


# ---------------------------------------------------------------------------
# Text Document Sync Handlers
# ---------------------------------------------------------------------------

@server.feature(TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: LanguageServer, params: DidOpenTextDocumentParams) -> None:
    """Index the file as soon as it is opened in any editor tab."""
    doc = params.text_document
    if not doc.uri.endswith(".py"):
        return
    index_document(doc.uri, doc.text)
    logger.info("didOpen: indexed %s", doc.uri)


@server.feature(TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: LanguageServer, params: DidChangeTextDocumentParams) -> None:
    """
    Update the in-memory graph on every keystroke (incremental or full sync).
    We do NOT push diagnostics here — only on didSave — to avoid flooding
    the Problems panel while the user is mid-edit.
    """
    doc = params.text_document
    if not doc.uri.endswith(".py"):
        return

    # We receive full content changes (TextDocumentSyncKind.Full)
    changes = params.content_changes
    if not changes:
        return

    latest_source = changes[-1].text
    index_document(doc.uri, latest_source)
    logger.debug("didChange: graph updated for %s", doc.uri)


@server.feature(TEXT_DOCUMENT_DID_SAVE)
def did_save(ls: LanguageServer, params: DidSaveTextDocumentParams) -> None:
    """
    The critical handler.

    On save:
    1. Re-index the saved file from disk (the source-of-truth after save).
    2. If it is a Producer, calculate Blast Radius and push Diagnostics
       to all Consumer files currently in the dependency graph.
    """
    doc = params.text_document
    if not doc.uri.endswith(".py"):
        return

    file_path = uri_to_path(doc.uri)

    # Re-read from disk (the save has already landed)
    try:
        fresh_source = Path(file_path).read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.error("didSave: cannot read %s — %s", file_path, exc)
        return

    index_document(doc.uri, fresh_source)
    logger.info("didSave: %s re-indexed from disk.", Path(file_path).name)

    # Push blast radius instantly (computationally very fast)
    push_blast_radius_diagnostics(doc.uri)

    # ── Phase 5: Batched ML pipeline ──────────────────────────────────────
    def _run_ml_diagnostics():
        role = graph.get_role(file_path)
        if not role or not role.symbol_bodies:
            return

        bodies = role.symbol_bodies          # { func_name: code }
        names  = list(bodies.keys())
        codes  = list(bodies.values())

        logger.info(
            f"ML pipeline: {len(names)} function(s) in {Path(file_path).name}"
        )

        # ── Step 1: ONE batch embedding call for all functions ─────────────
        embeddings = gemini.generate_batch_embeddings(codes)   # single API call
        logger.info("Step 1 done: batch embeddings received.")

        # ── Step 2: Upsert all embeddings + run duplicate queries in parallel
        items_for_dup = []
        for func_name, code, emb in zip(names, codes, embeddings):
            if emb is None:
                continue
            gemini.upsert_function_embedding(file_path, func_name, code, emb)
            items_for_dup.append((file_path, func_name, emb))

        # Parallel Supabase queries (one thread per function, capped at MAX_WORKERS)
        dup_results = gemini.find_duplicates_batch(items_for_dup)
        logger.info(f"Step 2 done: {len(dup_results)} duplicate results.")

        # ── Step 3: Collect ALL (func, best_dup) pairs that need refactoring ─
        pairs_for_ai: dict = {}   # { f"{func_name}" -> (my_code, dup_code) }
        pending_smells = []       # hold smell dicts until AI fills suggestions

        dead_set = {
            f"{dc['file']}::{dc['symbol']}"
            for dc in graph.find_dead_code_in_workspace()
        }

        for func_name, code in zip(names, codes):
            ckey = f"{file_path}::{func_name}"

            # Dead code AI suggestion (collected for bulk call)
            if ckey in dead_set and ckey not in ai_dead_code_cache:
                ai_dead_code_cache[ckey] = "__pending__"   # placeholder

            # Duplicate suggestion
            real_dupes = dup_results.get(ckey, [])
            if real_dupes:
                best = real_dupes[0]
                pairs_for_ai[func_name] = (code, best.get('content', ''))
                pending_smells.append({
                    "type": "duplicate",
                    "file": file_path,
                    "function_name": func_name,
                    "duplicates": real_dupes,
                    "suggestion": "__pending__",   # filled below
                    "_key": func_name,
                })

        # ── Step 4: ONE bulk Gemini call for all refactoring suggestions ──
        if pairs_for_ai:
            logger.info(f"Step 3: bulk refactoring for {len(pairs_for_ai)} pair(s)...")
            sugg_map = gemini.generate_bulk_refactoring_suggestions(pairs_for_ai)
            logger.info("Step 3 done: refactoring suggestions received.")
        else:
            sugg_map = {}

        # ── Step 4b: ONE bulk Gemini call for pending dead code ───────────
        pending_dead = {
            ckey: {"name": ckey.split("::")[-1], "code": bodies.get(ckey.split("::")[-1], "")}
            for ckey in list(ai_dead_code_cache)
            if ai_dead_code_cache[ckey] == "__pending__"
            and ckey.startswith(file_path)
        }
        if pending_dead:
            logger.info(f"Step 4: bulk dead code AI for {len(pending_dead)} symbol(s)...")
            dead_sugg_map = gemini.generate_bulk_dead_code_suggestions(pending_dead)
            ai_dead_code_cache.update(dead_sugg_map)
            logger.info("Step 4 done: dead code suggestions received.")

        # ── Commit results to duplicate_smells list ───────────────────────
        for smell in pending_smells:
            key = smell.pop("_key")
            smell["suggestion"] = sugg_map.get(
                key,
                "Refactor: Extract common logic into a shared utility method."
            )
            existing = next(
                (i for i, s in enumerate(duplicate_smells)
                 if s["file"] == file_path and s["function_name"] == smell["function_name"]),
                -1
            )
            if existing >= 0:
                duplicate_smells[existing] = smell
            else:
                duplicate_smells.append(smell)

        logger.info(f"ML pipeline complete for {Path(file_path).name}.")

    threading.Thread(target=_run_ml_diagnostics, daemon=True).start()


@server.feature(TEXT_DOCUMENT_DID_CLOSE)
def did_close(ls: LanguageServer, params: DidCloseTextDocumentParams) -> None:
    """Clear diagnostics when a file's tab is closed."""
    doc = params.text_document
    clear_diagnostics(doc.uri)
    logger.debug("didClose: cleared diagnostics for %s", doc.uri)


# ---------------------------------------------------------------------------
# Custom Nexus-Sentinel Extensions (non-standard LSP methods)
# ---------------------------------------------------------------------------

@server.command("nexusSentinel/getBlastRadiusReport")
def cmd_get_blast_radius(ls: LanguageServer, args: list) -> dict:
    """
    Custom command: return a JSON-serialisable Blast Radius report for
    the given file URI.  Called by the VS Code extension's Webview sidebar.

    args[0]: file URI string
    """
    if not args:
        return {"error": "No URI provided"}

    uri: str = args[0]
    file_path = uri_to_path(uri)
    role = graph.get_role(file_path)

    if role is None:
        return {
            "uri": uri,
            "role": "unknown",
            "consumer_count": 0,
            "consumers": [],
            "freshness_score": 100,
        }

    report = calculator.calculate(file_path) if role.is_producer else BlastRadiusReport(changed_file=file_path)

    # Build consumer list with their own freshness scores
    consumers_info = []
    for consumer_path in report.affected_consumers:
        consumer_role = graph.get_role(consumer_path)
        consumer_result = extractor.extract_from_file(consumer_path)
        c_score = freshness_calc.score_for(consumer_path, consumer_result)
        consumers_info.append({
            "path": consumer_path,
            "name": Path(consumer_path).name,
            "role": consumer_role.role_label if consumer_role else "unknown",
            "freshness_score": c_score,
        })

    # Calculate freshness score for the requested file itself
    file_result = extractor.extract_from_file(file_path)
    f_score = freshness_calc.score_for(file_path, file_result)

    # Build affected_consumers dict in the format the webview expects:
    # { consumer_path: [ {message, code, source} ] }
    affected_consumers_dict = {}
    for consumer_path, diagnostics in report.affected_consumers.items():
        affected_consumers_dict[consumer_path] = [
            {
                "message": d.message,
                "code": d.code,
                "source": d.source,
            }
            for d in diagnostics
        ]

    return {
        "uri": uri,
        "file": Path(file_path).name,
        "role": role.role_label,
        "exported_symbols": role.exported_symbols,
        "imported_modules": role.imported_modules,
        "consumer_count": report.consumer_count,
        "consumers": consumers_info,
        "affected_consumers": affected_consumers_dict,
        "freshness_score": f_score,
    }


@server.command("nexusSentinel/getWorkspaceGraph")
def cmd_get_workspace_graph(ls: LanguageServer, args: list) -> dict:
    """
    Return the full dependency graph as a JSON-serialisable dict.
    Used by Phase 4 to render the reactflow visualization.
    Schema-style: each node exposes its symbol list; each edge carries
    the exact imported symbol names so the UI can draw column→column lines.
    """
    nodes = []
    edges = []
    edge_id = 0

    all_roles = graph.all_roles()

    # Build a stem→path lookup for fast resolution
    stem_to_path: dict[str, str] = {}
    for fpath in all_roles:
        stem_to_path[Path(fpath).stem] = fpath

    for fpath, role in all_roles.items():
        nodes.append({
            "id": fpath,
            "label": Path(fpath).name,
            "role": role.role_label,
            "symbols": role.exported_symbols,          # defined symbols (output side)
            "imports": role.imported_names,            # names this file pulls in (input side)
            "imported_modules": role.imported_modules,
        })

    for fpath, role in all_roles.items():
        for mod in role.imported_modules:
            # Resolve module name → physical file
            target_path: str | None = None
            # Try full dotted tail first (e.g. "orders.checkout" → "checkout")
            for part in reversed(mod.split(".")):
                if part in stem_to_path:
                    target_path = stem_to_path[part]
                    break

            if not target_path or target_path == fpath:
                continue

            target_role = all_roles.get(target_path)
            # Which symbols are actually imported from this module?
            imported_here = [
                n for n in role.imported_names
                if target_role and n in target_role.exported_symbols
            ]

            edges.append({
                "id": f"e{edge_id}",
                "source": fpath,
                "target": target_path,
                "module": mod,
                "imported_symbols": imported_here,   # the actual column links
            })
            edge_id += 1

    return {"nodes": nodes, "edges": edges}


@server.command("nexusSentinel/getHealthSmells")
def cmd_get_health_smells(ls: LanguageServer, args: list) -> dict:
    """
    Return all known Health Smells for the workspace.
    Includes: Dead Code, Duplicate Code.
    """
    dead_code_raw = graph.find_dead_code_in_workspace()
    
    # Format dead code — use AI cache if ready, smart static fallback otherwise
    dead_code_smells = []
    for dc in dead_code_raw:
        ckey = f"{dc['file']}::{dc['symbol']}"
        cached = ai_dead_code_cache.get(ckey, "")
        # Skip stale placeholder strings
        if not cached or cached == "__pending__":
            cached = GeminiService._smart_dead_code_fallback(dc["symbol"])
        dead_code_smells.append({
            "type": "dead_code",
            "file": dc["file"],
            "function_name": dc["symbol"],
            "suggestion": cached,
        })
        
    return {
        "dead_code": dead_code_smells,
        "duplicates": duplicate_smells
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logger.info("Starting Nexus-Sentinel LSP Brain over stdio...")
    # stdio transport — VS Code's LanguageClient connects via stdin/stdout
    server.start_io()
