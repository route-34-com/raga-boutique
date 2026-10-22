import re

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.core.deps import DB, Admin
from app.models import Category, Product
from app.schemas.admin import CategoryIn, CategoryPatch, Reorder

router = APIRouter(prefix="/categories")


@router.get("")
def list_categories(_: Admin, db: DB):
    counts = dict(db.execute(select(Product.category_id, func.count()).group_by(Product.category_id)).all())
    return [{"id": c.id, "name": c.name, "sort": c.sort, "active": c.active, "products": counts.get(c.id, 0)}
            for c in db.scalars(select(Category).order_by(Category.sort))]


@router.post("", status_code=201)
def create_category(body: CategoryIn, _: Admin, db: DB):
    cid = re.sub(r"[^a-z0-9]+", "-", body.name.lower().replace("&", "and")).strip("-")
    if not cid or db.get(Category, cid):
        raise HTTPException(409, {"message": "That category already exists."})
    db.add(Category(id=cid, name=body.name, active=body.active, sort=(db.scalar(select(func.max(Category.sort))) or 0) + 1))
    db.commit()
    return {"id": cid}


@router.patch("/{cid}")
def update_category(cid: str, body: CategoryPatch, _: Admin, db: DB):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, {"message": "Category not found."})
    if body.name is not None:
        c.name = body.name
    if body.active is not None:
        c.active = body.active
    db.commit()
    return {"ok": True}


@router.post("/reorder")
def reorder(body: Reorder, _: Admin, db: DB):
    for i, cid in enumerate(body.ids):
        if c := db.get(Category, cid):
            c.sort = i
    db.commit()
    return {"ok": True}


@router.delete("/{cid}", status_code=204)
def delete_category(cid: str, _: Admin, db: DB):
    if db.scalar(select(func.count()).where(Product.category_id == cid)):
        raise HTTPException(409, {"message": "Move or delete this category's products first."})
    if c := db.get(Category, cid):
        db.delete(c)
        db.commit()
