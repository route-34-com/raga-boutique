"""Online payments.

"razorpay": Razorpay Checkout (UPI, cards, netbanking, wallets). The server creates a Razorpay order, the browser opens
Razorpay's checkout, and the payment is accepted only after its signature is checked here. A webhook marks the order
paid as well, for shoppers who close the tab before returning. Cancelling a paid order refunds it through the API.
"demo": a stand-in checkout for demos and local testing, before the shop has Razorpay keys. No money moves.
"off": online payment is hidden at checkout.
"""

import hashlib
import hmac
import logging
import secrets

import httpx

from app.core.config import get_settings
from app.core.errors import ServiceError

log = logging.getLogger(__name__)
API = "https://api.razorpay.com/v1"


def provider() -> str:
    s = get_settings()
    if s.payment_provider == "razorpay":
        return "razorpay" if s.razorpay_key_id and s.razorpay_key_secret else "off"
    return "demo" if s.payment_provider == "demo" else "off"


def mode() -> str:
    """What the admin panel shows: live, test (Razorpay test keys), demo or off."""
    p = provider()
    if p == "razorpay":
        return "test" if get_settings().razorpay_key_id.startswith("rzp_test_") else "live"
    return p


def _auth() -> tuple[str, str]:
    s = get_settings()
    return s.razorpay_key_id, s.razorpay_key_secret


def create_gateway_order(order_no: str, amount: int) -> str:
    """Returns the gateway's order id for an amount in rupees."""
    if provider() == "demo":
        return f"order_demo_{secrets.token_hex(7)}"
    try:
        r = httpx.post(f"{API}/orders", auth=_auth(), timeout=15,
                       json={"amount": amount * 100, "currency": "INR", "receipt": order_no, "notes": {"order_no": order_no}})
        r.raise_for_status()
        return r.json()["id"]
    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("Razorpay order failed for %s: %s", order_no, e)
        raise ServiceError("Online payment is unavailable right now. Please try again, or choose cash on delivery.", 502) from None


def checkout_options(order) -> dict:
    s = get_settings()
    return {"provider": provider(), "key": s.razorpay_key_id if provider() == "razorpay" else "",
            "order_id": order.gateway_order_id, "amount": order.total * 100, "currency": "INR",
            "name": "Raga Boutique", "description": f"Order {order.order_no}",
            "prefill": {"name": order.customer_name, "email": order.email, "contact": order.phone}}


def _hmac(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def signature_ok(gateway_order_id: str, payment_id: str, signature: str) -> bool:
    secret = get_settings().razorpay_key_secret
    return bool(secret) and hmac.compare_digest(_hmac(secret, f"{gateway_order_id}|{payment_id}".encode()), signature)


def webhook_ok(body: bytes, signature: str) -> bool:
    secret = get_settings().razorpay_webhook_secret
    return bool(secret and signature) and hmac.compare_digest(_hmac(secret, body), signature)


def refund(payment_id: str, amount: int) -> str:
    """Refunds an amount in rupees; returns the refund id."""
    if provider() == "demo" or payment_id.startswith("pay_demo_"):
        return f"rfnd_demo_{secrets.token_hex(6)}"
    try:
        r = httpx.post(f"{API}/payments/{payment_id}/refund", auth=_auth(), json={"amount": amount * 100}, timeout=15)
        r.raise_for_status()
        return r.json()["id"]
    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("Razorpay refund failed for %s: %s", payment_id, e)
        raise ServiceError("The refund couldn't be started, so the order was not cancelled. Please try again in a minute.", 502) from None
