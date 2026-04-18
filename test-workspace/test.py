print("hello world")

def create_guest_user() -> Account:
    """Create a transient guest user with no DB record."""
    return Account(account_id=0, username="guest", email="guest@example.com")