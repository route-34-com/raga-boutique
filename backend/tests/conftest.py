import os
import tempfile

os.environ["DATABASE_URL"] = "postgresql+psycopg://raga:raga_dev@127.0.0.1:5432/raga_test"
os.environ["OTP_PROVIDER"] = "console"
os.environ["OTP_RESEND_SECONDS"] = "0"
os.environ["UPLOADS_DIR"] = tempfile.mkdtemp(prefix="raga-test-uploads-")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ONE_SIZE, Category, Product, ProductImage, StoreSettings, User, Variant  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    with engine.begin() as c:
        c.execute(text("DROP SEQUENCE IF EXISTS order_no_seq"))
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add(Category(id="sarees", name="Sarees"))
        db.add(StoreSettings(id=1))
        db.add(Product(slug="yaman", name="Aubergine Banarasi", raga="Yaman", category_id="sarees", price=11800,
                       images=[ProductImage(url="/uploads/products/x.jpg")], variants=[Variant(size=ONE_SIZE, stock=2)]))
        db.add(Product(slug="megh", name="Teal Maxi", raga="Megh", category_id="sarees", price=4650,
                       images=[ProductImage(url="/uploads/products/y.jpg")],
                       variants=[Variant(size="S", stock=1), Variant(size="M", stock=0)]))
        db.add(User(phone="+919000000001", is_admin=True))
        db.commit()
    yield


def login(client: TestClient, mobile: str) -> TestClient:
    r = client.post("/api/auth/otp", json={"phone": mobile})
    assert r.status_code == 200, r.text
    r = client.post("/api/auth/verify", json={"phone": mobile, "code": r.json()["dev_code"]})
    assert r.status_code == 200, r.text
    return client


@pytest.fixture
def customer():
    return login(TestClient(app), "9876543210")


@pytest.fixture
def admin():
    return login(TestClient(app), "9000000001")


ADDRESS = {"name": "Priya Raman", "phone": "9876543210", "line1": "22 Gandhi Road", "city": "Madurai",
           "state": "Tamil Nadu", "pincode": "625001"}
