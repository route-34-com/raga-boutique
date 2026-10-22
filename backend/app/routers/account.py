from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, CurrentUser
from app.core.errors import ServiceError
from app.models import Order
from app.schemas.account import AddressOut, PlaceOrderIn, ProfileIn, UserOut
from app.schemas.order import OrderDetail, OrderPlaced, OrderSummary
from app.services import orders as svc

router = APIRouter(prefix="/api", tags=["account"])


def _order_no(order_no: str) -> int:
    if not order_no.upper().startswith("RB") or not order_no[2:].isdigit():
        raise HTTPException(404, {"message": "Order not found."})
    return int(order_no[2:])


def _own_order(db, user, order_no: str) -> Order:
    o = db.scalar(select(Order).where(Order.seq == _order_no(order_no), Order.user_id == user.id)
                  .options(selectinload(Order.items), selectinload(Order.events)))
    if not o:
        raise HTTPException(404, {"message": "Order not found."})
    return o


@router.patch("/me", response_model=UserOut)
def update_profile(body: ProfileIn, user: CurrentUser, db: DB):
    user.name = body.name
    user.email = str(body.email or "")
    db.commit()
    return user


@router.get("/me/addresses", response_model=list[AddressOut])
def addresses(user: CurrentUser):
    return user.addresses


@router.post("/orders", response_model=OrderPlaced, status_code=201)
def place_order(body: PlaceOrderIn, user: CurrentUser, db: DB):
    try:
        order = svc.place_order(db, user, body)
    except ServiceError as e:
        raise e.http() from None
    return OrderPlaced(order_no=order.order_no, total=order.total)


@router.get("/me/orders", response_model=list[OrderSummary])
def my_orders(user: CurrentUser, db: DB):
    return db.scalars(select(Order).where(Order.user_id == user.id).options(selectinload(Order.items)).order_by(Order.id.desc())).all()


@router.get("/me/orders/{order_no}", response_model=OrderDetail)
def my_order(order_no: str, user: CurrentUser, db: DB):
    return _own_order(db, user, order_no)
