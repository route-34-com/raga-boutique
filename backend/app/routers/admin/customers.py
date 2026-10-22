from fastapi import APIRouter
from sqlalchemy import case, func, or_, select

from app.core.deps import DB, Admin
from app.models import Order, User

router = APIRouter(prefix="/customers")


@router.get("")
def list_customers(_: Admin, db: DB, q: str = ""):
    live_total = func.coalesce(func.sum(case((Order.status != "cancelled", Order.total), else_=0)), 0)
    query = (select(User, func.count(Order.id), live_total, func.max(Order.created_at))
             .outerjoin(Order, Order.user_id == User.id).group_by(User.id)
             .order_by(func.max(Order.created_at).desc().nulls_last(), User.id.desc()).limit(500))
    if q := q.strip():
        like = f"%{q}%"
        query = query.where(or_(User.name.ilike(like), User.phone.ilike(like), User.email.ilike(like)))
    return [{"id": u.id, "name": u.name, "phone": u.phone, "email": u.email, "is_admin": u.is_admin,
             "orders": n, "spent": spent, "last_order_at": last, "joined_at": u.created_at}
            for u, n, spent, last in db.execute(query).all()]
