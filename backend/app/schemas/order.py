from datetime import datetime

from pydantic import BaseModel, computed_field

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
    courier: str
    tracking_id: str
    note: str
    events: list[OrderEventOut]


class AdminOrderDetail(OrderDetail):
    notifications: list[NotificationOut]


class OrderPlaced(BaseModel):
    order_no: str
    total: int
