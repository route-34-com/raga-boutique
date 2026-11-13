import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Order
from app.services import payments
from tests.test_orders import place, stock

ITEM = [{"product_id": 1, "qty": 1}]


@pytest.fixture
def demo(monkeypatch):
    monkeypatch.setattr(get_settings(), "payment_provider", "demo")


@pytest.fixture
def razorpay(monkeypatch):
    s = get_settings()
    for k, v in {"payment_provider": "razorpay", "razorpay_key_id": "rzp_test_abc", "razorpay_key_secret": "sekret",
                 "razorpay_webhook_secret": "hooksecret"}.items():
        monkeypatch.setattr(s, k, v)
    calls = []

    class Resp:
        def __init__(self, body):
            self.body = body

        def raise_for_status(self):
            pass

        def json(self):
            return self.body

    def fake_post(url, **kw):
        calls.append((url, kw.get("json")))
        return Resp({"id": "rfnd_1"} if url.endswith("/refund") else {"id": "order_RZP1"})

    monkeypatch.setattr(payments.httpx, "post", fake_post)
    return calls


def sign(secret: str, msg: bytes) -> str:
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def order_id(admin):
    return admin.get("/api/admin/orders").json()[0]["id"]


def test_online_hidden_when_off(customer, monkeypatch):
    monkeypatch.setattr(get_settings(), "payment_provider", "off")
    assert customer.get("/api/settings").json()["online_payments"] == ""
    assert place(customer, ITEM, payment_method="online").status_code == 400


def test_demo_payment_marks_paid_and_unlocks_accept(customer, admin, demo):
    r = place(customer, ITEM, payment_method="online").json()
    assert r["payment"]["provider"] == "demo" and r["payment"]["amount"] == 11800 * 100
    no = r["order_no"]
    oid = order_id(admin)
    assert admin.post(f"/api/admin/orders/{oid}/status", json={"status": "confirmed"}).status_code == 409
    assert admin.get("/api/admin/orders/counts").json()["awaiting_payment"] == 1
    o = customer.post(f"/api/me/orders/{no}/pay/demo").json()
    assert o["payment_status"] == "paid" and o["payment_ref"].startswith("pay_demo_")
    assert admin.post(f"/api/admin/orders/{oid}/status", json={"status": "confirmed"}).status_code == 200


def test_razorpay_verify_checks_the_signature(customer, razorpay):
    r = place(customer, ITEM, payment_method="online").json()
    assert r["payment"]["order_id"] == "order_RZP1" and r["payment"]["key"] == "rzp_test_abc"
    assert razorpay[0][1]["amount"] == 11800 * 100
    no = r["order_no"]
    bad = {"razorpay_order_id": "order_RZP1", "razorpay_payment_id": "pay_X", "razorpay_signature": "nope"}
    assert customer.post(f"/api/me/orders/{no}/pay/verify", json=bad).status_code == 400
    good = {**bad, "razorpay_signature": sign("sekret", b"order_RZP1|pay_X")}
    o = customer.post(f"/api/me/orders/{no}/pay/verify", json=good).json()
    assert (o["payment_status"], o["payment_ref"]) == ("paid", "pay_X")
    assert customer.post(f"/api/me/orders/{no}/pay/demo").status_code == 404


def test_webhook_marks_paid_once_and_rejects_bad_signatures(customer, razorpay):
    no = place(customer, ITEM, payment_method="online").json()["order_no"]
    body = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_W", "order_id": "order_RZP1"}}}}).encode()
    assert customer.post("/api/payments/razorpay/webhook", content=body, headers={"X-Razorpay-Signature": "bad"}).json() == {"ok": False}
    for _ in range(2):
        r = customer.post("/api/payments/razorpay/webhook", content=body, headers={"X-Razorpay-Signature": sign("hooksecret", body)})
        assert r.json() == {"ok": True}
    o = customer.get(f"/api/me/orders/{no}").json()
    assert (o["payment_status"], o["payment_ref"]) == ("paid", "pay_W")
    assert sum("Paid online" in e["note"] for e in o["events"]) == 1


def test_cancelling_a_paid_order_refunds_it(customer, admin, razorpay):
    no = place(customer, ITEM, payment_method="online").json()["order_no"]
    customer.post(f"/api/me/orders/{no}/pay/verify", json={"razorpay_order_id": "order_RZP1", "razorpay_payment_id": "pay_R",
                                                           "razorpay_signature": sign("sekret", b"order_RZP1|pay_R")})
    o = admin.post(f"/api/admin/orders/{order_id(admin)}/status", json={"status": "cancelled"}).json()
    assert o["payment_status"] == "refunded"
    assert razorpay[-1] == ("https://api.razorpay.com/v1/payments/pay_R/refund", {"amount": 11800 * 100})
    assert stock() == 2


def test_unpaid_online_orders_expire_and_release_stock(customer, admin, demo):
    no = place(customer, ITEM, payment_method="online").json()["order_no"]
    assert stock() == 1
    with SessionLocal() as db:
        db.execute(update(Order).values(created_at=datetime.now(UTC) - timedelta(minutes=31)))
        db.commit()
    assert admin.get("/api/admin/orders").json()[0]["status"] == "cancelled"
    assert stock() == 2
    assert customer.get(f"/api/me/orders/{no}/pay").status_code == 409
    with SessionLocal() as db:
        assert db.scalar(select(Order.payment_status)) == "pending"
