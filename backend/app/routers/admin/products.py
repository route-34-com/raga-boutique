import re

from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, Admin
from app.core.errors import ServiceError
from app.models import Category, Product, ProductImage, Variant
from app.routers.admin.common import AdminProduct, product_out
from app.schemas.admin import ActiveToggle, ProductIn, StockAdjust
from app.services.images import delete_product_image, save_product_image

router = APIRouter(prefix="/products")
LOAD = (selectinload(Product.images), selectinload(Product.variants))


def _get(db, product_id: int) -> Product:
    p = db.scalar(select(Product).where(Product.id == product_id).options(*LOAD))
    if not p:
        raise HTTPException(404, {"message": "Product not found."})
    return p


def _slug(db, name: str, raga: str, exclude_id: int | None = None) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (raga or name).lower()).strip("-") or "piece"
    slug, n = base, 2
    while (p := db.scalar(select(Product).where(Product.slug == slug))) and p.id != exclude_id:
        slug, n = f"{base}-{n}", n + 1
    return slug


def _apply(db, p: Product, body: ProductIn) -> None:
    if not db.get(Category, body.category_id):
        raise HTTPException(422, {"message": "Pick a valid category."})
    if body.mrp and body.mrp < body.price:
        raise HTTPException(422, {"message": "MRP should be higher than the selling price (or leave it empty)."})
    sizes = [v.size.upper() for v in body.variants]
    if len(set(sizes)) != len(sizes):
        raise HTTPException(422, {"message": "Each size can only be listed once."})
    for field in ("name", "raga", "category_id", "mood", "price", "mrp", "tag", "swatch", "raga_note", "details", "care", "active",
                  "color", "material", "work", "pattern", "occasions"):
        setattr(p, field, getattr(body, field))

    # Variants: update in place so stock history isn't lost for sizes that stay.
    existing = {v.size: v for v in p.variants}
    keep = []
    for i, v in enumerate(body.variants):
        var = existing.get(v.size.upper()) or Variant(size=v.size.upper())
        var.stock, var.sort = v.stock, i
        keep.append(var)
    p.variants = keep

    old_urls = {im.url for im in p.images}
    p.images = [ProductImage(url=u, position=i) for i, u in enumerate(body.images)]
    for url in old_urls - set(body.images):
        delete_product_image(url)


@router.get("", response_model=list[AdminProduct])
def list_products(_: Admin, db: DB):
    return [product_out(p) for p in db.scalars(select(Product).options(*LOAD).order_by(Product.sort, Product.id))]


@router.post("", response_model=AdminProduct, status_code=201)
def create_product(body: ProductIn, _: Admin, db: DB):
    p = Product(slug=_slug(db, body.name, body.raga), sort=(db.scalar(select(func.max(Product.sort))) or 0) + 1)
    db.add(p)
    _apply(db, p, body)
    db.commit()
    return product_out(_get(db, p.id))


@router.put("/{product_id}", response_model=AdminProduct)
def update_product(product_id: int, body: ProductIn, _: Admin, db: DB):
    p = _get(db, product_id)
    _apply(db, p, body)
    db.commit()
    return product_out(_get(db, product_id))


@router.patch("/{product_id}/active", response_model=AdminProduct)
def toggle_active(product_id: int, body: ActiveToggle, _: Admin, db: DB):
    p = _get(db, product_id)
    p.active = body.active
    db.commit()
    return product_out(p)


@router.post("/{product_id}/stock", response_model=AdminProduct)
def adjust_stock(product_id: int, body: StockAdjust, _: Admin, db: DB):
    v = db.scalar(select(Variant).where(Variant.product_id == product_id, Variant.size == body.size).with_for_update())
    if not v:
        raise HTTPException(404, {"message": "Size not found."})
    v.stock = max(0, v.stock + body.delta)
    db.commit()
    return product_out(_get(db, product_id))


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, _: Admin, db: DB):
    p = _get(db, product_id)
    urls = [im.url for im in p.images]
    db.delete(p)  # past orders keep their own copy of name, price and photo
    db.commit()
    for u in urls:
        delete_product_image(u)


@router.post("/upload")
async def upload_image(file: UploadFile, _: Admin):
    try:
        return {"url": save_product_image(await file.read())}
    except ServiceError as e:
        raise e.http() from None
