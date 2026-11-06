"""Money in and out: purchases (stock and cost), expenses, salaries, and the monthly profit summary."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import ServiceError
from app.models import ONE_SIZE, Expense, Order, OrderItem, Product, Purchase, SalaryPayment, Staff, Variant

IST = ZoneInfo("Asia/Kolkata")


def month_bounds(month: str) -> tuple[date, date]:
    """'2026-11' -> (1 Nov, 1 Dec)."""
    try:
        y, m = (int(x) for x in month.split("-"))
        start = date(y, m, 1)
    except ValueError:
        raise ServiceError("Month should look like 2026-11.") from None
    return start, date(y + (m == 12), m % 12 + 1, 1)


def current_month() -> str:
    return datetime.now(IST).strftime("%Y-%m")


def _variant(db: Session, product_id: int, size: str | None) -> Variant | None:
    return db.scalar(select(Variant).where(Variant.product_id == product_id, Variant.size == (size or ONE_SIZE)).with_for_update())


def add_purchase(db: Session, data) -> Purchase:
    name, size = data.item_name, (data.size or None)
    if data.product_id is not None:
        p = db.get(Product, data.product_id)
        if not p:
            raise ServiceError("That piece wasn't found.", 404)
        v = _variant(db, p.id, size)
        if not v:
            raise ServiceError(f"{p.name} has no size {size}." if size else f"Pick a size for {p.name}.")
        v.stock += data.qty
        name = p.name
    if not name:
        raise ServiceError("Pick a piece or type what was bought.")
    row = Purchase(bought_on=data.bought_on, supplier=data.supplier, product_id=data.product_id, item_name=name, size=size,
                   qty=data.qty, unit_cost=data.unit_cost, note=data.note)
    db.add(row)
    db.commit()
    return row


def delete_purchase(db: Session, purchase_id: int) -> None:
    row = db.get(Purchase, purchase_id)
    if not row:
        raise ServiceError("Purchase not found.", 404)
    if row.product_id is not None and (v := _variant(db, row.product_id, row.size)):
        v.stock = max(0, v.stock - row.qty)
    db.delete(row)
    db.commit()


def average_costs(db: Session) -> dict[int, float]:
    """Weighted average cost per piece, from every purchase of that product."""
    rows = db.execute(select(Purchase.product_id, func.sum(Purchase.qty * Purchase.unit_cost), func.sum(Purchase.qty))
                      .where(Purchase.product_id.is_not(None)).group_by(Purchase.product_id)).all()
    return {pid: total / qty for pid, total, qty in rows if qty}


def advance_balance(staff: Staff) -> int:
    return sum(a.amount for a in staff.advances) - sum(p.advance_cut for p in staff.payments)


def salary_preview(staff: Staff, month: str) -> dict:
    start, end = month_bounds(month)
    unpaid = sum(lv.days for lv in staff.leaves if start <= lv.on < end and not lv.paid)
    paid_leave = sum(lv.days for lv in staff.leaves if start <= lv.on < end and lv.paid)
    leave_cut = round(staff.monthly_salary / 30 * unpaid)
    existing = next((p for p in staff.payments if p.month == month), None)
    owed = advance_balance(staff) + (existing.advance_cut if existing else 0)
    advance_cut = min(owed, max(0, staff.monthly_salary - leave_cut))
    return {"month": month, "base": staff.monthly_salary, "unpaid_leave_days": unpaid, "paid_leave_days": paid_leave,
            "leave_cut": leave_cut, "advance_owed": owed, "advance_cut": advance_cut,
            "to_pay": staff.monthly_salary - leave_cut - advance_cut,
            "payment": existing and {"id": existing.id, "paid": existing.paid, "paid_on": existing.paid_on,
                                     "leave_cut": existing.leave_cut, "advance_cut": existing.advance_cut}}


def pay_salary(db: Session, staff: Staff, data) -> SalaryPayment:
    month_bounds(data.month)
    if any(p.month == data.month for p in staff.payments):
        raise ServiceError(f"{staff.name}'s salary for {data.month} is already recorded. Delete it first to redo it.", 409)
    if data.advance_cut > advance_balance(staff):
        raise ServiceError("That's more than the advance still owed.")
    row = SalaryPayment(staff_id=staff.id, month=data.month, base=staff.monthly_salary, leave_cut=data.leave_cut,
                        advance_cut=data.advance_cut, paid=data.paid, paid_on=data.paid_on, note=data.note)
    db.add(row)
    db.commit()
    return row


def _ist_start(d: date) -> datetime:
    return datetime.combine(d, time.min, IST)


def _month_money(db: Session, month: str, costs: dict[int, float]) -> dict:
    start, end = month_bounds(month)
    live = (Order.status != "cancelled", Order.created_at >= _ist_start(start), Order.created_at < _ist_start(end))
    orders = db.scalars(select(Order).where(*live).options(selectinload(Order.items))).all()
    sales = sum(o.total for o in orders)
    shipping = sum(o.shipping for o in orders)
    cogs = uncosted = 0
    by_product: dict[int, dict] = defaultdict(lambda: {"name": "", "units": 0, "revenue": 0, "cost": 0})
    for o in orders:
        for it in o.items:
            line = it.price * it.qty
            if it.product_id in costs:
                c = round(costs[it.product_id] * it.qty)
                cogs += c
                row = by_product[it.product_id]
                row["name"], row["units"], row["revenue"], row["cost"] = it.name, row["units"] + it.qty, row["revenue"] + line, row["cost"] + c
            else:
                uncosted += line
    purchases = db.scalar(select(func.coalesce(func.sum(Purchase.qty * Purchase.unit_cost), 0))
                          .where(Purchase.bought_on >= start, Purchase.bought_on < end))
    exp_rows = db.execute(select(Expense.category, func.sum(Expense.amount)).where(Expense.spent_on >= start, Expense.spent_on < end)
                          .group_by(Expense.category).order_by(func.sum(Expense.amount).desc())).all()
    expenses = sum(a for _, a in exp_rows)
    salaries = db.scalar(select(func.coalesce(func.sum(SalaryPayment.base - SalaryPayment.leave_cut), 0)).where(SalaryPayment.month == month))
    gross = sales - shipping - uncosted - cogs
    return {"month": month, "orders": len(orders), "sales": sales, "shipping": shipping, "cogs": cogs, "uncosted_sales": uncosted,
            "gross_profit": gross, "purchases": purchases, "expenses": expenses,
            "expense_split": [{"category": c, "amount": a} for c, a in exp_rows], "salaries": salaries,
            "net_profit": gross - expenses - salaries,
            "top": sorted(({"product_id": pid, **r, "profit": r["revenue"] - r["cost"]} for pid, r in by_product.items()),
                          key=lambda r: -r["profit"])[:6]}


def summary(db: Session, month: str) -> dict:
    costs = average_costs(db)
    now = _month_money(db, month, costs)
    start, _ = month_bounds(month)
    trend, d = [], start
    for _ in range(6):
        m = d.strftime("%Y-%m")
        t = now if m == month else _month_money(db, m, costs)
        trend.insert(0, {k: t[k] for k in ("month", "sales", "cogs", "expenses", "salaries", "net_profit")})
        d = (d - timedelta(days=1)).replace(day=1)
    variants = db.execute(select(Variant.product_id, Variant.stock, Product.price).join(Product).where(Variant.stock > 0)).all()
    stock_cost = round(sum(s * costs[pid] for pid, s, _ in variants if pid in costs))
    stock_retail = sum(s * price for _, s, price in variants)
    uncosted_pieces = len({pid for pid, _, _ in variants if pid not in costs})
    cod_due = db.scalar(select(func.coalesce(func.sum(Order.total), 0))
                        .where(Order.status != "cancelled", Order.payment_method == "cod", Order.payment_status != "paid"))
    staff = db.scalars(select(Staff).where(Staff.active.is_(True)).options(selectinload(Staff.advances), selectinload(Staff.payments))).all()
    return {**now, "trend": trend, "stock_at_cost": stock_cost, "stock_at_price": stock_retail, "pieces_without_cost": uncosted_pieces,
            "cod_due": cod_due, "advances_out": sum(advance_balance(s) for s in staff),
            "salary_due": sum(s.monthly_salary for s in staff if not any(p.month == month for p in s.payments))}
