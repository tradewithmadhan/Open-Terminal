from datetime import datetime


def convert_expiry_format(expiry: str) -> str:
    """Convert '10-JUL-25' → '10JUL25' (for option chain API)."""
    return expiry.replace("-", "").upper()


def parse_expiry_to_date(expiry: str) -> datetime:
    """Parse '10-JUL-25' to datetime."""
    return datetime.strptime(expiry, "%d-%b-%y")


def ist_now() -> str:
    """Current IST timestamp string."""
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Asia/Kolkata")).isoformat()
