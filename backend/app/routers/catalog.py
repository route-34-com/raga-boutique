from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import DB
from app.models import Category, Order, OrderItem, Product
from app.schemas.catalog import CategoryOut, ProductCard, ProductDetail, PublicSettings
from app.services.orders import store_settings

router = APIRouter(prefix="/api", tags=["catalog"])
LOAD = (selectinload(Product.images), selectinload(Product.variants))


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: DB):
    return db.scalars(select(Category).where(Category.active.is_(True)).order_by(Category.sort)).all()


@router.get("/products", response_model=list[ProductCard])
def products(db: DB, cat: str | None = None, mood: str | None = None,
             sort: Literal["featured", "popular", "new", "discount", "low", "high"] = "featured",
             q: Annotated[str | None, Query(max_length=80)] = None):
    query = select(Product).join(Category).where(Product.active.is_(True), Category.active.is_(True)).options(*LOAD)
    if cat:
        query = query.where(Product.category_id == cat)
    if mood:
        query = query.where(Product.mood == mood)
    # Every word must match somewhere: "red silk" finds red pieces that are also silk.
    for word in (q or "").split()[:6]:
        like = f"%{word}%"
        query = query.where(or_(Product.name.ilike(like), Product.raga.ilike(like), Product.mood.ilike(like),
                                Product.tag.ilike(like), Category.name.ilike(like)))
    if sort == "popular":
        # Units ordered, cancelled orders excluded; never-ordered pieces fall back to the shop's own order.
        sold = (select(OrderItem.product_id, func.sum(OrderItem.qty).label("units")).join(Order)
                .where(Order.status != "cancelled").group_by(OrderItem.product_id).subquery())
        query = query.outerjoin(sold, sold.c.product_id == Product.id)
        order = (func.coalesce(sold.c.units, 0).desc(), Product.sort, Product.id)
    elif sort == "discount":
        saving = case((Product.mrp > Product.price, (Product.mrp - Product.price) * 1.0 / Product.mrp), else_=0)
        order = (saving.desc(), Product.sort)
    else:
        order = {"featured": (Product.sort, Product.id), "new": (Product.created_at.desc(), Product.id.desc()),
                 "low": (Product.price,), "high": (Product.price.desc(),)}[sort]
    return db.scalars(query.order_by(*order)).all()


@router.get("/products/{slug}", response_model=ProductDetail)
def product(slug: str, db: DB):
    p = db.scalar(select(Product).where(Product.slug == slug, Product.active.is_(True)).options(*LOAD))
    if not p:
        raise HTTPException(404, {"message": "Product not found."})
    return p


@router.get("/settings", response_model=PublicSettings)
def public_settings(db: DB):
    return store_settings(db)
