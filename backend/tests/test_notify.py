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
