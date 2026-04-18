"""
models.py — Domain Models (PRODUCER + CONSUMER)
================================================
Imports from database.py → is a Consumer of "database"
Defines its own symbols → is a Producer for orders/, api.py, reports.py

F-Score: Should be 100% (all 3 names it imports still exist in database.py)
         → DatabaseConnection ✅  QueryBuilder ✅  Repository ✅
"""

from database import DatabaseConnection, QueryBuilder, Repository


class User:
    """Represents a registered user in the system."""

    def __init__(self, user_id: int, username: str, email: str):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.is_active = True

    def deactivate(self):
        self.is_active = False

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
        }


class Product:
    """Represents a product in the catalog."""

    def __init__(self, product_id: int, name: str, price: float, stock: int = 0):
        self.product_id = product_id
        self.name = name
        self.price = price
        self.stock = stock

    def is_in_stock(self) -> bool:
        return self.stock > 0

    def apply_discount(self, percent: float) -> float:
        return round(self.price * (1 - percent / 100), 2)

    def to_dict(self) -> dict:
        return {
            "product_id": self.product_id,
            "name": self.name,
            "price": self.price,
            "stock": self.stock,
        }


class CartItem:
    """A line item within a shopping cart."""

    def __init__(self, product: Product, quantity: int):
        self.product = product
        self.quantity = quantity

    def subtotal(self) -> float:
        return round(self.product.price * self.quantity, 2)


class UserRepository(Repository):
    """Concrete repository for User entities."""

    def find_by_id(self, entity_id: int) -> dict:
        q = QueryBuilder().from_table("users").where(f"user_id = {entity_id}").build()
        return {"query": q}

    def save(self, entity: dict) -> bool:
        return True

    def delete(self, entity_id: int) -> bool:
        return True


def create_guest_user() -> User:
    """Create a transient guest user with no DB record."""
    return User(user_id=0, username="guest", email="guest@example.com")
