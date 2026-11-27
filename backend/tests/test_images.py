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
    small = admin.get(f"{stem}.w480.webp")
    assert small.headers["content-type"] == "image/webp" and size(small.content) == (480, 600)
    assert size(admin.get(f"{stem}.w960.webp").content) == (960, 1200)
    assert size(admin.get(f"{stem}.w480.jpg").content) == (480, 600)  # older links still work


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


def test_copy_of_a_static_demo_photo_is_made_from_the_site_copy(monkeypatch):
    from types import SimpleNamespace

    from app.services import images

    calls = []
    monkeypatch.setattr(get_settings(), "image_store", "db")
    monkeypatch.setattr(
        images.httpx,
        "get",
        lambda url, timeout: (
            calls.append(url)
            or SimpleNamespace(status_code=200, headers={"content-type": "image/jpeg"}, content=jpeg(1000, 1250))
        ),
    )
    data = images.load_or_make_variant("static-demo.w480.jpg")
    assert size(data) == (480, 600)
    assert calls == ["http://localhost:5173/uploads/products/static-demo.jpg"]
    assert images.load_or_make_variant("static-demo.w480.jpg") == data and len(calls) == 1


def test_webp_copy_is_made_on_request_and_is_smaller_than_jpeg():
    from PIL import ImageDraw

    img = Image.new("RGB", (1200, 1500), "white")
    d = ImageDraw.Draw(img)
    for i in range(0, 1200, 7):
        d.line((i, 0, 1200 - i, 1500), fill=(i % 255, 90, 160), width=3)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=90)
    store_image_file("busy-piece.jpg", buf.getvalue())
    c = TestClient(app)
    webp, jpg = c.get("/uploads/products/busy-piece.w480.webp"), c.get("/uploads/products/busy-piece.w480.jpg")
    assert webp.status_code == jpg.status_code == 200
    assert webp.headers["content-type"] == "image/webp" and len(webp.content) < len(jpg.content)
