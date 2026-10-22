from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Sequence, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin

ORDER_FLOW = ["placed", "confirmed", "packed", "shipped", "delivered"]
ORDER_STATUSES = [*ORDER_FLOW, "cancelled"]
ONGOING = ["placed", "confirmed", "packed", "shipped"]
CUSTOMER_CANCELLABLE = ["placed", "confirmed"]

order_no_seq = Sequence("order_no_seq", start=1001)


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    seq: Mapped[int] = mapped_column(Integer, order_no_seq, server_default=order_no_seq.next_value(), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    phone: Mapped[str] = mapped_column(String(15))  # login phone at time of order
    customer_name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(120), default="")
    address: Mapped[dict] = mapped_column(JSON)  # snapshot, so later address edits don't change old orders
    subtotal: Mapped[int] = mapped_column(Integer)
    shipping: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default="placed", index=True)
    payment_method: Mapped[str] = mapped_column(String(20), default="cod")
    payment_status: Mapped[str] = mapped_column(String(12), default="pending")
    courier: Mapped[str] = mapped_column(String(60), default="")
    tracking_id: Mapped[str] = mapped_column(String(60), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items: Mapped[list["OrderItem"]] = relationship(cascade="all, delete-orphan", order_by="OrderItem.id")
    events: Mapped[list["OrderEvent"]] = relationship(cascade="all, delete-orphan", order_by="OrderEvent.id")

    @property
    def order_no(self) -> str:
        return f"RB{self.seq}"


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(160))
    raga: Mapped[str] = mapped_column(String(60), default="")
    image: Mapped[str] = mapped_column(String(300), default="")
    size: Mapped[str | None] = mapped_column(String(10))
    qty: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)


class OrderEvent(TimestampMixin, Base):
    __tablename__ = "order_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(12))
    note: Mapped[str] = mapped_column(String(300), default="")
