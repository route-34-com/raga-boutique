from tests.conftest import ADDRESS


def buy_and_deliver(customer, admin, product_id=1):
    r = customer.post("/api/orders", json={"items": [{"product_id": product_id, "qty": 1}], "address": ADDRESS, "email": "priya@example.com"})
    assert r.status_code == 201, r.text
    oid = next(o["id"] for o in admin.get("/api/admin/orders").json() if o["order_no"] == r.json()["order_no"])
    admin.post(f"/api/admin/orders/{oid}/status", json={"status": "shipped", "courier": "DTDC", "tracking_id": "D1"})
    assert admin.post(f"/api/admin/orders/{oid}/status", json={"status": "delivered"}).status_code == 200


def review(client, rating=5, comment="Beautiful drape, colour exactly as shown.", product_id=1):
    return client.post("/api/me/reviews", json={"product_id": product_id, "rating": rating, "comment": comment})


def test_cannot_review_before_delivery(customer):
    customer.post("/api/orders", json={"items": [{"product_id": 1, "qty": 1}], "address": ADDRESS, "email": "priya@example.com"})
    r = review(customer)
    assert r.status_code == 403
    assert "delivered" in r.json()["detail"]["message"]


def test_buyer_review_shows_on_product(customer, admin):
    buy_and_deliver(customer, admin)
    assert review(customer).status_code == 201
    body = customer.get("/api/products/yaman/reviews").json()
    assert body["count"] == 1 and body["average"] == 5.0
    r = body["reviews"][0]
    assert r["name"] == "Priya" and r["city"] == "Madurai" and r["rating"] == 5 and "drape" in r["comment"]


def test_second_review_updates_the_first(customer, admin):
    buy_and_deliver(customer, admin)
    review(customer, 5)
    assert review(customer, 4, "Lovely, slightly lighter than expected.").status_code == 201
    body = customer.get("/api/products/yaman/reviews").json()
    assert body["count"] == 1 and body["average"] == 4.0
    assert customer.get("/api/me/reviews").json() == [{"product_id": 1, "rating": 4, "comment": "Lovely, slightly lighter than expected."}]


def test_rating_must_be_one_to_five(customer, admin):
    buy_and_deliver(customer, admin)
    assert review(customer, 6).status_code == 422
    assert review(customer, 0).status_code == 422


def test_home_reviews_include_product_and_shop_average(customer, admin):
    buy_and_deliver(customer, admin)
    review(customer, 4)
    body = customer.get("/api/reviews").json()
    assert body["count"] == 1 and body["average"] == 4.0
    assert body["reviews"][0]["product"]["slug"] == "yaman" and body["reviews"][0]["product"]["image"]


def test_admin_can_delete_a_review(customer, admin):
    buy_and_deliver(customer, admin)
    review(customer)
    assert customer.get("/api/admin/reviews").status_code == 403
    rows = admin.get("/api/admin/reviews").json()
    assert len(rows) == 1 and rows[0]["product"]["name"] == "Aubergine Banarasi" and rows[0]["phone"] == "+919876543210"
    assert admin.delete(f"/api/admin/reviews/{rows[0]['id']}").status_code == 204
    assert customer.get("/api/products/yaman/reviews").json()["count"] == 0


def test_best_reviews_come_first(customer, admin):
    from app.core.db import SessionLocal
    from app.models import Review, User
    with SessionLocal() as db:
        for i, stars in enumerate([3, 5, 4]):
            u = User(phone=f"+91900000020{i}", name=f"R{i}")
            db.add(u)
            db.flush()
            db.add(Review(product_id=1, user_id=u.id, rating=stars, comment="", name=f"R{i}", city=""))
        db.commit()
    assert [r["rating"] for r in customer.get("/api/reviews").json()["reviews"]] == [5, 4, 3]
    assert [r["rating"] for r in customer.get("/api/products/yaman/reviews").json()["reviews"]] == [5, 4, 3]
    assert [r["rating"] for r in admin.get("/api/admin/reviews").json()] == [4, 5, 3]  # admin: newest first
