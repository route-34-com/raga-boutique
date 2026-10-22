from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin

ONE_SIZE = "ONE"  # variant size for pieces that aren't sized (sarees)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)  # slug, e.g. "sarees"
    name: Mapped[str] = mapped_column(String(80))
    sort: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    raga: Mapped[str] = mapped_column(String(60), default="")
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), index=True)
    mood: Mapped[str] = mapped_column(String(20), default="festive")
    price: Mapped[int] = mapped_column(Integer)  # whole rupees
    mrp: Mapped[int | None] = mapped_column(Integer)
    tag: Mapped[str] = mapped_column(String(30), default="")
    swatch: Mapped[str] = mapped_column(String(9), default="#c08040")
    raga_note: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[list[str]] = mapped_column(JSON, default=list)
    care: Mapped[str] = mapped_column(Text, default="")
    # Shop filters. Free text so the owner can add new values; the shop lists whatever is in use.
    color: Mapped[str] = mapped_column(String(30), default="")
    material: Mapped[str] = mapped_column(String(40), default="")
    work: Mapped[str] = mapped_column(String(40), default="")
    pattern: Mapped[str] = mapped_column(String(40), default="")
    occasions: Mapped[list[str]] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category: Mapped[Category] = relationship()
    images: Mapped[list["ProductImage"]] = relationship(order_by="ProductImage.position", cascade="all, delete-orphan")
    variants: Mapped[list["Variant"]] = relationship(order_by="Variant.sort", cascade="all, delete-orphan")

    @property
    def sized(self) -> bool:
        return any(v.size != ONE_SIZE for v in self.variants)

    @property
    def total_stock(self) -> int:
        return sum(v.stock for v in self.variants)


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(300))
    position: Mapped[int] = mapped_column(Integer, default=0)


class ImageFile(Base):
    """Photo bytes, used when IMAGE_STORE=db (hosts without a lasting disk). Served at /uploads/products/{name}."""

    __tablename__ = "image_files"

    name: Mapped[str] = mapped_column(String(80), primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)


class Variant(Base):
    __tablename__ = "variants"
    __table_args__ = (UniqueConstraint("product_id", "size"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    size: Mapped[str] = mapped_column(String(10), default=ONE_SIZE)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    sort: Mapped[int] = mapped_column(Integer, default=0)
