# canteen/payment.py
import uuid
from typ import List
from .menu import MenuItem

def process_credit_card(amount: float) -> bool:
    print(f"Processing credit card payment for ${amount:.2f}...")
    return True

# --- INTENTIONAL DUPLICATE CODE ---
def generate_customer_receipt(items: List[MenuItem], total_paid: float) -> str:
    """
    This logic generates a formatted text receipt.
    Watch Nexus-Sentinel flag this because it's duplicated in main.py!
    """
    receipt_lines = [f"=== CANTEEN RECEIPT ==="]
    receipt_lines.append(f"Transaction ID: {uuid.uuid4().hex[:8].upper()}")
    for item in items:
        receipt_lines.append(f"{item.name.ljust(25)} : ${item.price:.2f}")
    receipt_lines.append("-" * 35)
    receipt_lines.append(f"TOTAL PAID                   : ${total_paid:.2f}")
    receipt_lines.append("Thank you for your purchase!")
    
    formatted_receipt = "\n".join(receipt_lines)
    return formatted_receipt
