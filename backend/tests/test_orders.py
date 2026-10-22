from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Variant
from tests.conftest import ADDRESS


def stock(size="ONE", slug_id=1):
    with SessionLocal() as db:
        return db.scalar(select(Variant.stock).where(Variant.product_id == slug_id, Variant.size == size))


def place(client, items, **extra):
    return client.post("/api/orders", json={"items": items, "address": ADDRESS, "email": "priya@example.com", **extra})


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


def test_customers_cannot_cancel(customer):
    place(customer, [{"product_id": 1, "qty": 1}])
    assert customer.post("/api/me/orders/RB1001/cancel").status_code in (404, 405)


def test_email_required_at_checkout(customer):
    r = customer.post("/api/orders", json={"items": [{"product_id": 1, "qty": 1}], "address": ADDRESS})
    assert r.status_code == 422


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
    r = admin.post(f"/api/admin/orders/{oid}/status", json={"status": "delivered"})
    assert r.json()["payment_status"] == "paid"


def test_admin_cancel_restocks(customer, admin):
    place(customer, [{"product_id": 1, "qty": 2}])
    oid = admin.get("/api/admin/orders").json()[0]["id"]
    admin.post(f"/api/admin/orders/{oid}/status", json={"status": "cancelled"})
    assert stock() == 2


def test_admin_routes_need_admin(customer):
    assert customer.get("/api/admin/dashboard").status_code == 403


def test_bad_pincode_gets_a_plain_message(customer):
    r = place(customer, [{"product_id": 1, "size": None, "qty": 1}], address={**ADDRESS, "pincode": "60001"})
    assert r.status_code == 422
    assert r.json()["detail"]["message"] == "Pincode should be 6 digits, like 600004."


def test_public_settings_include_contact_details(admin):
    body = {"free_ship_above": 5000, "ship_fee": 150, "low_stock_at": 2, "contact_phone": "9876500000",
            "contact_whatsapp": "9876500000", "contact_email": "hi@example.com", "contact_address": "Chennai", "contact_hours": "10–8"}
    assert admin.put("/api/admin/settings", json=body).status_code == 200
    assert admin.get("/api/settings").json()["contact_whatsapp"] == "9876500000"
    assert admin.put("/api/admin/settings", json={**body, "contact_phone": "12"}).status_code == 422


def test_product_search_matches_every_word(customer):
    names = lambda q: [p["slug"] for p in customer.get("/api/products", params={"q": q}).json()]  # noqa: E731
    assert names("banarasi") == ["yaman"]
    assert names("teal megh") == ["megh"]
    assert names("teal yaman") == []
    assert sorted(names("sarees")) == ["megh", "yaman"]


def test_sort_by_popularity_and_filter_fields(customer):
    slugs = lambda sort: [p["slug"] for p in customer.get("/api/products", params={"sort": sort}).json()]  # noqa: E731
    assert slugs("featured") == ["yaman", "megh"]
    assert place(customer, [{"product_id": 2, "size": "S", "qty": 1}]).status_code == 201
    assert slugs("popular") == ["megh", "yaman"]
    card = customer.get("/api/products").json()[0]
    assert {"color", "material", "work", "pattern", "occasions", "created_at"} <= card.keys()


def test_admin_saves_filter_fields(admin):
    p = admin.get("/api/admin/products").json()[0]
    body = {k: p[k] for k in ("name", "raga", "category_id", "mood", "price", "mrp", "tag", "swatch", "raga_note", "details", "care", "active")}
    body |= {"variants": p["variants"], "images": [i["url"] for i in p["images"]],
             "color": "Red", "material": "Banarasi silk", "work": "Zari", "pattern": "Brocade", "occasions": ["Wedding"]}
    assert admin.put(f"/api/admin/products/{p['id']}", json=body).status_code == 200
    saved = admin.get(f"/api/products/{p['slug']}").json()
    assert (saved["color"], saved["occasions"]) == ("Red", ["Wedding"])


def _notices(detail, kind):
    return {n["channel"]: n for n in detail["notifications"] if n["kind"] == kind}


def test_accept_records_customer_notices(customer, admin):
    place(customer, [{"product_id": 1, "qty": 1}])
    oid = admin.get("/api/admin/orders").json()[0]["id"]
    r = admin.post(f"/api/admin/orders/{oid}/status", json={"status": "confirmed"})
    n = _notices(r.json(), "accepted")
    assert n["whatsapp"]["status"] == "tap" and "wa.me/919876543210" in n["whatsapp"]["detail"]
    assert n["email"]["status"] == "logged"


def test_bulk_dispatch_ships_each_and_reports_failures(customer, admin):
    for items in ([{"product_id": 1, "qty": 1}], [{"product_id": 1, "qty": 1}], [{"product_id": 2, "size": "S", "qty": 1}]):
        assert place(customer, items).status_code == 201
    ids = sorted(o["id"] for o in admin.get("/api/admin/orders").json())
    admin.post(f"/api/admin/orders/{ids[2]}/status", json={"status": "cancelled"})
    r = admin.post("/api/admin/orders/dispatch", json={"items": [
        {"order_id": i, "courier": "DTDC", "tracking_id": f"D{i}"} for i in ids]})
    assert r.status_code == 200, r.text
    res = {x["order_id"]: x for x in r.json()}
    assert res[ids[0]]["ok"] and res[ids[1]]["ok"] and not res[ids[2]]["ok"]
    assert res[ids[2]]["error"] and res[ids[0]]["whatsapp_link"].startswith("https://wa.me/")
    for i in ids[:2]:
        o = admin.get(f"/api/admin/orders/{i}").json()
        assert o["status"] == "shipped" and o["tracking_id"] == f"D{i}"


def test_dispatch_twice_does_not_resend(customer, admin):
    place(customer, [{"product_id": 1, "qty": 1}])
    oid = admin.get("/api/admin/orders").json()[0]["id"]
    body = {"items": [{"order_id": oid, "courier": "DTDC", "tracking_id": "D1"}]}
    assert admin.post("/api/admin/orders/dispatch", json=body).json()[0]["ok"]
    again = admin.post("/api/admin/orders/dispatch", json=body).json()[0]
    assert not again["ok"]
    assert len(_notices(admin.get(f"/api/admin/orders/{oid}").json(), "shipped")) == 2


def test_settings_save_couriers(admin):
    s = admin.get("/api/admin/settings").json()
    s["couriers"] = [{"name": "DTDC", "track_url": "https://www.dtdc.in/tracking?awb={id}"}]
    assert admin.put("/api/admin/settings", json=s).status_code == 200
    assert admin.get("/api/admin/settings").json()["couriers"][0]["name"] == "DTDC"
    s["couriers"] = [{"name": "Bad", "track_url": "https://no-placeholder.example"}]
    assert admin.put("/api/admin/settings", json=s).status_code == 422
