"""The words customers and the owner receive. Kept short: WhatsApp templates must match these."""

from urllib.parse import quote

from app.core.config import get_settings


def inr(n: int) -> str:
    s = str(n)
    if len(s) <= 3:
        return "₹" + s
    head, tail = s[:-3], s[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    return "₹" + ",".join([head, *groups, tail])


def track_link(courier: str, tracking_id: str, couriers: list[dict]) -> str:
    for c in couriers:
        if c.get("name", "").strip().lower() == courier.strip().lower() and "{id}" in c.get("track_url", ""):
            return c["track_url"].replace("{id}", quote(tracking_id, safe=""))
    return ""


def order_link(order) -> str:
    """The customer's order page, where delivered pieces can be rated."""
    return f"{get_settings().public_site_url.rstrip('/')}/orders/{order.order_no}"


def params(kind: str, order, couriers: list[dict]) -> list[str]:
    """Values in template order, for the WhatsApp Cloud API."""
    first = order.customer_name.split()[0] if order.customer_name else "there"
    if kind == "accepted":
        method, status = getattr(order, "payment_method", "cod"), getattr(order, "payment_status", "pending")
        paid = "paid online" if method == "online" and status == "paid" else "paid" if status == "paid" else "cash on delivery"
        return [first, order.order_no, f"{inr(order.total)} ({paid})"]
    if kind == "shipped":
        return [first, order.order_no, order.courier, order.tracking_id, track_link(order.courier, order.tracking_id, couriers)]
    if kind == "delivered":
        return [first, order.order_no, order_link(order)]
    count = sum(i.qty for i in order.items)
    return [order.order_no, str(count), inr(order.total), order.customer_name, order.address.get("city", "")]


def render(kind: str, order, couriers: list[dict]) -> str:
    p = params(kind, order, couriers)
    if kind == "accepted":
        return (f"Hi {p[0]}, your Raga order {p[1]} is confirmed. We'll message you the tracking details once it ships. "
                f"Total {p[2]}.")
    if kind == "shipped":
        text = f"Hi {p[0]}, your Raga order {p[1]} is on its way with {p[2]}. Tracking ID: {p[3]}."
        return f"{text} Track it here: {p[4]}" if p[4] else text
    if kind == "delivered":
        return f"Hi {p[0]}, your Raga order {p[1]} has been delivered. Hope you love it! Rate your order here: {p[2]}"
    return f"New order {p[0]}: {p[1]} item(s), {p[2]}, {p[3]}, {p[4]}."
