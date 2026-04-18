# canteen/main.py
import uuid
from typing import List

from .menu import fetch_daily_specials, MenuItem
from .payment import process_credit_card

def take_order(items_requested: list) -> List[MenuItem]:
    specials = fetch_daily_specials()
    cart = []
    for req in items_requested:
        for item in specials:
            if item.item_id == req:
                cart.append(item)
    return cart

# --- INTENTIONAL DUPLICATE CODE ---
def print_final_bill(purchased_items: List[MenuItem], final_total: float) -> str:
    """
    This is functionally identical to generate_customer_receipt in payment.py!
    Nexus-Sentinel's AI vectors will catch this Structural Clone and ask
    Gemini to generate a refactoring suggestion to unify them.
    """
    lines_to_print = [f"=== CANTEEN RECEIPT ==="]
    lines_to_print.append(f"Transaction ID: {uuid.uuid4().hex[:8].upper()}")
    
    for food in purchased_items:
        lines_to_print.append(f"{food.name.ljust(25)} : ${food.price:.2f}")
        
    lines_to_print.append("-" * 35)
    lines_to_print.append(f"TOTAL PAID                   : ${final_total:.2f}")
    lines_to_print.append("Thank you for your purchase!")
    
    output_bill = "\n".join(lines_to_print)
    return output_bill

def run_system():
    print("Welcome to the Python Canteen!")
    cart = take_order(["S1", "S2"])
    
    total = sum(item.price for item in cart)
    
    if process_credit_card(total):
        bill = print_final_bill(cart, total)
        print("\n" + bill)

if __name__ == "__main__":
    run_system()
