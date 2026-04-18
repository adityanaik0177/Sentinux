"""
notifications.py — Alert System (CONSUMER, F-Score: ~25% — CRITICAL 🔴)
=========================================================================
This file heavily imports from database.py and models.py using names that
have almost entirely been renamed or removed. Classic contract break.

F-Score breakdown:
  from database import SessionManager, ConnectionPool, execute_raw, ping_db
    → SessionManager ❌  ConnectionPool ❌  execute_raw ❌  ping_db ❌  (ALL MISSING)

  from models import CustomerProfile, OrderLineItem, Address
    → CustomerProfile ❌  OrderLineItem ❌  Address ❌  (ALL MISSING)

  from models import User
    → User ✅ (1 match)

  Total deps: 8
  Matched:    1
  F-Score:    1/8 = 12.5% → CRITICAL 🔴

This file demonstrates what happens when a module goes "dark" — it was
written against an old version of the codebase and nobody refactored it.
"""

import smtplib

# All 4 of these names don't exist in database.py → 0 matches
from database import SessionManager, ConnectionPool, execute_raw, ping_db

# 3 of these 4 don't exist in models.py
from models import CustomerProfile, OrderLineItem, Address, User


# ── Notification Handlers ────────────────────────────────────────────────────

def send_order_confirmation(order: OrderLineItem, customer: CustomerProfile) -> bool:
    """Email order confirmation. Uses old API that no longer exists."""
    if not ping_db():
        return False

    pool = ConnectionPool(max_size=5)
    session = SessionManager(pool)

    email_data = {
        "to": customer.email,
        "subject": "Order Confirmed",
        "body": f"Your order #{order.order_id} has been placed.",
    }
    print(f"[Notify] Sending to {email_data['to']}")
    session.close()
    return True


def send_shipping_update(order_id: int, address: Address) -> bool:
    """Notify customer their package is on the way."""
    raw_sql = execute_raw(f"SELECT * FROM shipments WHERE order_id = {order_id}")
    if not raw_sql:
        return False
    print(f"[Notify] Shipping update for order {order_id} → {address.city}")
    return True


def broadcast_promo(discount_pct: float, users: list) -> int:
    """Blast a promotional email to all active users."""
    sent = 0
    for user in users:
        if isinstance(user, User) and user.is_active:
            print(f"[Promo] {discount_pct}% off → {user.email}")
            sent += 1
    return sent
