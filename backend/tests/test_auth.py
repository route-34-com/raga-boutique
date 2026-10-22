from fastapi.testclient import TestClient

from app.main import app


def test_wrong_code_then_lockout():
    c = TestClient(app)
    c.post("/api/auth/otp", json={"phone": "9876543210"})
    for _ in range(5):
        assert c.post("/api/auth/verify", json={"phone": "9876543210", "code": "000000"}).status_code in (400, 429)
    r = c.post("/api/auth/verify", json={"phone": "9876543210", "code": "000000"})
    assert r.status_code == 429


def test_login_sets_session_and_me():
    c = TestClient(app)
    code = c.post("/api/auth/otp", json={"phone": "9876543210"}).json()["dev_code"]
    assert c.post("/api/auth/verify", json={"phone": "9876543210", "code": code}).json()["phone"] == "+919876543210"
    assert c.get("/api/auth/me").json()["phone"] == "+919876543210"
    c.post("/api/auth/logout")
    assert c.get("/api/auth/me").json() is None


def test_code_cannot_be_reused():
    c = TestClient(app)
    code = c.post("/api/auth/otp", json={"phone": "9876543210"}).json()["dev_code"]
    assert c.post("/api/auth/verify", json={"phone": "9876543210", "code": code}).status_code == 200
    assert c.post("/api/auth/verify", json={"phone": "9876543210", "code": code}).status_code == 400


def test_invalid_mobile_rejected():
    assert TestClient(app).post("/api/auth/otp", json={"phone": "12345"}).status_code == 422
