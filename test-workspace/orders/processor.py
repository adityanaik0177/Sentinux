"""
orders/processor.py — Order Processing Pipeline (PRODUCER + CONSUMER)
======================================================================
This sits in a sub-package. It consumes models.py and produces its own
symbols (OrderProcessor, ProcessingResult) that checkout.py depends on.

F-Score breakdown:
  from models import User, Product, CartItem  → all 3 ✅ exist in models.py

Expected F-Score: 100.0 → GREEN ✅
This file is a middle-tier node in the dependency graph — a great node
to test the DependencyGraph visualization (shows chain: models → processor → checkout)
"""

from models import User, Product, CartItem


class ProcessingResult:
    """Result object returned by OrderProcessor."""

    def __init__(self, success: bool, order_id: int, total: float, error: str = ""):
        self.success = success
        self.order_id = order_id
        self.total = total
        self.error = error

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "order_id": self.order_id,
            "total": self.total,
            "error": self.error,
        }


class OrderProcessor:
    """Validates cart contents and creates an order record."""

    MAX_ITEMS_PER_ORDER = 50

    def __init__(self, user: User):
        self.user = user
        self._items: list[CartItem] = []

    def add_item(self, product: Product, qty: int) -> bool:
        """Add a product to this order. Returns False if stock insufficient."""
        if not product.is_in_stock():
            return False
        if qty < 1:
            return False
        self._items.append(CartItem(product=product, quantity=qty))
        return True

    def validate(self) -> tuple[bool, str]:
        """Pre-flight validation before committing the order."""
        if not self._items:
            return False, "Cart is empty"
        if len(self._items) > self.MAX_ITEMS_PER_ORDER:
            return False, f"Exceeds max {self.MAX_ITEMS_PER_ORDER} items"
        if not self.user.is_active:
            return False, "User account is deactivated"
        return True, ""

    def submit(self) -> ProcessingResult:
        """Submit the order after validation."""
        ok, err = self.validate()
        if not ok:
            return ProcessingResult(success=False, order_id=0, total=0.0, error=err)

        total = sum(item.subtotal() for item in self._items)
        fake_order_id = hash(self.user.email) % 100000

        return ProcessingResult(
            success=True,
            order_id=fake_order_id,
            total=round(total, 2),
        )


def quick_order(user: User, product: Product, qty: int = 1) -> ProcessingResult:
    """Convenience function: one item → one order."""
    proc = OrderProcessor(user)
    proc.add_item(product, qty)
    return proc.submit()
