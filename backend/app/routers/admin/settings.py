from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.deps import DB, Admin
from app.models import StoreSettings, User
from app.schemas.admin import AdminPhone, SettingsIn
from app.services.orders import store_settings

router = APIRouter()


@router.get("/settings")
def get_settings(_: Admin, db: DB):
    s = store_settings(db)
    return {k: getattr(s, k) or (0 if k in ("free_ship_above", "ship_fee", "low_stock_at") else "") for k in SettingsIn.model_fields}


@router.put("/settings")
def put_settings(body: SettingsIn, _: Admin, db: DB):
    s = db.get(StoreSettings, 1) or StoreSettings(id=1)
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.merge(s)
    db.commit()
    return body


@router.get("/admins")
def list_admins(me: Admin, db: DB):
    return [{"id": u.id, "phone": u.phone, "name": u.name, "is_you": u.id == me.id}
            for u in db.scalars(select(User).where(User.is_admin.is_(True)).order_by(User.id))]


@router.post("/admins", status_code=201)
def add_admin(body: AdminPhone, _: Admin, db: DB):
    phone = "+91" + body.phone
    user = db.scalar(select(User).where(User.phone == phone)) or User(phone=phone)
    user.is_admin = True
    db.add(user)
    db.commit()
    return {"ok": True}


@router.delete("/admins/{user_id}", status_code=204)
def remove_admin(user_id: int, me: Admin, db: DB):
    if user_id == me.id:
        raise HTTPException(409, {"message": "You can't remove yourself."})
    if u := db.get(User, user_id):
        u.is_admin = False
        db.commit()
