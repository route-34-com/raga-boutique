import secrets

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, CurrentUser
from app.core.errors import ServiceError
from app.models import Order, Review
from app.schemas.account import AddressOut, PlaceOrderIn, ProfileIn, UserOut
from app.schemas.order import OrderDetail, OrderPlaced, OrderSummary, PaymentDone, UpiPaidIn
from app.services import payments
from app.schemas.review import MyReview, ReviewIn
from app.services import orders as svc
from app.services import reviews

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
    return OrderPlaced(order_no=order.order_no, total=order.total,
                       payment=payments.checkout_options(order) if order.payment_method == "online" else None)


@router.get("/me/orders", response_model=list[OrderSummary])
def my_orders(user: CurrentUser, db: DB):
    svc.release_unpaid(db)
    return db.scalars(select(Order).where(Order.user_id == user.id).options(selectinload(Order.items)).order_by(Order.id.desc())).all()


@router.get("/me/orders/{order_no}", response_model=OrderDetail)
def my_order(order_no: str, user: CurrentUser, db: DB):
    return _own_order(db, user, order_no)


def _payable(db, user, order_no: str) -> Order:
    o = _own_order(db, user, order_no)
    if o.payment_method != "online" or not o.gateway_order_id:
        raise HTTPException(409, {"message": "This order isn't paid online."})
    if o.status == "cancelled" and o.payment_status == "pending":
        raise HTTPException(409, {"message": "This order was cancelled because it wasn't paid in time. Please order again."})
    return o


@router.get("/me/orders/{order_no}/pay")
def pay_options(order_no: str, user: CurrentUser, db: DB):
    svc.release_unpaid(db)
    o = _payable(db, user, order_no)
    if o.payment_status != "pending":
        raise HTTPException(409, {"message": "This order is already paid."})
    return payments.checkout_options(o)


@router.post("/me/orders/{order_no}/pay/verify", response_model=OrderDetail)
def pay_verify(order_no: str, body: PaymentDone, user: CurrentUser, db: DB):
    o = _payable(db, user, order_no)
    if body.razorpay_order_id != o.gateway_order_id or not payments.signature_ok(o.gateway_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise HTTPException(400, {"message": "We couldn't confirm this payment. If money was taken, it will show here within a few minutes."})
    try:
        svc.mark_paid_online(db, o, body.razorpay_payment_id, "checkout")
    except ServiceError as e:
        raise e.http() from None
    db.expire_all()
    return _own_order(db, user, order_no)


@router.post("/me/orders/{order_no}/pay/demo", response_model=OrderDetail)
def pay_demo(order_no: str, user: CurrentUser, db: DB):
    if payments.provider() != "demo":
        raise HTTPException(404, {"message": "Not found."})
    o = _payable(db, user, order_no)
    svc.mark_paid_online(db, o, f"pay_demo_{secrets.token_hex(7)}", "checkout")
    db.expire_all()
    return _own_order(db, user, order_no)


@router.post("/me/orders/{order_no}/upi-paid", response_model=OrderDetail)
def upi_paid(order_no: str, body: UpiPaidIn, user: CurrentUser, db: DB):
    try:
        svc.upi_paid(db, _own_order(db, user, order_no), body.ref)
    except ServiceError as e:
        raise e.http() from None
    db.expire_all()
    return _own_order(db, user, order_no)


@router.get("/me/reviews", response_model=list[MyReview])
def my_reviews(user: CurrentUser, db: DB):
    return db.scalars(select(Review).where(Review.user_id == user.id).order_by(Review.id)).all()


@router.post("/me/reviews", response_model=MyReview, status_code=201)
def write_review(body: ReviewIn, user: CurrentUser, db: DB):
    try:
        return reviews.save(db, user, body)
    except ServiceError as e:
        raise e.http() from None
