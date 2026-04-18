"""
api.py — REST API Handler (CONSUMER, F-Score: ~100% — HEALTHY)
================================================================
Imports specific names from both database.py and models.py.
All imported names currently exist in their producers.

F-Score breakdown:
  from database import get_default_connection, run_migration  → both ✅ exist
  from models   import User, Product, CartItem, create_guest_user → all ✅ exist

Expected F-Score: 100.0 → Freshness Meter should show GREEN
"""

import json
from database import get_default_connection, run_migration
from models import User, Product, CartItem, create_guest_user


# ── Route Handlers ──────────────────────────────────────────────────────────

def handle_get_user(request: dict) -> dict:
    """GET /users/{id} — fetch a single user."""
    conn = get_default_connection()
    conn.connect()

    user_id = request.get("user_id", 0)
    if user_id == 0:
        user = create_guest_user()
    else:
        user = User(user_id=user_id, username="alice", email="alice@example.com")

    conn.disconnect()
    return {"status": 200, "data": user.to_dict()}


def handle_get_product(request: dict) -> dict:
    """GET /products/{id} — fetch a product with optional discount."""
    product = Product(
        product_id=request.get("product_id", 1),
        name="Sentinel T-Shirt",
        price=29.99,
        stock=42,
    )
    discount = request.get("discount", 0)
    final_price = product.apply_discount(discount) if discount else product.price

    return {
        "status": 200,
        "data": {**product.to_dict(), "final_price": final_price},
    }


def handle_add_to_cart(request: dict) -> dict:
    """POST /cart — add a product to cart, return subtotal."""
    product = Product(
        product_id=request.get("product_id", 1),
        name=request.get("name", "Item"),
        price=request.get("price", 9.99),
        stock=10,
    )
    item = CartItem(product=product, quantity=request.get("quantity", 1))
    return {"status": 200, "subtotal": item.subtotal()}


def handle_migrate(request: dict) -> dict:
    """POST /admin/migrate — apply a migration file."""
    conn = get_default_connection()
    conn.connect()
    ok = run_migration(conn, request.get("sql_file", "001_init.sql"))
    return {"status": 200 if ok else 500, "applied": ok}


# ── Router ──────────────────────────────────────────────────────────────────

ROUTES = {
    "GET /user":    handle_get_user,
    "GET /product": handle_get_product,
    "POST /cart":   handle_add_to_cart,
    "POST /migrate": handle_migrate,
}


def dispatch(method: str, path: str, body: dict) -> dict:
    handler = ROUTES.get(f"{method} {path}")
    if handler:
        return handler(body)
    return {"status": 404, "error": "Not found"}
