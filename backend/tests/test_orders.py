from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Variant
from tests.conftest import ADDRESS


def stock(size="ONE", slug_id=1):
    with SessionLocal() as db:
        return db.scalar(select(Variant.stock).where(Variant.product_id == slug_id, Variant.size == size))


def place(client, items, **extra):
    return client.post("/api/orders", json={"items": items, "address": ADDRESS, **extra})


def test_requires_login():
    from fastapi.testclient import TestClient
    from app.main import app
    assert place(TestClient(app), [{"product_id": 1, "qty": 1}]).status_code == 401


def test_place_order_uses_db_price_and_decrements_stock(customer):
    r = place(customer, [{"product_id": 1, "qty": 1, "price": 1}])  # a tampered price is ignored
    assert r.status_code == 201, r.text
    assert r.json() == {"order_no": "RB1001", "total": 11800}
    assert stock() == 1
    orders = customer.get("/api/me/orders").json()
    assert orders[0]["status"] == "placed" and orders[0]["items"][0]["price"] == 11800
    assert customer.get("/api/me/addresses").json()[0]["pincode"] == "625001"


def test_cannot_oversell(customer):
    r = place(customer, [{"product_id": 1, "qty": 3}])
    assert r.status_code == 409 and "only 2 left" in r.json()["detail"]["message"]
    assert stock() == 2  # nothing taken


def test_duplicate_lines_are_merged_for_stock_check(customer):
    r = place(customer, [{"product_id": 1, "qty": 2}, {"product_id": 1, "qty": 1}])
    assert r.status_code == 409
    assert stock() == 2


def test_sold_out_size_blocks_whole_order(customer):
    r = place(customer, [{"product_id": 1, "qty": 1}, {"product_id": 2, "size": "M", "qty": 1}])
    assert r.status_code == 409 and "sold out" in r.json()["detail"]["message"]
    assert stock() == 2


def test_shipping_fee_below_threshold(customer):
    r = place(customer, [{"product_id": 2, "size": "S", "qty": 1}])
    assert r.json()["total"] == 4650 + 150


def test_customer_cancel_restocks(customer):
    place(customer, [{"product_id": 1, "qty": 2}])
    assert stock() == 0
    r = customer.post("/api/me/orders/RB1001/cancel")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert stock() == 2


def test_cannot_see_someone_elses_order(customer, admin):
    place(customer, [{"product_id": 1, "qty": 1}])
    assert admin.get("/api/me/orders/RB1001").status_code == 404


def test_admin_status_flow(customer, admin):
    place(customer, [{"product_id": 1, "qty": 1}])
    oid = admin.get("/api/admin/orders").json()[0]["id"]
    assert admin.post(f"/api/admin/orders/{oid}/status", json={"status": "packed"}).status_code == 200  # can skip ahead
    assert admin.post(f"/api/admin/orders/{oid}/status", json={"status": "confirmed"}).status_code == 409  # never backwards
    assert admin.post(f"/api/admin/orders/{oid}/status", json={"status": "shipped"}).status_code == 400  # needs tracking
    r = admin.post(f"/api/admin/orders/{oid}/status", json={"status": "shipped", "courier": "Delhivery", "tracking_id": "DL1"})
    assert r.json()["tracking_id"] == "DL1"
    assert customer.post("/api/me/orders/RB1001/cancel").status_code == 409  # too late for the customer
    r = admin.post(f"/api/admin/orders/{oid}/status", json={"status": "delivered"})
    assert r.json()["payment_status"] == "paid"


def test_admin_cancel_restocks(customer, admin):
    place(customer, [{"product_id": 1, "qty": 2}])
    oid = admin.get("/api/admin/orders").json()[0]["id"]
    admin.post(f"/api/admin/orders/{oid}/status", json={"status": "cancelled"})
    assert stock() == 2


def test_admin_routes_need_admin(customer):
    assert customer.get("/api/admin/dashboard").status_code == 403
