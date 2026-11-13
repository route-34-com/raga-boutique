"""Order rules. Prices and stock always come from the database, never from the browser."""

from collections import OrderedDict
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import ServiceError
from app.models import ONE_SIZE, Address, Order, OrderEvent, OrderItem, Product, StoreSettings, User, Variant
from app.models.order import ORDER_FLOW
from app.schemas.account import PlaceOrderIn
from app.services import payments
from app.services.notify import notify

# "cod": cash or UPI on delivery. "upi": the shop's UPI ID by QR, confirmed by the shop. "online": Razorpay, confirmed automatically.
PAYMENT_METHODS = {"cod", "upi", "online"}
PAY_WINDOW = timedelta(minutes=30)  # an online order not paid by then is cancelled and its stock released
MAX_SAVED_ADDRESSES = 5
NOTIFY_ON = {"confirmed": "accepted", "shipped": "shipped", "delivered": "delivered"}  # status reached → customer message


def store_settings(db: Session) -> StoreSettings:
    return db.get(StoreSettings, 1) or StoreSettings(id=1, free_ship_above=5000, ship_fee=150, low_stock_at=2, contact_phone="",
                                                     contact_whatsapp="", contact_email="", contact_address="", contact_hours="",
                                                     instagram_url="", facebook_url="", couriers=[], brand_theme="plum",
                                                     upi_id="", upi_name="")


def _resolve_address(db: Session, user: User, data: PlaceOrderIn) -> dict:
    if data.address_id is not None:
        addr = db.get(Address, data.address_id)
        if not addr or addr.user_id != user.id:
            raise ServiceError("That saved address wasn't found.")
        return {k: getattr(addr, k) for k in ("name", "phone", "line1", "line2", "city", "state", "pincode")}
    if not data.address:
        raise ServiceError("Please add a delivery address.")
    a = data.address.model_dump()
    # Save it to the address book (skip exact duplicates, keep the newest few).
    if not any(x.line1 == a["line1"] and x.pincode == a["pincode"] for x in user.addresses):
        user.addresses.insert(0, Address(**a))
        for old in user.addresses[MAX_SAVED_ADDRESSES:]:
            db.delete(old)
    return a


def place_order(db: Session, user: User, data: PlaceOrderIn) -> Order:
    if data.payment_method not in PAYMENT_METHODS:
        raise ServiceError("That payment method isn't available yet.")
    if data.payment_method == "online" and payments.provider() == "off":
        raise ServiceError("Online payment isn't available yet. Please choose cash or UPI on delivery.")
    if data.payment_method == "upi" and not store_settings(db).upi_id:
        raise ServiceError("UPI payment isn't set up yet. Please choose cash or UPI on delivery.")

    # Merge duplicate lines so stock is checked per product + size.
    lines: OrderedDict[tuple[int, str], int] = OrderedDict()
    for it in data.items:
        key = (it.product_id, it.size or ONE_SIZE)
        lines[key] = lines.get(key, 0) + it.qty

    # Lock the variant rows so two customers can't buy the last piece at the same time.
    variants = db.scalars(
        select(Variant).where(Variant.product_id.in_({pid for pid, _ in lines})).order_by(Variant.id).with_for_update()
    ).all()
    by_key = {(v.product_id, v.size): v for v in variants}
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_({pid for pid, _ in lines})).options(selectinload(Product.images)))}

    problems, items = [], []
    for (pid, size), qty in lines.items():
        p = products.get(pid)
        if not p or not p.active:
            problems.append(f"{p.name if p else 'An item'} is no longer available")
            continue
        v = by_key.get((pid, size))
        label = p.name + (f" ({size})" if size != ONE_SIZE else "")
        if not v:
            problems.append(f"{label} isn't offered")
        elif v.stock < qty:
            problems.append(f"{label}: only {v.stock} left" if v.stock else f"{label} is sold out")
        else:
            v.stock -= qty
            items.append(OrderItem(product_id=p.id, name=p.name, raga=p.raga, image=p.images[0].url if p.images else "",
                                   size=None if size == ONE_SIZE else size, qty=qty, price=p.price))
    if problems:
        db.rollback()
        raise ServiceError(". ".join(problems) + ".", 409, problems)

    address = _resolve_address(db, user, data)
    cfg = store_settings(db)
    subtotal = sum(i.price * i.qty for i in items)
    shipping = 0 if subtotal >= cfg.free_ship_above else cfg.ship_fee
    if not user.email:
        user.email = str(data.email)
    if not user.name:
        user.name = address["name"]

    order = Order(user_id=user.id, phone=user.phone, customer_name=address["name"], email=str(data.email),
                  address=address, subtotal=subtotal, shipping=shipping, total=subtotal + shipping,
                  payment_method=data.payment_method, note=data.note, items=items,
                  events=[OrderEvent(status="placed")])
    db.add(order)
    if order.payment_method == "online":
        db.flush()
        order.gateway_order_id = payments.create_gateway_order(order.order_no, order.total)
    db.commit()
    db.refresh(order)
    if order.payment_method != "online":  # online orders alert the shop once they're paid
        notify(db, order, "new_order")
    return order


def mark_paid_online(db: Session, order: Order, payment_id: str, via: str) -> Order:
    """Idempotent: the browser's return and Razorpay's webhook can both arrive."""
    if order.payment_status in ("paid", "refunded"):
        return order
    if order.status == "cancelled":
        # Paid after the hold ran out: refund it rather than keep money for a released order.
        rid = payments.refund(payment_id, order.total)
        order.payment_status, order.payment_ref = "refunded", payment_id
        order.events.append(OrderEvent(status="cancelled", note=f"Paid after the order expired, refunded automatically · {rid}"))
        db.commit()
        return order
    order.payment_status, order.payment_ref = "paid", payment_id
    order.events.append(OrderEvent(status=order.status, note=f"Paid online · {payment_id}" + (" (confirmed by Razorpay)" if via == "webhook" else "")))
    db.commit()
    notify(db, order, "new_order")
    return order


def release_unpaid(db: Session) -> int:
    """Cancels online orders left unpaid past the pay window, putting their stock back."""
    cutoff = datetime.now(UTC) - PAY_WINDOW
    stale = db.scalars(select(Order).where(Order.payment_method == "online", Order.payment_status == "pending",
                                           Order.status == "placed", Order.created_at < cutoff).with_for_update(skip_locked=True)).all()
    for o in stale:
        _restock(db, o)
        o.status = "cancelled"
        o.events.append(OrderEvent(status="cancelled", note="Payment not completed in 30 minutes, stock released"))
    if stale:
        db.commit()
    return len(stale)


def _restock(db: Session, order: Order) -> None:
    for it in order.items:
        if it.product_id is None:
            continue
        v = db.scalar(select(Variant).where(Variant.product_id == it.product_id, Variant.size == (it.size or ONE_SIZE)).with_for_update())
        if v:
            v.stock += it.qty


def _lock_order(db: Session, order_id: int) -> Order:
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if not order:
        raise ServiceError("Order not found.", 404)
    return order


def upi_paid(db: Session, order: Order, ref: str) -> Order:
    if order.payment_method != "upi":
        raise ServiceError("This order is not paid by UPI.", 409)
    if order.status == "cancelled":
        raise ServiceError("This order was cancelled.", 409)
    if order.payment_status == "pending":
        order.payment_status, order.payment_ref = "claimed", ref
        order.events.append(OrderEvent(status=order.status, note=f"Customer paid by UPI{f' · ref {ref}' if ref else ''}"))
        db.commit()
    return order


def confirm_payment(db: Session, order_id: int) -> Order:
    order = _lock_order(db, order_id)
    if order.payment_status == "paid":
        return order
    if order.status == "cancelled":
        raise ServiceError("This order was cancelled.", 409)
    order.payment_status = "paid"
    order.events.append(OrderEvent(status=order.status, note="Payment received"))
    db.commit()
    return order


def set_status(db: Session, order_id: int, status: str, note: str = "", courier: str = "", tracking_id: str = "") -> Order:
    order = _lock_order(db, order_id)
    if order.status in ("cancelled", "delivered"):
        raise ServiceError(f"Order is already {order.status}.", 409)
    if status == "cancelled":
        if order.payment_method == "online" and order.payment_status == "paid":
            rid = payments.refund(order.payment_ref, order.total)
            order.payment_status = "refunded"
            order.events.append(OrderEvent(status=order.status, note=f"Refund of ₹{order.total:,} started · {rid}"))
        _restock(db, order)
        note = note or "Cancelled by store"
    elif status not in ORDER_FLOW or ORDER_FLOW.index(status) <= ORDER_FLOW.index(order.status):
        raise ServiceError("Orders can only move forward.", 409)
    elif order.payment_method == "online" and order.payment_status != "paid":
        raise ServiceError("This order is waiting for its online payment. It can be accepted once it's paid.", 409)
    if status == "shipped":
        if not (courier and tracking_id):
            raise ServiceError("Add the courier and tracking number to mark as shipped.")
        order.courier, order.tracking_id = courier, tracking_id
    if status == "delivered" and order.payment_method == "cod":
        order.payment_status = "paid"
    order.status = status
    order.events.append(OrderEvent(status=status, note=note))
    db.commit()
    if status in NOTIFY_ON:
        notify(db, order, NOTIFY_ON[status])
    return order
