from io import BytesIO

from PIL import Image


def jpeg_bytes():
    buf = BytesIO()
    Image.new("RGB", (2400, 3000), "pink").save(buf, "JPEG")
    return buf.getvalue()


def test_upload_create_and_adjust_stock(admin):
    r = admin.post("/api/admin/products/upload", files={"file": ("p.jpg", jpeg_bytes(), "image/jpeg")})
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    body = {"name": "Rani Pink Dupatta", "raga": "Kalyani", "category_id": "sarees", "price": 2400,
            "variants": [{"size": "ONE", "stock": 5}], "images": [url]}
    p = admin.post("/api/admin/products", json=body).json()
    assert p["slug"] == "kalyani" and p["total_stock"] == 5
    p = admin.post(f"/api/admin/products/{p['id']}/stock", json={"size": "ONE", "delta": -2}).json()
    assert p["total_stock"] == 3
    assert any(x["slug"] == "kalyani" for x in admin.get("/api/products").json())
    admin.patch(f"/api/admin/products/{p['id']}/active", json={"active": False})
    assert not any(x["slug"] == "kalyani" for x in admin.get("/api/products").json())


def test_mrp_below_price_rejected(admin):
    body = {"name": "X", "category_id": "sarees", "price": 2400, "mrp": 2000,
            "variants": [{"size": "ONE", "stock": 1}], "images": ["/uploads/products/x.jpg"]}
    assert admin.post("/api/admin/products", json=body).status_code == 422


def test_non_image_upload_rejected(admin):
    r = admin.post("/api/admin/products/upload", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 415
