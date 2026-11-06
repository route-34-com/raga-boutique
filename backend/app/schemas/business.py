from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.business import EXPENSE_CATEGORIES

Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Money = Annotated[int, Field(ge=0, le=10_000_000)]
Month = Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PurchaseIn(BaseModel):
    bought_on: date
    supplier: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    product_id: int | None = None
    item_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ""
    size: Annotated[str, StringConstraints(strip_whitespace=True, max_length=10)] | None = None
    qty: int = Field(ge=1, le=10_000)
    unit_cost: Annotated[int, Field(ge=1, le=10_000_000)]
    note: Text = ""


class PurchaseOut(Out):
    id: int
    bought_on: date
    supplier: str
    product_id: int | None
    item_name: str
    size: str | None
    qty: int
    unit_cost: int
    note: str


class ExpenseIn(BaseModel):
    spent_on: date
    category: Literal[EXPENSE_CATEGORIES]  # type: ignore[valid-type]
    amount: Annotated[int, Field(ge=1, le=10_000_000)]
    note: Text = ""


class ExpenseOut(Out):
    id: int
    spent_on: date
    category: str
    amount: int
    note: str


class StaffIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=15)] = ""
    role: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] = ""
    monthly_salary: Money
    joined_on: date | None = None
    active: bool = True


class LeaveIn(BaseModel):
    on: date
    days: Literal[0.5, 1] = 1
    paid: bool = False
    reason: Text = ""


class AdvanceIn(BaseModel):
    given_on: date
    amount: Annotated[int, Field(ge=1, le=10_000_000)]
    note: Text = ""


class SalaryIn(BaseModel):
    month: Month
    leave_cut: Money = 0
    advance_cut: Money = 0
    paid: Money
    paid_on: date
    note: Text = ""


class LeaveOut(Out):
    id: int
    on: date
    days: float
    paid: bool
    reason: str


class AdvanceOut(Out):
    id: int
    given_on: date
    amount: int
    note: str


class PaymentOut(Out):
    id: int
    month: str
    base: int
    leave_cut: int
    advance_cut: int
    paid: int
    paid_on: date
    note: str


class StaffOut(Out):
    id: int
    name: str
    phone: str
    role: str
    monthly_salary: int
    joined_on: date | None
    active: bool
    advance_owed: int = 0
    leaves: list[LeaveOut]
    advances: list[AdvanceOut]
    payments: list[PaymentOut]
