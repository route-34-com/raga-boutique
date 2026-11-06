"""Loads the starter catalog, an admin and (with --demo) test customers with sample orders.

    uv run python -m scripts.seed --demo          # local demo data
    uv run python -m scripts.seed --demo --reset  # wipe everything first (local only!)
    uv run python -m scripts.seed --admin 98XXXXXXXX   # production: catalog + first admin only
"""

import argparse
import json
import shutil
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import (
    ONE_SIZE, Address, Category, Expense, Order, OrderEvent, OrderItem, Product, ProductImage, Purchase, Review, SalaryPayment,
    Staff, StaffAdvance, StaffLeave, StoreSettings, User, Variant,
)
from app.services.images import store_image_file

HERE = Path(__file__).parent
CATEGORIES = [("sarees", "Sarees"), ("ethnic", "Anarkalis & dresses"), ("lehengas", "Lehengas"), ("materials", "Dress materials")]
# A few pieces start low so the dashboard's low-stock list has something to show; the rest are comfortably stocked.
LOW_STOCK = {"hindol": 3, "kalyani": 2, "malhar": 2, "kambhoji": 2, "sohini": 1}
SIZE_STOCK = {"XS": 3, "S": 4, "M": 5, "L": 5, "XL": 3, "XXL": 3}
# The store's details from its Google Maps listing; edited later under Admin → Settings.
CONTACT = dict(contact_phone="8754291999", contact_whatsapp="8754291999", contact_email="",
               contact_address="22–23, Municipal Complex, near the Bus Stand, Erode Main Road, Santhaipettai, Tiruchengode, Tamil Nadu 637211",
               contact_hours="Open till 8 pm",
               instagram_url="https://www.instagram.com/ragaboutique_/", facebook_url="https://www.facebook.com/ragatheboutique/")


def seed_settings(db) -> None:
    s = db.get(StoreSettings, 1)
    if not s:
        db.add(StoreSettings(id=1, free_ship_above=5000, ship_fee=150, low_stock_at=2, **CONTACT))
        return
    for k, v in CONTACT.items():
        if not getattr(s, k):
            setattr(s, k, v)


def filter_fields(raw: dict) -> dict:
    """Shop-filter attributes, plus a launch date spread over past months so "Launched in" has something to show."""
    return dict(color=raw.get("color", ""), material=raw.get("material", ""), work=raw.get("work", ""),
                pattern=raw.get("pattern", ""), occasions=raw.get("occasions", []),
                created_at=datetime.now(UTC) - timedelta(days=raw.get("addedDaysAgo", 0)))


def seed_catalog(db) -> dict[str, Product]:
    for i, (cid, name) in enumerate(CATEGORIES):
        db.merge(Category(id=cid, name=name, sort=i, active=True))
    seed_settings(db)
    db.flush()

    products = {}
    for i, raw in enumerate(json.loads((HERE / "seed_catalog.json").read_text(encoding="utf-8"))):
        p = db.scalar(select(Product).where(Product.slug == raw["id"]))
        if p:
            products[p.slug] = p
            continue
        urls = [store_image_file(img, (HERE / "seed_images" / img).read_bytes()) for img in raw["images"]]
        sizes = raw.get("sizes") or []
        variants = ([Variant(size=s, stock=SIZE_STOCK.get(s, 3), sort=j) for j, s in enumerate(sizes)]
                    or [Variant(size=ONE_SIZE, stock=LOW_STOCK.get(raw["id"], 6))])
        p = Product(slug=raw["id"], name=raw["name"], raga=raw["raga"], category_id=raw["cat"], mood=raw["mood"],
                    price=raw["price"], mrp=raw.get("mrp"), tag=raw.get("tag", ""), swatch=raw["swatch"],
                    raga_note=raw["ragaNote"], details=raw["details"], care=raw["care"], sort=i, **filter_fields(raw),
                    images=[ProductImage(url=u, position=j) for j, u in enumerate(urls)], variants=variants)
        db.add(p)
        products[p.slug] = p
    db.flush()
    return products


def make_admin(db, mobile: str) -> None:
    phone = "+91" + mobile
    u = db.scalar(select(User).where(User.phone == phone)) or User(phone=phone, name="Store owner")
    u.is_admin = True
    db.add(u)


FULL = ["placed", "confirmed", "packed", "shipped", "delivered"]
# (mobile, name, email, address, [(lines, status flow, days ago, (courier, tracking) | None)])
DEMO_CUSTOMERS = [
    ("9000000002", "Meera Iyer", "meera@example.com",
     dict(line1="14, North Mada Street", line2="Mylapore", city="Chennai", state="Tamil Nadu", pincode="600004"), [
         ([("kalyani", None), ("hamsadhwani", None)], FULL, 52, ("Delhivery", "DL87990211")),
         ([("bhupali", None)], FULL, 140, ("India Post", "EK100245881IN")),
         ([("kalyani", None)], FULL, 21, ("Delhivery", "DL88213409")),
         ([("kafi", "M")], ["placed", "cancelled"], 9, None),
         ([("hindol", None), ("abhogi", "S")], FULL[:4], 2, ("Blue Dart", "BD5521907")),
         ([("bhairavi", None)], ["placed"], 0.05, None),
     ]),
    ("9000000003", "Ananya Rao", "ananya@example.com",
     dict(line1="221, 8th Cross, Indiranagar", line2="HAL 2nd Stage", city="Bengaluru", state="Karnataka", pincode="560038"), [
         ([("charukesi", "M")], FULL, 78, ("Blue Dart", "BD5300147")),
         ([("darbari", None)], FULL, 160, ("Delhivery", "DL87410322")),
         ([("malhar", None)], FULL, 18, ("Delhivery", "DL88219951")),
         ([("ahir-bhairav", "M"), ("darbari", None)], FULL[:3], 1.2, None),
     ]),
    ("9000000004", "Priya Menon", "priya.menon@example.com",
     dict(line1="Flat 4B, Sea Breeze Apartments", line2="Panampilly Nagar", city="Kochi", state="Kerala", pincode="682036"), [
         ([("marwa", "S")], FULL, 45, ("Blue Dart", "BD5311802")),
         ([("shree", "M"), ("lalit", None)], FULL, 104, ("DTDC", "D7700451123")),
         ([("basant", None)], FULL, 14, ("India Post", "EK123456789IN")),
         ([("vrindavani", "S")], FULL[:2], 0.6, None),
     ]),
    ("9000000005", "Kavya Sharma", "kavya.s@example.com",
     dict(line1="B-17, Vasant Vihar", line2="Near Priya Cinema", city="New Delhi", state="Delhi", pincode="110057"), [
         ([("kambhoji", None)], FULL, 66, ("Blue Dart", "BD5302290")),
         ([("jog", "S")], FULL, 132, ("Delhivery", "DL87622019")),
         ([("charukesi", "M")], FULL[:4], 4, ("Blue Dart", "BD5530018")),
         ([("bihag", None)], FULL, 25, ("Blue Dart", "BD5401120")),
         ([("darbari", None)], ["placed"], 0.2, None),
     ]),
    ("9000000006", "Sneha Banerjee", "sneha.b@example.com",
     dict(line1="32/1, Hindustan Park", line2="Gariahat", city="Kolkata", state="West Bengal", pincode="700029"), [
         ([("megh-malhar", "L"), ("saveri", None)], FULL, 88, ("DTDC", "D7700462288")),
         ([("vrindavani", "M")], FULL, 150, ("Delhivery", "DL87455730")),
         ([("durga", None)], FULL, 11, ("Delhivery", "DL88230476")),
         ([("jog", "L")], ["placed", "confirmed", "cancelled"], 6, None),
         ([("abhogi", "M"), ("gaud-sarang", None)], FULL[:3], 3, None),
     ]),
]


# Sales target per month for the generated history (months back -> rupees). Month 3 is the slow one that ends in a loss.
HISTORY_TARGETS = {1: 215000, 2: 190000, 3: 70000, 4: 205000, 5: 180000}


def _history(products: dict[str, Product], customers: dict) -> list:
    """Older delivered orders, the same every run, so the Business page has six believable months."""
    import random
    rng = random.Random(34)
    today = datetime.now(UTC)
    people = sorted(customers.values(), key=lambda c: c[0].phone)
    sellable = [p for p in products.values() if p.slug not in NO_COST]
    out = []
    for back, target in HISTORY_TARGETS.items():
        start = _month_start(back, today.date())
        days_in = (_month_start(back - 1, today.date()) - start).days
        total = 0
        while total < target:
            p = rng.choice(sellable)
            sized = [v.size for v in p.variants if v.size != ONE_SIZE]
            when = datetime.combine(start, datetime.min.time(), UTC) + timedelta(days=rng.randrange(days_in), hours=rng.randrange(9, 21))
            user, addr = rng.choice(people)
            out.append((user, addr, [(p.slug, rng.choice(sized) if sized else None)], FULL, (today - when).total_seconds() / 86400,
                        ("Delhivery", f"DL86{rng.randrange(100000, 999999)}")))
            total += p.price
    return out


def seed_demo_orders(db, products: dict[str, Product]) -> None:
    now = datetime.now(UTC)
    pending = []
    for mobile, name, email, place, orders in DEMO_CUSTOMERS:
        phone = "+91" + mobile
        if db.scalar(select(User).where(User.phone == phone)):
            continue
        addr = dict(name=name, phone=mobile, **place)
        user = User(phone=phone, name=name, email=email, addresses=[Address(**addr)])
        db.add(user)
        db.flush()
        pending += [(user, addr, *o, False) for o in orders]

    pending += [(*h, True) for h in _history(products, {u.phone: (u, a) for u, a, *_ in pending})]
    # Oldest first, so order numbers rise with the date like real orders do.
    for user, addr, lines, flow, age_days, tracking, historic in sorted(pending, key=lambda o: -o[4]):
        picked = [(products[s], size) for s, size in lines]
        items = [OrderItem(product_id=p.id, name=p.name, raga=p.raga, image=p.images[0].url, size=size, qty=1, price=p.price)
                 for p, size in picked]
        subtotal = sum(i.price for i in items)
        created = now - timedelta(days=age_days)
        shipping = 0 if subtotal >= 5000 else 150
        step = timedelta(hours=min(18, age_days * 24 / len(flow)))
        o = Order(user_id=user.id, phone=user.phone, customer_name=user.name, email=user.email, address=addr,
                  subtotal=subtotal, shipping=shipping, total=subtotal + shipping, status=flow[-1],
                  payment_status="paid" if flow[-1] == "delivered" else "pending",
                  courier=tracking[0] if tracking else "", tracking_id=tracking[1] if tracking else "",
                  items=items, created_at=created,
                  events=[OrderEvent(status=s, created_at=created + step * k,
                                     note="Cancelled by customer" if s == "cancelled" else "") for k, s in enumerate(flow)])
        db.add(o)
        db.flush()
        if flow[-1] != "cancelled" and not historic:  # the generated history was restocked since
            for p, size in picked:
                v = next((v for v in p.variants if v.size == (size or ONE_SIZE)), None)
                if v and v.stock > 0:
                    v.stock -= 1


# (product slug, first name, city, stars, comment, days ago). The first five match demo customers' delivered orders.
DEMO_REVIEWS = [
    ("kalyani", "Meera", "Chennai", 5, "The pink is even richer in person. Wore it to my cousin's reception and three aunties asked where it was from.", 16),
    ("malhar", "Ananya", "Bengaluru", 5, "Light enough for a Bengaluru afternoon, and the colour photographs beautifully. Packed with so much care.", 12),
    ("basant", "Priya", "Kochi", 4, "Lovely weave and the pallu is gorgeous. Took a day longer than expected to reach Kochi, but worth the wait.", 9),
    ("bihag", "Kavya", "New Delhi", 5, "Exactly the shade on the website. The video call before buying helped me decide.", 20),
    ("durga", "Sneha", "Kolkata", 5, "My mother cried when she saw it. The zari work is so fine. Thank you, Raga.", 6),
    ("kalyani", "Deepa", "Coimbatore", 5, "Bought this for my daughter's muhurtham. The pink glows under lights and the buttas are perfect.", 34),
    ("hindol", "Revathi", "Salem", 5, "Suja amma helped me choose over WhatsApp. The marigold and royal blue together is stunning.", 28),
    ("bhairavi", "Nandhini", "Erode", 4, "Soft and elegant, perfect for a morning function. Wish it came in one more shade.", 24),
    ("kalyani", "Janani", "Madurai", 5, "Heavy pallu, rich colour, and they did the fall and pico before sending. Very happy.", 19),
    ("durga", "Lakshmi", "Tiruchengode", 5, "Visited the new showroom after seeing the website. Same warmth in person. Love my saree.", 8),
    ("hindol", "Harini", "Namakkal", 5, "Gifted this to my mother-in-law. She has worn it twice already!", 5),
    ("kalavati", "Pooja", "Mumbai", 3, "The lehenga is beautiful but the blouse needed alteration. The team was quick to help on WhatsApp.", 4),
    ("bhairavi", "Gayathri", "Trichy", 5, "Third purchase from Raga. Quality is consistent every single time.", 2),
]


def seed_demo_reviews(db, products: dict[str, Product]) -> None:
    now = datetime.now(UTC)
    by_name = {u.name.split()[0]: u for u in db.scalars(select(User).where(User.name != ""))}
    for i, (slug, first, city, stars, comment, age) in enumerate(DEMO_REVIEWS):
        user = by_name.get(first)
        if not user or user.is_admin:
            user = User(phone=f"+9190000001{i:02d}", name=first)
            db.add(user)
            db.flush()
        when = now - timedelta(days=age)
        db.add(Review(product_id=products[slug].id, user_id=user.id, rating=stars, comment=comment, name=first, city=city,
                      created_at=when, updated_at=when))


# Business demo data. Costs run 55-68% of the selling price; kafi and abhogi are left without a cost on purpose,
# so the Business page shows its "no purchase cost yet" note. Dates are days ago.
NO_COST = {"kafi", "abhogi"}
SUPPLIERS = {"sarees": "Kanchi Silk Weavers", "lehengas": "Jaipur Bridal House", "ethnic": "Sanganer Prints", "materials": "Surat Fabric Mart"}
EXPENSES = [  # (category, amount, note, day of month)
    ("Rent", 18000, "Showroom rent", 5), ("Electricity", 3900, "EB bill", 12), ("Packing & courier", 2800, "Boxes, tissue, pickups", 20),
]
EXTRA_EXPENSES = {0: [("Electricity", 4150, "EB bill", 2), ("Transport", 850, "Auto to Erode market", 3), ("Packing & courier", 1960, "Delhivery pickups", 4),
                      ("Tailoring", 1500, "Fall and pico, 6 sarees", 5), ("Maintenance", 1200, "Trial room light fixed", 6)], 1: [("Marketing", 3500, "Instagram ads", 9)], 3: [("Maintenance", 14500, "AC compressor repair", 16), ("Tailoring", 2400, "Fall and pico", 22)],
                  4: [("Marketing", 3000, "Diwali flyers", 7)], 2: [("Tailoring", 1800, "Blouse stitching", 18)]}
STAFF = [  # (name, role, phone, salary, joined days ago, active)
    ("Kala", "Sales", "9842011223", 14000, 900, True), ("Meena", "Tailor", "9842011224", 12000, 600, True),
    ("Ravi", "Helper & delivery", "9842011225", 9000, 300, True), ("Lakshmi", "Sales", "9842011226", 11000, 700, False),
]


def _month_start(months_back: int, today):
    y, m = today.year, today.month - months_back
    while m < 1:
        y, m = y - 1, m + 12
    return today.replace(year=y, month=m, day=1)


def seed_demo_business(db, products: dict[str, Product]) -> None:
    if db.scalar(select(Purchase.id).limit(1)) or db.scalar(select(Staff.id).limit(1)):
        return
    today = datetime.now(UTC).date()
    for i, (slug, p) in enumerate(products.items()):
        if slug in NO_COST:
            continue
        ratio = 0.55 + (i * 7 % 14) / 100
        launched = p.created_at.date() if p.created_at else today
        bought = max(today - timedelta(days=175), min(launched, today) - timedelta(days=25))
        sizes = [v.size for v in p.variants]
        for size in sizes:
            db.add(Purchase(bought_on=bought, supplier=SUPPLIERS.get(p.category_id, ""), product_id=p.id, item_name=p.name,
                            size=None if size == ONE_SIZE else size, qty=4 if size == ONE_SIZE else 2, unit_cost=round(p.price * ratio, -1)))
    if "hindol" in products:  # bought twice at different prices: the Business page averages them
        p = products["hindol"]
        db.add(Purchase(bought_on=today - timedelta(days=20), supplier="Kanchi Silk Weavers", product_id=p.id, item_name=p.name,
                        qty=2, unit_cost=round(p.price * 0.7, -1), note="Restock before Deepavali"))
    db.add(Purchase(bought_on=today - timedelta(days=min(3, today.day - 1)), supplier="Erode Packaging", item_name="Gift boxes and tissue",
                    qty=200, unit_cost=18, note="Not for sale"))
    if "kambhoji" in products:  # this month's one restock
        p = products["kambhoji"]
        db.add(Purchase(bought_on=today - timedelta(days=min(2, today.day - 1)), supplier="Kanchi Silk Weavers", product_id=p.id,
                        item_name=p.name, qty=2, unit_cost=round(p.price * 0.62, -1), note="Running low"))

    for back in range(6):
        start = _month_start(back, today)
        for cat, amt, note, day in (EXPENSES if back else EXPENSES[:1]) + EXTRA_EXPENSES.get(back, []):
            when = min(start.replace(day=day), today)
            if when <= today:
                db.add(Expense(spent_on=when, category=cat, amount=amt + (back * 130 if cat == "Electricity" else 0), note=note))

    for name, role, phone, salary, joined, active in STAFF:
        s = Staff(name=name, role=role, phone=phone, monthly_salary=salary, joined_on=today - timedelta(days=joined), active=active)
        db.add(s)
        db.flush()
        last_paid = 3 if not active else 1
        for back in range(5, last_paid - 1, -1):
            start = _month_start(back, today)
            db.add(SalaryPayment(staff_id=s.id, month=start.strftime("%Y-%m"), base=salary, paid=salary, leave_cut=0, advance_cut=0,
                                 paid_on=_month_start(back - 1, today).replace(day=2)))
        if name == "Meena":
            db.add(StaffAdvance(staff_id=s.id, given_on=_month_start(1, today).replace(day=10), amount=6000, note="Daughter's school fees"))
            db.add(StaffLeave(staff_id=s.id, on=today.replace(day=max(1, today.day - 2)), days=1, reason="Fever"))
            db.add(StaffLeave(staff_id=s.id, on=_month_start(0, today).replace(day=1), days=0.5, paid=True, reason="Temple visit"))
        if name == "Kala":
            db.add(StaffLeave(staff_id=s.id, on=today.replace(day=max(1, today.day - 1)), days=1, paid=True, reason="Family function"))
    db.flush()
    meena = db.scalar(select(Staff).where(Staff.name == "Meena"))
    if meena:  # last month's salary took back part of the advance
        last = _month_start(1, today).strftime("%Y-%m")
        pay = db.scalar(select(SalaryPayment).where(SalaryPayment.staff_id == meena.id, SalaryPayment.month == last))
        if pay:
            pay.advance_cut, pay.paid = 2000, pay.base - 2000


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--admin", default="9000000001", help="10-digit mobile of the first admin")
    ap.add_argument("--demo", action="store_true", help="also add test customers with sample orders")
    ap.add_argument("--reset", action="store_true", help="drop all data and uploads first (refused when ENV=prod)")
    args = ap.parse_args()
    if args.reset:
        if get_settings().env == "prod":
            raise SystemExit("Refusing to reset a production database.")
        with SessionLocal() as db:
            db.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
            db.commit()
        if get_settings().image_store == "disk":
            shutil.rmtree(get_settings().uploads_dir / "products", ignore_errors=True)
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True, cwd=HERE.parent)
    with SessionLocal() as db:
        products = seed_catalog(db)
        make_admin(db, args.admin)
        if args.demo:
            seed_demo_orders(db, products)
            seed_demo_reviews(db, products)
            seed_demo_business(db, products)
        db.commit()
        db.execute(text("SELECT setval('order_no_seq', GREATEST((SELECT COALESCE(MAX(seq), 1000) FROM orders), 1000))"))
        db.commit()
    print(f"Seeded {len(products)} products, admin +91{args.admin}" + (f", {len(DEMO_CUSTOMERS)} demo customers" if args.demo else ""))


if __name__ == "__main__":
    main()
