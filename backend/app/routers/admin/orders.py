from fastapi import APIRouter, HTTPException
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, Admin
from app.core.errors import ServiceError
from app.models import Order
from app.models.order import ONGOING
from app.schemas.admin import AdminOrderRow, StatusChange
from app.schemas.order import OrderDetail
from app.services import orders as svc

router = APIRouter(prefix="/orders")


@router.get("", response_model=list[AdminOrderRow])
def list_orders(_: Admin, db: DB, status: str = "all", q: str = "", user_id: int | None = None):
    query = select(Order).options(selectinload(Order.items)).order_by(Order.id.desc()).limit(300)
    if status == "ongoing":
        query = query.where(Order.status.in_(ONGOING))
    elif status != "all":
        query = query.where(Order.status == status)
    if user_id:
        query = query.where(Order.user_id == user_id)
    if q := q.strip():
        like = f"%{q}%"
        query = query.where(or_(("RB" + cast(Order.seq, String)).ilike(like), Order.phone.ilike(like),
                                Order.customer_name.ilike(like), cast(Order.address["pincode"], String).ilike(like)))
    return db.scalars(query).all()


@router.get("/counts")
def counts(_: Admin, db: DB):
    from sqlalchemy import func
    rows = dict(db.execute(select(Order.status, func.count()).group_by(Order.status)).all())
    return {**rows, "all": sum(rows.values()), "ongoing": sum(rows.get(s, 0) for s in ONGOING)}


def _load(db, order_id: int) -> Order:
    o = db.scalar(select(Order).where(Order.id == order_id).options(selectinload(Order.items), selectinload(Order.events)))
    if not o:
        raise HTTPException(404, {"message": "Order not found."})
    return o


@router.get("/{order_id}", response_model=OrderDetail)
def get_order(order_id: int, _: Admin, db: DB):
    return _load(db, order_id)


@router.post("/{order_id}/status", response_model=OrderDetail)
def change_status(order_id: int, body: StatusChange, _: Admin, db: DB):
    try:
        svc.set_status(db, order_id, body.status, body.note, body.courier, body.tracking_id)
    except ServiceError as e:
        raise e.http() from None
    db.expire_all()
    return _load(db, order_id)
