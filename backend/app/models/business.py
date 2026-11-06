from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin

EXPENSE_CATEGORIES = ("Rent", "Electricity", "Maintenance", "Tailoring", "Packing & courier", "Marketing", "Transport", "Other")


class Purchase(TimestampMixin, Base):
    """Stock bought from a supplier. Adding one raises the piece's stock; its cost feeds profit."""

    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    bought_on: Mapped[date] = mapped_column(Date, index=True)
    supplier: Mapped[str] = mapped_column(String(80), default="")
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), index=True)
    item_name: Mapped[str] = mapped_column(String(160))  # kept so deleting a product doesn't blank old purchases
    size: Mapped[str | None] = mapped_column(String(10))
    qty: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[int] = mapped_column(Integer)  # whole rupees per piece
    note: Mapped[str] = mapped_column(String(300), default="")


class Expense(TimestampMixin, Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    spent_on: Mapped[date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(30))
    amount: Mapped[int] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(String(300), default="")


class Staff(TimestampMixin, Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(15), default="")
    role: Mapped[str] = mapped_column(String(60), default="")
    monthly_salary: Mapped[int] = mapped_column(Integer)
    joined_on: Mapped[date | None] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    leaves: Mapped[list["StaffLeave"]] = relationship(cascade="all, delete-orphan", order_by="StaffLeave.on.desc()")
    advances: Mapped[list["StaffAdvance"]] = relationship(cascade="all, delete-orphan", order_by="StaffAdvance.given_on.desc()")
    payments: Mapped[list["SalaryPayment"]] = relationship(cascade="all, delete-orphan", order_by="SalaryPayment.month.desc()")


class StaffLeave(TimestampMixin, Base):
    """A day (or half day) off. Unpaid leave is cut from that month's salary at monthly salary / 30 per day."""

    __tablename__ = "staff_leaves"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id", ondelete="CASCADE"), index=True)
    on: Mapped[date] = mapped_column(Date)
    days: Mapped[float] = mapped_column(Float, default=1)
    paid: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str] = mapped_column(String(200), default="")


class StaffAdvance(TimestampMixin, Base):
    """Money lent to a staff member, taken back from salary over the following months."""

    __tablename__ = "staff_advances"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id", ondelete="CASCADE"), index=True)
    given_on: Mapped[date] = mapped_column(Date)
    amount: Mapped[int] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(String(200), default="")


class SalaryPayment(TimestampMixin, Base):
    """One per staff member per month: what was due, what was cut, what was handed over."""

    __tablename__ = "salary_payments"
    __table_args__ = (UniqueConstraint("staff_id", "month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id", ondelete="CASCADE"), index=True)
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    base: Mapped[int] = mapped_column(Integer)
    leave_cut: Mapped[int] = mapped_column(Integer, default=0)
    advance_cut: Mapped[int] = mapped_column(Integer, default=0)
    paid: Mapped[int] = mapped_column(Integer)
    paid_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str] = mapped_column(String(200), default="")
