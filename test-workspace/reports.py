"""
reports.py — Analytics & Reporting (CONSUMER, F-Score: ~67% — DRIFTING ⚠️)
============================================================================
This file imports names that have PARTIALLY drifted from their producers.

F-Score breakdown (only from-imports count):
  from database import DatabaseConnection, QueryBuilder, get_db  → get_db ❌ MISSING
  from models   import User, Product, OrderSummary               → OrderSummary ❌ MISSING

  Total deps: 5
  Matched:    3  (DatabaseConnection, QueryBuilder, User, Product all exist)
  Missing:    2  (get_db, OrderSummary were renamed/removed)

Expected F-Score: 3/5 = 60.0 → Freshness Meter should show AMBER 🟡
NOTE: This will show a SYNTAX ERROR at runtime because the imports don't resolve,
      but tree-sitter still parses the AST and Sentinel still sees the drift.
"""

# These two exist ✅
from database import DatabaseConnection, QueryBuilder

# get_db ❌ doesn't exist — was renamed to get_default_connection
from database import get_db

from models import User, Product

# OrderSummary ❌ doesn't exist in models.py — was never defined
from models import OrderSummary


# ── Report Generators ────────────────────────────────────────────────────────

def generate_user_report(conn: DatabaseConnection) -> dict:
    """Pull all active users and summarize."""
    q = QueryBuilder().from_table("users").where("is_active = true").build()
    return {
        "report": "user_summary",
        "query": q,
        "count": 0,
    }


def generate_sales_report(conn: DatabaseConnection) -> dict:
    """Aggregate sales across all products."""
    q = QueryBuilder().from_table("orders").build()
    products = []  # would normally fetch via conn
    return {
        "report": "sales",
        "query": q,
        "products": products,
        "total_revenue": 0.0,
    }


def run_daily_digest() -> dict:
    """Run the full daily analytics pipeline."""
    # get_db() — this would fail at runtime because function was renamed!
    conn = get_db()
    users = generate_user_report(conn)
    sales = generate_sales_report(conn)
    return {"users": users, "sales": sales}
