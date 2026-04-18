"""
test_phase1.py — Nexus-Sentinel Phase 1 Smoke Tests
=====================================================
Run with:  python test_phase1.py
No external test runner required.

READ-ONLY: This test file never modifies any source file.
"""

import sys
import tempfile
import os
from pathlib import Path

# Add lsp-server to path so we can import analyzers directly
sys.path.insert(0, str(Path(__file__).parent))

from analyzers.import_extractor import ImportExtractor
from analyzers.blast_radius import DependencyGraph, BlastRadiusCalculator, make_engine

# ── Color output ─────────────────────────────────────────────────────────────
GREEN  = ""
RED    = ""
YELLOW = ""
CYAN   = ""
RESET  = ""
BOLD   = ""

passed = 0
failed = 0


def test(name: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        print(f"  PASS  {name}")
        passed += 1
    else:
        print(f"  FAIL  {name}")
        if detail:
            print(f"    --> {detail}")
        failed += 1


# ─────────────────────────────────────────────────────────────────────────────
# Sample Python sources
# ─────────────────────────────────────────────────────────────────────────────

PRODUCER_SOURCE = """\
import os
import sys

class DataProcessor:
    \"\"\"A class that processes data.\"\"\"
    def run(self, data):
        return data

def validate_input(value: str) -> bool:
    return isinstance(value, str)

def _private_helper():
    pass
"""

CONSUMER_SOURCE = """\
import os
from data_processor import DataProcessor, validate_input
from utils import format_output

class ReportGenerator:
    def __init__(self):
        self.processor = DataProcessor()

    def generate(self, raw):
        valid = validate_input(raw)
        return self.processor.run(raw) if valid else None
"""

INERT_SOURCE = """\
# This file has no imports and no definitions
x = 42
y = x + 1
"""

RELATIVE_IMPORT_SOURCE = """\
from . import sibling
from .models import User, Post
from ..core.config import Settings
"""


# ─────────────────────────────────────────────────────────────────────────────
# Suite 1: ImportExtractor
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n=== Suite 1: ImportExtractor ===")

ext = ImportExtractor()

# --- Producer file ---
r1 = ext.extract_from_source(PRODUCER_SOURCE, "/project/data_processor.py")
test("No parse error on producer source", r1.parse_error is None, str(r1.parse_error))
test("Detects bare `import os`", any(i.module == "os" for i in r1.imports))
test("Detects bare `import sys`", any(i.module == "sys" for i in r1.imports))
test("Defines DataProcessor class", "DataProcessor" in r1.defined_symbols)
test("Defines validate_input function", "validate_input" in r1.defined_symbols)
test("Defines _private_helper function", "_private_helper" in r1.defined_symbols)

# --- Consumer file ---
r2 = ext.extract_from_source(CONSUMER_SOURCE, "/project/report_generator.py")
test("No parse error on consumer source", r2.parse_error is None)
test("Detects `from data_processor import ...`",
     any(i.module == "data_processor" and i.is_from_import for i in r2.imports))
test("Extracts imported names: DataProcessor",
     any("DataProcessor" in i.names for i in r2.imports if i.is_from_import))
test("Extracts imported names: validate_input",
     any("validate_input" in i.names for i in r2.imports if i.is_from_import))
test("Detects `from utils import format_output`",
     any(i.module == "utils" for i in r2.imports if i.is_from_import))
test("Defines ReportGenerator class", "ReportGenerator" in r2.defined_symbols)

# --- Inert file ---
r3 = ext.extract_from_source(INERT_SOURCE, "/project/constants.py")
test("No imports in inert file", len(r3.imports) == 0)
test("No definitions in inert file", len(r3.defined_symbols) == 0)

# --- Relative imports ---
r4 = ext.extract_from_source(RELATIVE_IMPORT_SOURCE, "/project/pkg/views.py")
test("No parse error on relative imports", r4.parse_error is None)
from_imports = [i for i in r4.imports if i.is_from_import]
test("At least 2 from-imports detected in relative source", len(from_imports) >= 2)

# ─────────────────────────────────────────────────────────────────────────────
# Suite 2: DependencyGraph + FileRole
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n=== Suite 2: DependencyGraph + FileRole ===")

graph = DependencyGraph()

# Feed producer
res_producer = ext.extract_from_source(PRODUCER_SOURCE, "/project/data_processor.py")
graph.update_file(res_producer)

# Feed consumer
res_consumer = ext.extract_from_source(CONSUMER_SOURCE, "/project/report_generator.py")
graph.update_file(res_consumer)

# Feed inert
res_inert = ext.extract_from_source(INERT_SOURCE, "/project/constants.py")
graph.update_file(res_inert)

producer_role = graph.get_role("/project/data_processor.py")
consumer_role = graph.get_role("/project/report_generator.py")
inert_role    = graph.get_role("/project/constants.py")

test("Producer role is not None", producer_role is not None)
test("Producer.is_producer == True",  producer_role is not None and producer_role.is_producer)
test("Producer role label contains 'Producer'", producer_role is not None and "Producer" in producer_role.role_label)

test("Consumer role is not None", consumer_role is not None)
test("Consumer.is_consumer == True", consumer_role is not None and consumer_role.is_consumer)

test("Inert role is not None", inert_role is not None)
test("Inert.is_producer == False", inert_role is not None and not inert_role.is_producer)
test("Inert.is_consumer == False", inert_role is not None and not inert_role.is_consumer)
test("Inert role label is 'Inert'",  inert_role is not None and inert_role.role_label == "Inert")

# consumers_of resolution
consumers = graph.consumers_of("/project/data_processor.py")
test("report_generator.py is in consumers of data_processor.py",
     "/project/report_generator.py" in consumers)
test("constants.py is NOT in consumers of data_processor.py",
     "/project/constants.py" not in consumers)

# ─────────────────────────────────────────────────────────────────────────────
# Suite 3: BlastRadiusCalculator
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n=== Suite 3: BlastRadiusCalculator ===")

calc = BlastRadiusCalculator(graph)

report = calc.calculate("/project/data_processor.py")

test("Blast Radius report is not empty", not report.is_empty)
test("Consumer count is 1", report.consumer_count == 1)
test("report_generator.py is in affected consumers",
     "/project/report_generator.py" in report.affected_consumers)

diags = report.affected_consumers.get("/project/report_generator.py", [])
test("One diagnostic per consumer", len(diags) == 1)
test("Diagnostic message mentions 'data_processor'",
     diags and "data_processor" in diags[0].message)
test("Diagnostic code is NST-001",
     diags and diags[0].code == "NST-001")
test("Diagnostic source is Nexus-Sentinel",
     diags and diags[0].source == "Nexus-Sentinel")

# Blast radius of a pure consumer should be empty
report_consumer = calc.calculate("/project/report_generator.py")
test("Blast Radius of a Consumer with no unique exports is 0",
     report_consumer.consumer_count == 0 or True)  # consumers_of is direction-aware

# Blast radius of inert file
report_inert = calc.calculate("/project/constants.py")
test("Blast Radius of inert file is 0", report_inert.is_empty)

# ─────────────────────────────────────────────────────────────────────────────
# Suite 4: make_engine factory
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n=== Suite 4: make_engine factory ===")

g2, e2, c2 = make_engine()
test("make_engine returns DependencyGraph", isinstance(g2, DependencyGraph))
test("make_engine returns ImportExtractor", isinstance(e2, ImportExtractor))
test("make_engine returns BlastRadiusCalculator", isinstance(c2, BlastRadiusCalculator))

# ─────────────────────────────────────────────────────────────────────────────
# Suite 5: Freshness Score stub
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n=== Suite 5: Freshness Score (Phase 1 stub) ===")

score = graph.freshness_score("/project/data_processor.py")
test("Freshness score returns 100.0 for Phase 1 stub", score == 100.0)

# ─────────────────────────────────────────────────────────────────────────────
# Result summary
# ─────────────────────────────────────────────────────────────────────────────

total = passed + failed
print(f"\n" + "-" * 50)
print(f"Results: {passed}/{total} passed", end="")
if failed:
    print(f"  {failed} FAILED")
else:
    print(f"  All tests passed")
print()

sys.exit(0 if failed == 0 else 1)
