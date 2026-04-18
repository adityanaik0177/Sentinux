"""
import_extractor.py — Nexus-Sentinel Phase 1
============================================
Uses tree-sitter 0.25.x to walk a Python file's AST and extract every
import statement into a structured list.

tree-sitter 0.25.x API notes:
  - Language(tspython.language())  builds the Language object
  - Parser(language)               builds a parser
  - Query(language, pattern)       compiles a query (does NOT run it)
  - QueryCursor(query)             wraps the query for execution
  - QueryCursor.captures(node)     runs the query; returns dict[str, list[Node]]

READ-ONLY: This module never writes to or modifies any file.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import tree_sitter_python as tspython
from tree_sitter import Language, Parser, Node, Query, QueryCursor

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bootstrap: language + parser (module-level singletons)
# ---------------------------------------------------------------------------
PY_LANGUAGE: Language = Language(tspython.language())
_PARSER: Parser = Parser(PY_LANGUAGE)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ImportStatement:
    """Represents a single import found in a Python file."""

    # Source file that contains this import
    source_file: str

    # The raw module path being imported  (e.g. "os.path", "mypackage.utils")
    module: str

    # Specific names imported via `from X import a, b` — empty for bare `import X`
    names: list[str] = field(default_factory=list)

    # True  -> `from module import name`
    # False -> `import module`
    is_from_import: bool = False

    # 1-based line number in the source file
    line: int = 0

    def __repr__(self) -> str:
        if self.is_from_import:
            names_str = ", ".join(self.names) if self.names else "*"
            return f"from {self.module} import {names_str}  (line {self.line})"
        return f"import {self.module}  (line {self.line})"


@dataclass
class ExtractionResult:
    """Full extraction result for one file."""

    file_path: str
    imports: list[ImportStatement] = field(default_factory=list)
    # Top-level symbols defined in this file (functions + classes)
    # The dictionary maps symbol_name -> symbol_body_text
    defined_symbols: dict[str, str] = field(default_factory=dict)
    parse_error: Optional[str] = None


# ---------------------------------------------------------------------------
# Query patterns (S-expressions)
# ---------------------------------------------------------------------------

# Matches:  import os
#           import os, sys
#           import os.path
_IMPORT_PATTERN = """
(import_statement
  name: (dotted_name) @module_name)

(import_statement
  name: (aliased_import
    name: (dotted_name) @module_name))
"""

# Matches:  from os import path
#           from mypkg.utils import helper, Config
#           from . import sibling
_FROM_IMPORT_PATTERN = """
(import_from_statement
  module_name: (_) @mod
  name: (_) @imported_name)
"""

# Matches function and class definitions (Producers)
_DEFINITIONS_PATTERN = """
(function_definition name: (identifier) @func_name) @func_body
(class_definition    name: (identifier) @class_name) @class_body
"""


# ---------------------------------------------------------------------------
# Core extractor
# ---------------------------------------------------------------------------

class ImportExtractor:
    """
    Parses a single Python file with tree-sitter 0.25.x and returns an
    ExtractionResult containing all imports and all symbol definitions.

    Stateless between calls.
    """

    def __init__(self) -> None:
        # Compile queries once — QueryCursor is created per call to avoid
        # thread-safety concerns with shared cursor state
        self._q_bare = Query(PY_LANGUAGE, _IMPORT_PATTERN)
        self._q_from = Query(PY_LANGUAGE, _FROM_IMPORT_PATTERN)
        self._q_defs = Query(PY_LANGUAGE, _DEFINITIONS_PATTERN)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract_from_source(self, source: str, file_path: str) -> ExtractionResult:
        """
        Parse *source* (Python source code) and return an ExtractionResult.
        *file_path* is stored for context only — never read or written here.
        """
        result = ExtractionResult(file_path=file_path)

        try:
            tree = _PARSER.parse(source.encode("utf-8"))
            root = tree.root_node

            result.imports += self._extract_bare_imports(root, file_path)
            result.imports += self._extract_from_imports(root, file_path)
            result.defined_symbols = self._extract_definitions(root)

        except Exception as exc:
            logger.exception("tree-sitter parse error in %s", file_path)
            result.parse_error = str(exc)

        return result

    def extract_from_file(self, file_path: str) -> ExtractionResult:
        """
        Read *file_path* and call extract_from_source.
        Never raises — errors stored in result.parse_error.
        """
        try:
            src = Path(file_path).read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            return ExtractionResult(
                file_path=file_path,
                parse_error=f"Could not read file: {exc}",
            )
        return self.extract_from_source(src, file_path)

    # ------------------------------------------------------------------
    # Private helpers — all use QueryCursor.captures(root) -> dict[str, list[Node]]
    # ------------------------------------------------------------------

    def _captures(self, query: Query, root: Node) -> dict[str, list[Node]]:
        """Run *query* against *root* using a fresh QueryCursor."""
        cursor = QueryCursor(query)
        return cursor.captures(root)  # type: ignore[return-value]

    def _extract_bare_imports(
        self, root: Node, file_path: str
    ) -> list[ImportStatement]:
        """Handle `import X` and `import X as Y` forms."""
        stmts: list[ImportStatement] = []
        caps = self._captures(self._q_bare, root)

        for node in caps.get("module_name", []):
            module_name = node.text.decode("utf-8") if node.text else ""
            if not module_name:
                continue
            stmts.append(
                ImportStatement(
                    source_file=file_path,
                    module=module_name,
                    names=[],
                    is_from_import=False,
                    line=node.start_point[0] + 1,
                )
            )
        return stmts

    def _extract_from_imports(
        self, root: Node, file_path: str
    ) -> list[ImportStatement]:
        """
        Handle `from X import a, b` forms.

        Module nodes and imported-name nodes are captured separately.
        We aggregate them back into one ImportStatement per line.
        """
        aggregated: dict[int, ImportStatement] = {}
        caps = self._captures(self._q_from, root)

        # Step 1: index modules by start line
        for node in caps.get("mod", []):
            text = node.text.decode("utf-8") if node.text else ""
            line = node.start_point[0] + 1
            if line not in aggregated:
                aggregated[line] = ImportStatement(
                    source_file=file_path,
                    module=text,
                    names=[],
                    is_from_import=True,
                    line=line,
                )

        # Step 2: attach imported names to their parent statement by line
        for node in caps.get("imported_name", []):
            text = node.text.decode("utf-8") if node.text else ""
            parent = node.parent
            if parent is None:
                continue
            stmt_line = parent.start_point[0] + 1
            if stmt_line in aggregated:
                aggregated[stmt_line].names.append(text)
            else:
                aggregated[stmt_line] = ImportStatement(
                    source_file=file_path,
                    module="<unknown>",
                    names=[text],
                    is_from_import=True,
                    line=stmt_line,
                )

        return list(aggregated.values())

    def _extract_definitions(self, root: Node) -> dict[str, str]:
        """Return a mapping of function/class names -> their full source code body."""
        caps = self._captures(self._q_defs, root)
        
        # We need to map the name node to its corresponding body node.
        # tree-sitter captures them in pairs if they are part of the same match.
        symbols: dict[str, str] = {}
        
        func_names = caps.get("func_name", [])
        func_bodies = caps.get("func_body", [])
        for name_node, body_node in zip(func_names, func_bodies):
            if name_node.text and body_node.text:
                name_str = name_node.text.decode("utf-8")
                body_str = body_node.text.decode("utf-8")
                symbols[name_str] = body_str

        class_names = caps.get("class_name", [])
        class_bodies = caps.get("class_body", [])
        for name_node, body_node in zip(class_names, class_bodies):
            if name_node.text and body_node.text:
                name_str = name_node.text.decode("utf-8")
                body_str = body_node.text.decode("utf-8")
                symbols[name_str] = body_str
                
        return symbols
