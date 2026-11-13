from tests.test_orders import place

SETTINGS = {"free_ship_above": 5000, "ship_fee": 150, "low_stock_at": 2}


def set_upi(admin, upi_id="raga@okhdfcbank", upi_name="Raga Boutique"):
    return admin.put("/api/admin/settings", json={**SETTINGS, "upi_id": upi_id, "upi_name": upi_name})


def test_upi_is_refused_until_the_shop_sets_a_upi_id(customer):
    r = place(customer, [{"product_id": 1, "qty": 1}], payment_method="upi")
    assert r.status_code == 400 and "UPI payment isn't set up" in r.text


def test_settings_validate_and_publish_the_upi_id(admin):
    assert set_upi(admin, "not a upi id").status_code == 422
    assert set_upi(admin).status_code == 200
    s = admin.get("/api/settings").json()
    assert (s["upi_id"], s["upi_name"]) == ("raga@okhdfcbank", "Raga Boutique")


def test_customer_marks_paid_then_admin_confirms(customer, admin):
    set_upi(admin)
    no = place(customer, [{"product_id": 1, "qty": 1}], payment_method="upi").json()["order_no"]
    o = customer.get(f"/api/me/orders/{no}").json()
    assert (o["payment_method"], o["payment_status"]) == ("upi", "pending")

    assert customer.post(f"/api/me/orders/{no}/upi-paid", json={"ref": "bad ref!"}).status_code == 422
    o = customer.post(f"/api/me/orders/{no}/upi-paid", json={"ref": "431298765012"}).json()
    assert (o["payment_status"], o["payment_ref"]) == ("claimed", "431298765012")

    row = admin.get("/api/admin/orders").json()[0]
    assert (row["payment_status"], row["payment_ref"]) == ("claimed", "431298765012")
    o = admin.post(f"/api/admin/orders/{row['id']}/payment-received").json()
    assert o["payment_status"] == "paid"
    assert o["events"][-1]["note"] == "Payment received"


def test_upi_paid_only_for_upi_orders(customer):
    no = place(customer, [{"product_id": 1, "qty": 1}]).json()["order_no"]
    assert customer.post(f"/api/me/orders/{no}/upi-paid", json={}).status_code == 409


def test_delivery_does_not_mark_an_unpaid_upi_order_paid(customer, admin):
    set_upi(admin)
    place(customer, [{"product_id": 1, "qty": 1}], payment_method="upi")
    oid = admin.get("/api/admin/orders").json()[0]["id"]
    for s in ("confirmed", "packed"):
        admin.post(f"/api/admin/orders/{oid}/status", json={"status": s})
    admin.post(f"/api/admin/orders/{oid}/status", json={"status": "shipped", "courier": "DTDC", "tracking_id": "D1"})
    o = admin.post(f"/api/admin/orders/{oid}/status", json={"status": "delivered"}).json()
    assert o["payment_status"] == "pending"
