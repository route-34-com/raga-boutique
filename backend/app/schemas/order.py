from typing import Annotated

from datetime import datetime

from pydantic import BaseModel, StringConstraints, computed_field

from app.schemas.common import Out


class OrderItemOut(Out):
    product_id: int | None
    name: str
    raga: str
    image: str
    size: str | None
    qty: int
    price: int


class OrderEventOut(Out):
    status: str
    note: str
    created_at: datetime


class OrderSummary(Out):
    id: int
    order_no: str
    status: str
    total: int
    created_at: datetime
    items: list[OrderItemOut]

    @computed_field
    @property
    def item_count(self) -> int:
        return sum(i.qty for i in self.items)


class NotificationOut(Out):
    kind: str
    channel: str
    status: str
    detail: str
    created_at: datetime


class OrderDetail(OrderSummary):
    phone: str
    customer_name: str
    email: str
    address: dict
    subtotal: int
    shipping: int
    payment_method: str
    payment_status: str
    payment_ref: str = ""
    courier: str
    tracking_id: str
    note: str
    events: list[OrderEventOut]


class AdminOrderDetail(OrderDetail):
    notifications: list[NotificationOut]


class UpiPaidIn(BaseModel):
    ref: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40, pattern=r"^[A-Za-z0-9]*$")] = ""


class OrderPlaced(BaseModel):
    order_no: str
    total: int
    payment: dict | None = None  # checkout options when the order is paid online


class PaymentDone(BaseModel):
    razorpay_order_id: str = ""
    razorpay_payment_id: Annotated[str, StringConstraints(max_length=40)] = ""
    razorpay_signature: Annotated[str, StringConstraints(max_length=128)] = ""
