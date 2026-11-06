from datetime import date

from tests.test_orders import place, stock

TODAY = date.today().isoformat()
MONTH = TODAY[:7]


def buy(admin, **kw):
    body = {"bought_on": TODAY, "supplier": "Kanchi Weavers", "product_id": 1, "qty": 3, "unit_cost": 7000} | kw
    return admin.post("/api/admin/purchases", json=body)


def test_business_pages_are_admin_only(customer):
    for path in ("/api/admin/business", "/api/admin/purchases", "/api/admin/expenses", "/api/admin/staff"):
        assert customer.get(path).status_code == 403


def test_purchase_raises_stock_and_delete_takes_it_back(admin):
    r = buy(admin)
    assert r.status_code == 201, r.text
    assert r.json()["item_name"] == "Aubergine Banarasi"
    assert stock() == 5
    assert admin.delete(f"/api/admin/purchases/{r.json()['id']}").status_code == 204
    assert stock() == 2


def test_purchase_needs_a_real_size(admin):
    r = buy(admin, product_id=2, size="XL")
    assert r.status_code == 400 and "no size XL" in r.json()["detail"]["message"]
    assert buy(admin, product_id=2, size="S").status_code == 201
    assert stock("S", 2) == 4


def test_purchase_without_a_product_keeps_stock_alone(admin):
    r = buy(admin, product_id=None, item_name="Blouse lining roll", qty=1, unit_cost=900)
    assert r.status_code == 201 and r.json()["product_id"] is None


def test_monthly_profit(admin, customer):
    buy(admin, qty=2, unit_cost=6000)
    buy(admin, qty=2, unit_cost=8000)
    assert place(customer, [{"product_id": 1, "qty": 1}]).status_code == 201
    admin.post("/api/admin/expenses", json={"spent_on": TODAY, "category": "Rent", "amount": 1500})
    s = admin.post("/api/admin/staff", json={"name": "Kala", "monthly_salary": 12000}).json()
    admin.post(f"/api/admin/staff/{s['id']}/salary", json={"month": MONTH, "paid": 12000, "paid_on": TODAY})

    b = admin.get(f"/api/admin/business?month={MONTH}").json()
    assert b["sales"] == 11800 and b["orders"] == 1
    assert b["cogs"] == 7000  # average of 6000 and 8000
    assert b["gross_profit"] == 4800
    assert b["purchases"] == 28000
    assert b["expenses"] == 1500 and b["salaries"] == 12000
    assert b["net_profit"] == 4800 - 1500 - 12000
    assert b["top"][0]["profit"] == 4800
    assert len(b["trend"]) == 6 and b["trend"][-1]["month"] == MONTH


def test_sales_without_a_cost_are_kept_apart(admin, customer):
    place(customer, [{"product_id": 1, "qty": 1}])
    b = admin.get(f"/api/admin/business?month={MONTH}").json()
    assert b["cogs"] == 0 and b["gross_profit"] == 0 and b["uncosted_sales"] == 11800


def test_expense_category_is_checked(admin):
    r = admin.post("/api/admin/expenses", json={"spent_on": TODAY, "category": "Holiday", "amount": 10})
    assert r.status_code == 422
    assert "Rent" in admin.get("/api/admin/expenses").json()["categories"]


def test_salary_cuts_unpaid_leave_and_advance(admin):
    s = admin.post("/api/admin/staff", json={"name": "Meena", "role": "Sales", "monthly_salary": 15000}).json()
    sid = s["id"]
    admin.post(f"/api/admin/staff/{sid}/leaves", json={"on": TODAY, "days": 1})
    admin.post(f"/api/admin/staff/{sid}/leaves", json={"on": TODAY, "days": 0.5})
    admin.post(f"/api/admin/staff/{sid}/leaves", json={"on": TODAY, "days": 1, "paid": True})
    r = admin.post(f"/api/admin/staff/{sid}/advances", json={"given_on": TODAY, "amount": 3000})
    assert r.json()["advance_owed"] == 3000

    p = admin.get(f"/api/admin/staff/{sid}/salary?month={MONTH}").json()
    assert p["unpaid_leave_days"] == 1.5 and p["paid_leave_days"] == 1
    assert p["leave_cut"] == 750
    assert p["advance_cut"] == 3000 and p["to_pay"] == 15000 - 750 - 3000

    r = admin.post(f"/api/admin/staff/{sid}/salary", json={"month": MONTH, "leave_cut": 750, "advance_cut": 1000,
                                                             "paid": 13250, "paid_on": TODAY})
    assert r.status_code == 201 and r.json()["advance_owed"] == 2000
    again = admin.post(f"/api/admin/staff/{sid}/salary", json={"month": MONTH, "paid": 1, "paid_on": TODAY})
    assert again.status_code == 409


def test_advance_cut_cannot_exceed_what_is_owed(admin):
    sid = admin.post("/api/admin/staff", json={"name": "Ravi", "monthly_salary": 9000}).json()["id"]
    r = admin.post(f"/api/admin/staff/{sid}/salary", json={"month": MONTH, "advance_cut": 500, "paid": 8500, "paid_on": TODAY})
    assert r.status_code == 400


def test_deleting_a_salary_entry_restores_the_advance(admin):
    sid = admin.post("/api/admin/staff", json={"name": "Devi", "monthly_salary": 10000}).json()["id"]
    admin.post(f"/api/admin/staff/{sid}/advances", json={"given_on": TODAY, "amount": 2000})
    staff = admin.post(f"/api/admin/staff/{sid}/salary", json={"month": MONTH, "advance_cut": 2000, "paid": 8000, "paid_on": TODAY}).json()
    assert staff["advance_owed"] == 0
    staff = admin.delete(f"/api/admin/staff/{sid}/salary/{staff['payments'][0]['id']}").json()
    assert staff["advance_owed"] == 2000 and staff["payments"] == []
