from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import get_settings
from app.main import app
from app.services.images import store_image_file


def jpeg(w: int, h: int) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (w, h), "teal").save(buf, "JPEG")
    return buf.getvalue()


def size(data: bytes) -> tuple[int, int]:
    return Image.open(BytesIO(data)).size


def test_upload_makes_small_copies(admin):
    url = admin.post("/api/admin/products/upload", files={"file": ("p.jpg", jpeg(2400, 3000), "image/jpeg")}).json()[
        "url"
    ]
    stem = url.removesuffix(".jpg")
    assert size(admin.get(url).content) == (1280, 1600)
    assert size(admin.get(f"{stem}.w480.jpg").content) == (480, 600)
    assert size(admin.get(f"{stem}.w960.jpg").content) == (960, 1200)


def test_missing_copy_is_made_from_the_original_and_kept():
    store_image_file("seeded-piece.jpg", jpeg(1200, 1500))
    r = TestClient(app).get("/uploads/products/seeded-piece.w480.jpg")
    assert r.status_code == 200 and size(r.content) == (480, 600)
    assert "immutable" in r.headers["cache-control"]
    assert (get_settings().uploads_dir / "products" / "seeded-piece.w480.jpg").is_file()


def test_unknown_or_unsafe_names_are_404():
    c = TestClient(app)
    assert c.get("/uploads/products/nothing.w480.jpg").status_code == 404
    assert c.get("/uploads/products/nothing.w123.jpg").status_code == 404
    assert c.get("/uploads/products/..%2F..%2Fsecret.jpg").status_code == 404
