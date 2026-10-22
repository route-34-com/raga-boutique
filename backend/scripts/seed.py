"""Loads the starter catalog, an admin and (with --demo) test customers with sample orders.

    uv run python -m scripts.seed --demo          # local demo data
    uv run python -m scripts.seed --demo --reset  # wipe everything first (local only!)
    uv run python -m scripts.seed --admin 98XXXXXXXX   # production: catalog + first admin only
"""

import argparse
import json
import shutil
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import (
    ONE_SIZE, Address, Category, Order, OrderEvent, OrderItem, Product, ProductImage, StoreSettings, User, Variant,
)
from app.services.images import store_image_file

HERE = Path(__file__).parent
CATEGORIES = [("sarees", "Sarees"), ("ethnic", "Anarkalis & dresses"), ("lehengas", "Lehengas")]
# A few pieces start low so the dashboard's low-stock list has something to show; the rest are comfortably stocked.
LOW_STOCK = {"hindol": 3, "kalyani": 2, "malhar": 2}
SIZE_STOCK = {"XS": 3, "S": 4, "M": 5, "L": 5, "XL": 3, "XXL": 3}
# Placeholders until the owner fills in real details under Admin → Settings.
CONTACT = dict(contact_phone="9000000000", contact_whatsapp="9000000000", contact_email="hello@ragaboutique.in",
               contact_address="12, Kutchery Road, Mylapore, Chennai 600004", contact_hours="Mon–Sat, 10am–8pm",
               instagram_url="https://www.instagram.com/ragaboutique_/", facebook_url="https://www.facebook.com/ragatheboutique/")


def seed_settings(db) -> None:
    s = db.get(StoreSettings, 1)
    if not s:
        db.add(StoreSettings(id=1, free_ship_above=5000, ship_fee=150, low_stock_at=2, **CONTACT))
        return
    for k, v in CONTACT.items():
        if not getattr(s, k):
            setattr(s, k, v)


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
                    raga_note=raw["ragaNote"], details=raw["details"], care=raw["care"], sort=i,
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
         ([("yaman", None)], FULL, 21, ("Delhivery", "DL88213409")),
         ([("megh", "M")], ["placed", "cancelled"], 9, None),
         ([("hindol", None), ("chandrakauns", "S")], FULL[:4], 2, ("Blue Dart", "BD5521907")),
         ([("bhairavi", None)], ["placed"], 0.05, None),
     ]),
    ("9000000003", "Ananya Rao", "ananya@example.com",
     dict(line1="221, 8th Cross, Indiranagar", line2="HAL 2nd Stage", city="Bengaluru", state="Karnataka", pincode="560038"), [
         ([("malhar", None)], FULL, 18, ("Delhivery", "DL88219951")),
         ([("bahar", "M"), ("todi", None)], FULL[:3], 1.2, None),
     ]),
    ("9000000004", "Priya Menon", "priya.menon@example.com",
     dict(line1="Flat 4B, Sea Breeze Apartments", line2="Panampilly Nagar", city="Kochi", state="Kerala", pincode="682036"), [
         ([("basant", None)], FULL, 14, ("India Post", "EK123456789IN")),
         ([("puriya", "S")], FULL[:2], 0.6, None),
     ]),
    ("9000000005", "Kavya Sharma", "kavya.s@example.com",
     dict(line1="B-17, Vasant Vihar", line2="Near Priya Cinema", city="New Delhi", state="Delhi", pincode="110057"), [
         ([("kedar", "M")], FULL[:4], 4, ("Blue Dart", "BD5530018")),
         ([("bihag", None)], FULL, 25, ("Blue Dart", "BD5401120")),
         ([("darbari", None)], ["placed"], 0.2, None),
     ]),
    ("9000000006", "Sneha Banerjee", "sneha.b@example.com",
     dict(line1="32/1, Hindustan Park", line2="Gariahat", city="Kolkata", state="West Bengal", pincode="700029"), [
         ([("durga", None)], FULL, 11, ("Delhivery", "DL88230476")),
         ([("bilaval", "L")], ["placed", "confirmed", "cancelled"], 6, None),
         ([("megh", "S"), ("todi", None)], FULL[:3], 3, None),
     ]),
]


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
        pending += [(user, addr, *o) for o in orders]

    # Oldest first, so order numbers rise with the date like real orders do.
    for user, addr, lines, flow, age_days, tracking in sorted(pending, key=lambda o: -o[4]):
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
        if flow[-1] != "cancelled":
            for p, size in picked:
                v = next((v for v in p.variants if v.size == (size or ONE_SIZE)), None)
                if v and v.stock > 0:
                    v.stock -= 1


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
        shutil.rmtree(get_settings().uploads_dir / "products", ignore_errors=True)
        subprocess.run(["alembic", "upgrade", "head"], check=True, cwd=HERE.parent)
    with SessionLocal() as db:
        products = seed_catalog(db)
        make_admin(db, args.admin)
        if args.demo:
            seed_demo_orders(db, products)
        db.commit()
        db.execute(text("SELECT setval('order_no_seq', GREATEST((SELECT COALESCE(MAX(seq), 1000) FROM orders), 1000))"))
        db.commit()
    print(f"Seeded {len(products)} products, admin +91{args.admin}" + (f", {len(DEMO_CUSTOMERS)} demo customers" if args.demo else ""))


if __name__ == "__main__":
    main()
