"""
orders/checkout.py — Checkout Flow (CONSUMER, F-Score: 100% — HEALTHY ✅)
==========================================================================
Imports from orders/processor.py (same package) and models.py.
All imported symbols exist in their producers.

F-Score breakdown:
  from orders.processor import OrderProcessor, ProcessingResult, quick_order
    → all 3 ✅ exist in processor.py

  from models import User, Product
    → both ✅ exist in models.py

Expected F-Score: 100.0 → GREEN ✅

BLAST RADIUS TEST: When you save processor.py, checkout.py should receive
a ⚡ Blast Radius Warning in VS Code's Problems panel.
"""

from orders.processor import OrderProcessor, ProcessingResult, quick_order
from models import User, Product


# ── Checkout Steps ───────────────────────────────────────────────────────────

def apply_coupon(result: ProcessingResult, coupon_code: str) -> float:
    """Apply a discount coupon to an order total. Returns final price."""
    COUPONS = {
        "SENTINEL10": 0.10,
        "NEXUS20": 0.20,
        "GUARDIAN50": 0.50,
    }
    discount = COUPONS.get(coupon_code.upper(), 0.0)
    return round(result.total * (1 - discount), 2)


def checkout_flow(
    user: User,
    items: list[tuple[Product, int]],
    coupon: str = "",
) -> dict:
    """
    Full checkout flow:
      1. Build order via OrderProcessor
      2. Validate and submit
      3. Apply optional coupon
      4. Return receipt
    """
    processor = OrderProcessor(user)
    for product, qty in items:
        added = processor.add_item(product, qty)
        if not added:
            return {
                "status": "failed",
                "reason": f"Could not add {product.name} (qty: {qty})",
            }

    result = processor.submit()
    if not result.success:
        return {"status": "failed", "reason": result.error}

    final_total = apply_coupon(result, coupon) if coupon else result.total

    


def express_checkout(user: User, product: Product) -> dict:
    """One-click buy: single item, no coupon."""
    result = quick_order(user, product, qty=1)
    return result.to_dict()
