from types import SimpleNamespace

from app.services.notify import messages, whatsapp

DTDC = {"name": "DTDC", "track_url": "https://t.example/?awb={id}"}


def _order(**kw):
    base = dict(order_no="RB1001", customer_name="Priya Raman", total=11800, courier="DTDC", tracking_id="X1",
                address={"city": "Madurai"}, items=[SimpleNamespace(qty=1), SimpleNamespace(qty=2)])
    return SimpleNamespace(**(base | kw))


def test_wa_link_strips_plus_and_encodes():
    assert whatsapp.wa_link("+919876543210", "Hi & bye") == "https://wa.me/919876543210?text=Hi%20%26%20bye"


def test_render_shipped_with_link():
    text = messages.render("shipped", _order(), [DTDC])
    assert "Tracking ID: X1" in text and "https://t.example/?awb=X1" in text and text.startswith("Hi Priya,")


def test_render_shipped_without_pattern_drops_link_sentence():
    text = messages.render("shipped", _order(courier="Local"), [DTDC])
    assert "Track it here" not in text and text.endswith("Tracking ID: X1.")


def test_render_accepted_formats_total():
    assert "Total ₹11,800 (cash on delivery)" in messages.render("accepted", _order(), [])


def test_render_new_order_for_owner():
    assert messages.render("new_order", _order(), []) == "New order RB1001: 3 item(s), ₹11,800, Priya Raman, Madurai."


def test_tap_mode_send_returns_link():
    status, detail = whatsapp.send("+919876543210", "accepted", "Hello", [])
    assert status == "tap" and detail == "https://wa.me/919876543210?text=Hello"


# --- notify(): one send per order + kind + channel, failures recorded, never raised ---

import smtplib  # noqa: E402

import pytest  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.db import SessionLocal  # noqa: E402
from app.models import Notification, Order, StoreSettings  # noqa: E402
from app.services.notify import notify  # noqa: E402
from tests.conftest import ADDRESS  # noqa: E402


@pytest.fixture
def order_id(customer):
    r = customer.post("/api/orders", json={"items": [{"product_id": 1, "qty": 1}], "address": ADDRESS, "email": "priya@example.com"})
    assert r.status_code in (200, 201), r.text
    with SessionLocal() as db:
        return db.scalar(select(Order.id))


def rows(order_id, kind):
    with SessionLocal() as db:
        return {n.channel: n for n in db.scalars(select(Notification).where(Notification.order_id == order_id, Notification.kind == kind))}


def run(order_id, kind, email=None):
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        if email is not None:
            order.email = email
            db.commit()
        return notify(db, order, kind)


def test_notify_accepted_creates_tap_and_logged_rows(order_id):
    run(order_id, "accepted")
    r = rows(order_id, "accepted")
    assert r["whatsapp"].status == "tap" and r["whatsapp"].detail.startswith("https://wa.me/919876543210?text=Hi%20Priya")
    assert r["email"].status == "logged"


def test_notify_twice_sends_once(order_id):
    assert len(run(order_id, "accepted")) == 2
    assert run(order_id, "accepted") == []
    assert len(rows(order_id, "accepted")) == 2


def test_no_email_is_skipped(order_id):
    run(order_id, "accepted", email="")
    r = rows(order_id, "accepted")
    assert r["email"].status == "skipped" and r["whatsapp"].status == "tap"


def test_smtp_failure_recorded(order_id, monkeypatch):
    monkeypatch.setattr(get_settings(), "email_provider", "smtp")

    def refuse(*a, **k):
        raise OSError("connection refused")
    monkeypatch.setattr(smtplib, "SMTP", refuse)
    run(order_id, "accepted")
    r = rows(order_id, "accepted")
    assert r["email"].status == "failed" and "refused" in r["email"].detail
    with SessionLocal() as db:
        assert db.get(Order, order_id).status == "placed"


def test_new_order_tap_mode_emails_shop_only(customer):
    with SessionLocal() as db:
        db.get(StoreSettings, 1).contact_email = "shop@example.com"
        db.commit()
    customer.post("/api/orders", json={"items": [{"product_id": 1, "qty": 1}], "address": ADDRESS, "email": "priya@example.com"})
    with SessionLocal() as db:
        oid = db.scalar(select(Order.id))
    r = rows(oid, "new_order")
    assert set(r) == {"email"} and r["email"].status == "logged"
