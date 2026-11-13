from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import login


def super_admin(mobile: str = "9344780554") -> TestClient:
    return login(TestClient(app), mobile)


def test_super_admin_opens_the_panel_on_first_login():
    c = super_admin()
    assert c.get("/api/auth/me").json()["is_admin"] is True
    assert c.get("/api/admin/settings").status_code == 200
    rows = c.get("/api/admin/admins").json()
    assert any(r["is_you"] and r["is_super"] for r in rows)


def test_only_super_admins_add_and_remove_admins(admin):
    assert admin.post("/api/admin/admins", json={"phone": "9123456789"}).status_code == 403
    c = super_admin()
    assert c.post("/api/admin/admins", json={"phone": "9123456789"}).status_code == 201
    rows = c.get("/api/admin/admins").json()
    staff = next(r for r in rows if r["phone"] == "+919123456789")
    assert staff["is_super"] is False
    assert admin.delete(f"/api/admin/admins/{staff['id']}").status_code == 403
    assert c.delete(f"/api/admin/admins/{staff['id']}").status_code == 204
    assert all(r["phone"] != "+919123456789" for r in c.get("/api/admin/admins").json())


def test_super_admins_cannot_be_removed():
    first, second = super_admin("9344780554"), super_admin("8248785648")
    other = next(r for r in first.get("/api/admin/admins").json() if r["phone"] == "+918248785648")
    r = first.delete(f"/api/admin/admins/{other['id']}")
    assert r.status_code == 409
    assert second.get("/api/admin/settings").status_code == 200
