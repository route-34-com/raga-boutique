from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin

KINDS = ("accepted", "shipped", "new_order")
CHANNELS = ("whatsapp", "email")


class Notification(TimestampMixin, Base):
    """One row per message attempt. Unique per order + kind + channel, so nothing is ever sent twice."""

    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("order_id", "kind", "channel"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(12))
    channel: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(10))  # sent | tap | logged | skipped | failed
    detail: Mapped[str] = mapped_column(String(1200), default="")  # wa.me link, message id or failure reason
