from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, Admin
from app.core.errors import ServiceError
from app.models import EXPENSE_CATEGORIES, Expense, Purchase, SalaryPayment, Staff, StaffAdvance, StaffLeave
from app.schemas.business import (
    AdvanceIn, ExpenseIn, ExpenseOut, LeaveIn, PurchaseIn, PurchaseOut, SalaryIn, StaffIn, StaffOut,
)
from app.services import business as svc

router = APIRouter()
STAFF_LOAD = (selectinload(Staff.leaves), selectinload(Staff.advances), selectinload(Staff.payments))


def _run(fn, *args):
    try:
        return fn(*args)
    except ServiceError as e:
        raise e.http() from None


def _range(month: str | None):
    return _run(svc.month_bounds, month or svc.current_month())


@router.get("/business")
def business(_: Admin, db: DB, month: str | None = None):
    return _run(svc.summary, db, month or svc.current_month())


@router.get("/purchases", response_model=list[PurchaseOut])
def list_purchases(_: Admin, db: DB, month: str | None = None):
    start, end = _range(month)
    return db.scalars(select(Purchase).where(Purchase.bought_on >= start, Purchase.bought_on < end)
                      .order_by(Purchase.bought_on.desc(), Purchase.id.desc())).all()


@router.post("/purchases", response_model=PurchaseOut, status_code=201)
def create_purchase(body: PurchaseIn, _: Admin, db: DB):
    return _run(svc.add_purchase, db, body)


@router.delete("/purchases/{purchase_id}", status_code=204)
def remove_purchase(purchase_id: int, _: Admin, db: DB):
    _run(svc.delete_purchase, db, purchase_id)
    return Response(status_code=204)


@router.get("/expenses")
def list_expenses(_: Admin, db: DB, month: str | None = None):
    start, end = _range(month)
    rows = db.scalars(select(Expense).where(Expense.spent_on >= start, Expense.spent_on < end)
                      .order_by(Expense.spent_on.desc(), Expense.id.desc())).all()
    return {"categories": EXPENSE_CATEGORIES, "items": [ExpenseOut.model_validate(r) for r in rows]}


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(body: ExpenseIn, _: Admin, db: DB):
    row = Expense(**body.model_dump())
    db.add(row)
    db.commit()
    return row


@router.delete("/expenses/{expense_id}", status_code=204)
def remove_expense(expense_id: int, _: Admin, db: DB):
    if row := db.get(Expense, expense_id):
        db.delete(row)
        db.commit()
    return Response(status_code=204)


def _staff(db, staff_id: int) -> Staff:
    s = db.scalar(select(Staff).where(Staff.id == staff_id).options(*STAFF_LOAD))
    if not s:
        raise HTTPException(404, {"message": "Staff member not found."})
    return s


def _out(s: Staff) -> StaffOut:
    return StaffOut.model_validate(s).model_copy(update={"advance_owed": svc.advance_balance(s)})


@router.get("/staff", response_model=list[StaffOut])
def list_staff(_: Admin, db: DB):
    return [_out(s) for s in db.scalars(select(Staff).options(*STAFF_LOAD).order_by(Staff.active.desc(), Staff.name))]


@router.post("/staff", response_model=StaffOut, status_code=201)
def create_staff(body: StaffIn, _: Admin, db: DB):
    s = Staff(**body.model_dump())
    db.add(s)
    db.commit()
    return _out(_staff(db, s.id))


@router.put("/staff/{staff_id}", response_model=StaffOut)
def update_staff(staff_id: int, body: StaffIn, _: Admin, db: DB):
    s = _staff(db, staff_id)
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return _out(s)


@router.post("/staff/{staff_id}/leaves", response_model=StaffOut, status_code=201)
def add_leave(staff_id: int, body: LeaveIn, _: Admin, db: DB):
    s = _staff(db, staff_id)
    s.leaves.append(StaffLeave(**body.model_dump()))
    db.commit()
    return _out(_staff(db, staff_id))


@router.post("/staff/{staff_id}/advances", response_model=StaffOut, status_code=201)
def add_advance(staff_id: int, body: AdvanceIn, _: Admin, db: DB):
    s = _staff(db, staff_id)
    s.advances.append(StaffAdvance(**body.model_dump()))
    db.commit()
    return _out(_staff(db, staff_id))


@router.get("/staff/{staff_id}/salary")
def salary(staff_id: int, _: Admin, db: DB, month: str | None = None):
    return _run(svc.salary_preview, _staff(db, staff_id), month or svc.current_month())


@router.post("/staff/{staff_id}/salary", response_model=StaffOut, status_code=201)
def pay(staff_id: int, body: SalaryIn, _: Admin, db: DB):
    _run(svc.pay_salary, db, _staff(db, staff_id), body)
    return _out(_staff(db, staff_id))


@router.delete("/staff/{staff_id}/{kind}/{row_id}", response_model=StaffOut)
def remove_entry(staff_id: int, kind: str, row_id: int, _: Admin, db: DB):
    model = {"leaves": StaffLeave, "advances": StaffAdvance, "salary": SalaryPayment}.get(kind)
    if not model:
        raise HTTPException(404, {"message": "Not found."})
    row = db.get(model, row_id)
    if row and row.staff_id == staff_id:
        db.delete(row)
        db.commit()
    return _out(_staff(db, staff_id))
