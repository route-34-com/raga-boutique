from datetime import datetime, time
from zoneinfo import ZoneInfo

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, Admin
from app.models import Order, Product, Variant
from app.routers.admin.common import product_out
from app.schemas.admin import AdminOrderRow
from app.services.orders import store_settings

router = APIRouter()
IST = ZoneInfo("Asia/Kolkata")


@router.get("/dashboard")
def dashboard(_: Admin, db: DB):
    now = datetime.now(IST)
    start_today = datetime.combine(now.date(), time.min, IST)
    start_month = start_today.replace(day=1)
    live = Order.status != "cancelled"

    def agg(since):
        n, total = db.execute(select(func.count(), func.coalesce(func.sum(Order.total), 0)).where(live, Order.created_at >= since)).one()
        return {"count": n, "total": total}

    by_status = dict(db.execute(select(Order.status, func.count()).group_by(Order.status)).all())
    cod_due = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(live, Order.payment_method == "cod", Order.payment_status != "paid"))
    low_at = store_settings(db).low_stock_at
    low_ids = select(Variant.product_id).where(Variant.stock <= low_at)
    low = db.scalars(select(Product).where(Product.active.is_(True), Product.id.in_(low_ids))
                     .options(selectinload(Product.images), selectinload(Product.variants)).order_by(Product.sort)).all()
    action = db.scalars(select(Order).where(Order.status.in_(["placed", "confirmed", "packed"])).options(selectinload(Order.items))
                        .order_by(Order.id).limit(10)).all()
    recent = db.scalars(select(Order).options(selectinload(Order.items)).order_by(Order.id.desc()).limit(8)).all()

    return {
        "today": agg(start_today),
        "month": agg(start_month),
        "by_status": by_status,
        "cod_due": cod_due,
        "low_stock_at": low_at,
        "low_stock": [product_out(p) for p in low],
        "needs_action": [AdminOrderRow.model_validate(o) for o in action],
        "recent": [AdminOrderRow.model_validate(o) for o in recent],
    }
