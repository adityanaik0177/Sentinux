# canteen/menu.py

class MenuItem:
    def __init__(self, item_id: str, name: str, price: float):
        self.item_id = item_id
        self.name = name
        self.price = price

def fetch_daily_specials() -> list:
    """Returns the specials for the day."""
    return [
        MenuItem("S1", "Chicken Tikka Masala", 12.99),
        MenuItem("S2", "Paneer Butter Masala", 10.99)
    ]

# --- INTENTIONAL DEAD CODE ---
def unused_admin_price_override(item: MenuItem, new_price: float):
    """
    This function is exported but NEVER imported by any other file.
    Nexus-Sentinel should immediately flag this as Dead Code!
    """
    item.price = new_price
    print(f"Admin override: {item.name} is now ${item.price}")
