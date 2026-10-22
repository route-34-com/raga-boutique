from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class StoreSettings(Base):
    """Single row (id = 1)."""

    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    free_ship_above: Mapped[int] = mapped_column(Integer, default=5000)
    ship_fee: Mapped[int] = mapped_column(Integer, default=150)
    low_stock_at: Mapped[int] = mapped_column(Integer, default=2)
