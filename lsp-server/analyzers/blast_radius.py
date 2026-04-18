"""
blast_radius.py — Nexus-Sentinel Phase 1
=========================================
Classifies files as Producers or Consumers, maintains the dependency
graph in memory, and produces LSP Diagnostic payloads when a Producer
file changes.

READ-ONLY: This module never writes to or modifies any file.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from lsprotocol.types import (
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
)

from .import_extractor import ExtractionResult, ImportExtractor

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class FileRole:
    """The computed role of a single Python file in the workspace."""

    file_path: str

    # Symbols (functions / classes) this file defines → it is a Producer
    # Stored as just the names to keep existing logic working
    exported_symbols: list[str] = field(default_factory=list)
    
    # Store the actual bodies for AI smells
    symbol_bodies: dict[str, str] = field(default_factory=dict)

    # Modules this file imports from → it is a Consumer
    imported_modules: list[str] = field(default_factory=list)
    
    # Specific names this file imports
    imported_names: list[str] = field(default_factory=list)

    @property
    def is_producer(self) -> bool:
        return bool(self.exported_symbols)

    @property
    def is_consumer(self) -> bool:
        return bool(self.imported_modules)

    @property
    def role_label(self) -> str:
        if self.is_producer and self.is_consumer:
            return "Producer + Consumer"
        if self.is_producer:
            return "Producer"
        if self.is_consumer:
            return "Consumer"
        return "Inert"


@dataclass
class BlastRadiusReport:
    """The full Blast Radius for one changed Producer file."""

    changed_file: str
    # Map of consumer_file_path → list of LSP Diagnostics to push to it
    affected_consumers: dict[str, list[Diagnostic]] = field(default_factory=dict)

    @property
    def consumer_count(self) -> int:
        return len(self.affected_consumers)

    @property
    def is_empty(self) -> bool:
        return self.consumer_count == 0


# ---------------------------------------------------------------------------
# Workspace graph
# ---------------------------------------------------------------------------

class DependencyGraph:
    """
    In-memory map of the entire workspace's import relationships.

    Graph edges:  consumer_file  ──imports──►  producer_module

    Updated incrementally: when any file is opened / saved, its
    ExtractionResult is fed into update_file().
    """

    def __init__(self) -> None:
        # file_path → FileRole
        self._roles: dict[str, FileRole] = {}

        # module_stem → file_path  (e.g. "utils" → "/proj/utils.py")
        # Used to resolve which physical file a module name points to.
        self._module_index: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Mutation
    # ------------------------------------------------------------------

    def update_file(self, result: ExtractionResult) -> None:
        """
        Ingest an ExtractionResult and refresh the graph node for that file.
        """
        fpath = result.file_path

        imported_names = []
        for imp in result.imports:
            imported_names.extend(imp.names)

        role = FileRole(
            file_path=fpath,
            exported_symbols=list(result.defined_symbols.keys()),
            symbol_bodies=result.defined_symbols,
            imported_modules=[imp.module for imp in result.imports],
            imported_names=imported_names,
        )
        self._roles[fpath] = role

        # Keep the module index up-to-date so we can resolve imports to files
        stem = Path(fpath).stem
        self._module_index[stem] = fpath
        # Also index by full dotted path relative to longest common base
        # (best-effort; real resolution would require sys.path knowledge)
        self._module_index[self._dotted_path(fpath)] = fpath

    def remove_file(self, file_path: str) -> None:
        """Remove a file from the graph (e.g. on file deletion)."""
        self._roles.pop(file_path, None)
        # Remove stale module index entries
        stale_keys = [k for k, v in self._module_index.items() if v == file_path]
        for key in stale_keys:
            del self._module_index[key]

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_role(self, file_path: str) -> Optional[FileRole]:
        return self._roles.get(file_path)

    def all_roles(self) -> dict[str, FileRole]:
        return dict(self._roles)

    def consumers_of(self, producer_path: str) -> list[str]:
        """
        Return all file paths that import from *producer_path*.

        Resolution strategy (best-effort without a full Python resolver):
          1. Match on stem name  (e.g. "utils" matches "utils.py")
          2. Match on dotted path (e.g. "mypkg.utils" matches "mypkg/utils.py")
          3. Match on any suffix of the consumer's import string
        """
        producer_stem = Path(producer_path).stem
        producer_dotted = self._dotted_path(producer_path)

        consumers: list[str] = []
        for fpath, role in self._roles.items():
            if fpath == producer_path:
                continue
            for mod in role.imported_modules:
                # Check all three resolution strategies
                mod_leaf = mod.split(".")[-1]
                if (
                    mod == producer_stem
                    or mod == producer_dotted
                    or mod_leaf == producer_stem
                    or mod.endswith(f".{producer_stem}")
                ):
                    consumers.append(fpath)
                    break  # one match per file is enough

        return consumers

    def find_dead_code_in_workspace(self) -> list[dict]:
        """
        Scans all known files for defined symbols that are never imported 
        anywhere in the entire workspace.
        """
        all_imported_names = set()
        for role in self._roles.values():
            all_imported_names.update(role.imported_names)
            
        dead_code = []
        for fpath, role in self._roles.items():
            for symbol in role.exported_symbols:
                if symbol not in all_imported_names:
                    dead_code.append({
                        "file": fpath,
                        "symbol": symbol
                    })
        return dead_code

    def freshness_score(self, file_path: str) -> float:
        """
        Phase 1 stub — returns 100.0 until Phase 4 signature matching is wired.
        Formula (Phase 4): F = (matched_signatures / total_dependencies) * 100
        """
        return 100.0

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _dotted_path(file_path: str) -> str:
        """
        Convert an absolute path to a best-guess dotted module name.
        e.g.  /project/mypkg/utils.py  →  mypkg.utils
        """
        p = Path(file_path)
        # Walk up until we don't find an __init__.py
        parts: list[str] = [p.stem]
        current = p.parent
        while (current / "__init__.py").exists():
            parts.insert(0, current.name)
            current = current.parent
        return ".".join(parts)


# ---------------------------------------------------------------------------
# Blast Radius Calculator
# ---------------------------------------------------------------------------

class BlastRadiusCalculator:
    """
    Given a changed Producer file and the current DependencyGraph,
    produces a BlastRadiusReport containing LSP Diagnostics for every
    Consumer file that may be impacted.

    READ-ONLY: Only produces Diagnostic objects. No source file is touched.
    """

    # Severity used for Blast Radius warnings
    SEVERITY = DiagnosticSeverity.Warning

    # Diagnostic source tag shown in VS Code's Problems panel
    SOURCE_TAG = "Nexus-Sentinel"

    def __init__(self, graph: DependencyGraph) -> None:
        self._graph = graph

    def calculate(self, changed_file: str) -> BlastRadiusReport:
        """
        Calculate the Blast Radius of *changed_file* being saved.

        Returns a BlastRadiusReport containing one or more Diagnostic
        objects per affected consumer file.
        """
        report = BlastRadiusReport(changed_file=changed_file)
        consumers = self._graph.consumers_of(changed_file)

        if not consumers:
            logger.debug("No consumers found for %s — Blast Radius is zero.", changed_file)
            return report

        changed_role = self._graph.get_role(changed_file)
        symbol_list = (
            ", ".join(changed_role.exported_symbols[:5])
            if changed_role and changed_role.exported_symbols
            else "its public symbols"
        )
        if changed_role and len(changed_role.exported_symbols) > 5:
            symbol_list += f" (+{len(changed_role.exported_symbols) - 5} more)"

        producer_stem = Path(changed_file).stem

        for consumer_path in consumers:
            diag = self._build_diagnostic(
                consumer_path=consumer_path,
                producer_stem=producer_stem,
                symbol_list=symbol_list,
                consumer_count=len(consumers),
            )
            report.affected_consumers[consumer_path] = [diag]
            logger.info(
                "Blast Radius: %s → %s  [consumer affected]",
                producer_stem,
                Path(consumer_path).name,
            )

        return report

    # ------------------------------------------------------------------
    # Diagnostic builder
    # ------------------------------------------------------------------

    def _build_diagnostic(
        self,
        consumer_path: str,
        producer_stem: str,
        symbol_list: str,
        consumer_count: int,
    ) -> Diagnostic:
        """
        Build a single LSP Diagnostic for a consumer file.

        The diagnostic points at line 0 (the file's first line) because we
        don't yet track the exact import line in the consumer — that
        refinement lands in Phase 4.
        """
        message = (
            f"[Nexus-Sentinel] Blast Radius Warning ⚡\n"
            f"Producer `{producer_stem}` was modified. "
            f"This file imports [{symbol_list}] from it.\n"
            f"Total affected consumers in workspace: {consumer_count}. "
            f"Verify the contract has not broken."
        )

        return Diagnostic(
            range=Range(
                start=Position(line=0, character=0),
                end=Position(line=0, character=100),
            ),
            message=message,
            severity=self.SEVERITY,
            source=self.SOURCE_TAG,
            code="NST-001",
        )

    def _find_import_line(self, consumer_path: str, producer_stem: str) -> int:
        """
        Scan the consumer file to find the exact line of the import.
        Returns 0 if not found (safe fallback).

        NOTE: Pure read — opens file in read mode only.
        """
        try:
            with open(consumer_path, "r", encoding="utf-8", errors="replace") as f:
                for lineno, line in enumerate(f, start=0):
                    if producer_stem in line and (
                        line.strip().startswith("import")
                        or line.strip().startswith("from")
                    ):
                        return lineno
        except OSError:
            pass
        return 0


# ---------------------------------------------------------------------------
# Convenience factory
# ---------------------------------------------------------------------------

def make_engine() -> tuple[DependencyGraph, ImportExtractor, BlastRadiusCalculator]:
    """
    Instantiate and wire together the three core objects.
    Returns (graph, extractor, calculator) ready for use by server.py.
    """
    graph = DependencyGraph()
    extractor = ImportExtractor()
    calculator = BlastRadiusCalculator(graph)
    return graph, extractor, calculator
