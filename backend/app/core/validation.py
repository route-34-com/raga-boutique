"""Turns FastAPI's validation errors into sentences a shopper or shop owner can act on."""

from collections.abc import Sequence
from typing import Any

LABELS = {
    "name": "Name", "phone": "Phone number", "line1": "House, street", "line2": "Area, landmark", "city": "City",
    "state": "State", "pincode": "Pincode", "email": "Email", "code": "Code", "price": "Selling price", "mrp": "MRP",
    "stock": "Stock", "images": "Photos", "variants": "Sizes", "swatch": "Colour", "qty": "Quantity",
    "free_ship_above": "Free shipping amount", "ship_fee": "Shipping fee", "low_stock_at": "Low-stock level",
    "contact_email": "Contact email", "contact_phone": "Contact phone", "contact_whatsapp": "WhatsApp number",
}
# Fields with a fixed format get one clear sentence instead of the generic rule.
FORMATS = {
    "pincode": "Pincode should be 6 digits, like 600004.",
    "phone": "Phone number should be a 10-digit Indian mobile number.",
    "contact_phone": "Contact phone should be a 10-digit number.",
    "contact_whatsapp": "WhatsApp number should be a 10-digit number.",
    "email": "Please enter a valid email address.",
    "contact_email": "Please enter a valid contact email address.",
    "instagram_url": "Instagram link should be a full address starting with https://",
    "facebook_url": "Facebook link should be a full address starting with https://",
    "code": "The code should be 6 digits.",
}


def _field(loc: Sequence[Any]) -> str:
    names = [str(p) for p in loc if isinstance(p, str) and p not in ("body", "query", "path")]
    return names[-1] if names else ""


def _sentence(err: dict) -> str:
    field = _field(err.get("loc", ()))
    label = LABELS.get(field, field.replace("_", " ").capitalize() or "This field")
    kind, ctx = err.get("type", ""), err.get("ctx") or {}
    if field in FORMATS and kind != "missing":
        return FORMATS[field]
    if kind == "missing":
        return f"{label} is required."
    if kind in ("string_too_short",) and ctx.get("min_length") == 1:
        return f"{label} can't be empty."
    if kind == "string_too_short":
        return f"{label} should be at least {ctx.get('min_length')} characters."
    if kind == "string_too_long":
        return f"{label} should be at most {ctx.get('max_length')} characters."
    if kind in ("greater_than", "greater_than_equal"):
        return f"{label} should be {'more than' if kind == 'greater_than' else 'at least'} {ctx.get('gt', ctx.get('ge'))}."
    if kind in ("less_than", "less_than_equal"):
        return f"{label} should be at most {ctx.get('lt', ctx.get('le'))}."
    if kind in ("int_parsing", "int_type", "float_parsing"):
        return f"{label} should be a number."
    if kind in ("too_short",) and field in ("images", "variants"):
        return f"Add at least one {'photo' if field == 'images' else 'size'}."
    return f"Please check {label.lower()}."


def friendly_errors(errors: Sequence[dict]) -> list[str]:
    out: list[str] = []
    for e in errors:
        s = _sentence(e)
        if s not in out:
            out.append(s)
    return out
