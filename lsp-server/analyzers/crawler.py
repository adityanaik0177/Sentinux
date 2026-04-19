"""
crawler.py — Nexus-Sentinel Phase 4
=====================================
Workspace-level Python file crawler.

Walks all .py files under a root directory, builds a full dependency
map using ImportExtractor, and calculates the Freshness (F) Score for
each file using signature matching.

F-Score formula:
    F = (matched_signatures / total_dependencies) * 100

Where:
    - total_dependencies  = number of imported names this file uses
    - matched_signatures  = number of those names that still exist in
                            the producer files' defined_symbols list

READ-ONLY: This module never writes to or modifies any user source file.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

from .import_extractor import ImportExtractor, ExtractionResult
from .blast_radius import DependencyGraph, BlastRadiusCalculator

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class NodeData:
    """A single node in the workspace dependency graph (for reactflow)."""
    id: str           # file path (unique)
    label: str        # filename e.g. "utils.py"
    role: str         # "Producer" | "Consumer" | "Producer + Consumer" | "Inert"
    symbols: list[str] = field(default_factory=list)
    freshness_score: float = 100.0
    import_count: int = 0
    consumer_count: int = 0


@dataclass
class EdgeData:
    """A directed edge from consumer → producer (for reactflow)."""
    id: str           # e.g. "consumer.py->producer.py"
    source: str       # consumer file path
    target: str       # producer file path
    label: str        # e.g. "imports utils"


@dataclass
class WorkspaceGraph:
    """The full dependency graph of a workspace."""
    root: str
    nodes: list[NodeData] = field(default_factory=list)
    edges: list[EdgeData] = field(default_factory=list)
    total_files: int = 0
    avg_freshness: float = 100.0
    error_files: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "root": self.root,
            "nodes": [asdict(n) for n in self.nodes],
            "edges": [asdict(e) for e in self.edges],
            "total_files": self.total_files,
            "avg_freshness": self.avg_freshness,
            "error_files": self.error_files,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    def __len__(self) -> int:
        """Return the number of nodes (files) in the graph."""
        return len(self.nodes)

    def __iter__(self):
        """Iterate over nodes."""
        return iter(self.nodes)


# ---------------------------------------------------------------------------
# Freshness Score Calculator
# ---------------------------------------------------------------------------

class FreshnessCalculator:
    """
    Calculates the Freshness (F) Score for a file by comparing the
    names it imports with the symbols actually exported by the producer.

    F = (matched_signatures / total_dependencies) * 100

    A score of 100.0 means every imported name still exists in the
    producer — contract intact. A lower score indicates drift.

    READ-ONLY: Never touches any file.
    """

    def __init__(self, graph: DependencyGraph) -> None:
        self._graph = graph

    def score_for(self, file_path: str, extraction: ExtractionResult) -> float:
        """
        Calculate F-Score for *file_path* given its extraction result.

        Only `from X import a, b` statements contribute — bare `import X`
        does not specify named symbols, so cannot be signature-checked.
        """
        from_imports = [i for i in extraction.imports if i.is_from_import and i.names]
        if not from_imports:
            return 100.0  # no named dependencies → no drift possible

        total_deps = 0
        matched = 0

        all_roles = self._graph.all_roles()

        for imp in from_imports:
            mod_stem = imp.module.split(".")[-1]

            # Find the producer file for this module
            producer_role = None
            for fpath, role in all_roles.items():
                if Path(fpath).stem == mod_stem or fpath.endswith(f"/{mod_stem}.py") or fpath.endswith(f"\\{mod_stem}.py"):
                    producer_role = role
                    break

            if producer_role is None:
                # External / stdlib module — count names but assume all matched
                total_deps += len(imp.names)
                matched += len(imp.names)
                continue

            producer_symbols = set(producer_role.exported_symbols)

            for name in imp.names:
                total_deps += 1
                if name in producer_symbols:
                    matched += 1
                else:
                    # Only warn if the producer has exports at all
                    # (avoids noise for __init__.py-style re-export files)
                    if producer_symbols:
                        logger.debug(
                            "F-Score miss: '%s' not found in %s (imported by %s)",
                            name,
                            mod_stem,
                            Path(file_path).name,
                        )

        if total_deps == 0:
            return 100.0

        return round((matched / total_deps) * 100, 2)


# ---------------------------------------------------------------------------
# Workspace Crawler
# ---------------------------------------------------------------------------

class WorkspaceCrawler:
    """
    Walks all .py files under *root_path* and builds a WorkspaceGraph.

    Usage:
        crawler = WorkspaceCrawler("/path/to/project")
        ws_graph = crawler.crawl()
        print(ws_graph.to_json())

    READ-ONLY: Never writes to any file.
    """

    # Directories to skip
    SKIP_DIRS = {
        ".venv", "venv", "env", ".env",
        "__pycache__", ".git", ".mypy_cache",
        ".pytest_cache", "node_modules", "dist", "build",
        ".tox", "eggs", "*.egg-info",
    }

    def __init__(self, root_path: str) -> None:
        self.root = Path(root_path).resolve()
        self._extractor = ImportExtractor()
        self._graph = DependencyGraph()
        self._calculator = BlastRadiusCalculator(self._graph)
        self._freshness = FreshnessCalculator(self._graph)
        self._extractions: dict[str, ExtractionResult] = {}

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def crawl(self) -> WorkspaceGraph:
        """
        Two-pass crawl:
          Pass 1 — Extract all files and build the dependency graph
          Pass 2 — Calculate F-Scores, consumer counts, and build edges
        """
        ws = WorkspaceGraph(root=str(self.root))
        py_files = self._collect_python_files()
        ws.total_files = len(py_files)
        logger.info("Crawling %d Python files under %s", ws.total_files, self.root)

        # ── Pass 1: extract + index ──────────────────────────────────
        for fpath in py_files:
            result = self._extractor.extract_from_file(str(fpath))
            if result.parse_error:
                ws.error_files.append(str(fpath))
                logger.warning("Parse error in %s: %s", fpath.name, result.parse_error)
                continue
            self._graph.update_file(result)
            self._extractions[str(fpath)] = result

        # ── Pass 2: build graph output ────────────────────────────────
        total_freshness = 0.0
        scored_count = 0
        seen_edges: set[str] = set()

        for fpath_str, result in self._extractions.items():
            fpath = Path(fpath_str)
            role = self._graph.get_role(fpath_str)
            if role is None:
                continue

            f_score = self._freshness.score_for(fpath_str, result)
            consumers = self._graph.consumers_of(fpath_str)

            node = NodeData(
                id=fpath_str,
                label=fpath.name,
                role=role.role_label,
                symbols=role.exported_symbols,
                freshness_score=f_score,
                import_count=len(result.imports),
                consumer_count=len(consumers),
            )
            ws.nodes.append(node)
            total_freshness += f_score
            scored_count += 1

            # Build edges: this file → files it imports from
            for imp in result.imports:
                mod_stem = imp.module.split(".")[-1]
                for other_path in self._extractions:
                    other_stem = Path(other_path).stem
                    if mod_stem == other_stem and other_path != fpath_str:
                        edge_id = f"{fpath_str}->{other_path}"
                        if edge_id not in seen_edges:
                            seen_edges.add(edge_id)
                            ws.edges.append(EdgeData(
                                id=edge_id,
                                source=fpath_str,
                                target=other_path,
                                label=f"imports {imp.module}",
                            ))
                        break

        ws.avg_freshness = round(total_freshness / scored_count, 2) if scored_count > 0 else 100.0
        logger.info(
            "Crawl complete. Nodes: %d, Edges: %d, Avg F-Score: %.1f%%",
            len(ws.nodes), len(ws.edges), ws.avg_freshness,
        )
        return ws

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    def _collect_python_files(self) -> list[Path]:
        """Recursively collect all .py files, honouring SKIP_DIRS."""
        files: list[Path] = []
        for path in self.root.rglob("*.py"):
            # Skip if any parent directory matches skip list
            if any(part in self.SKIP_DIRS for part in path.parts):
                continue
            files.append(path)
        return sorted(files)


# ---------------------------------------------------------------------------
# CLI entry point (for manual testing)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    crawler = WorkspaceCrawler(root)
    ws_graph = crawler.crawl()
    print(ws_graph.to_json())
