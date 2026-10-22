"""Loads the starter catalog, an admin and (with --demo) a test customer with sample orders.

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

HERE = Path(__file__).parent
CATEGORIES = [("sarees", "Sarees"), ("ethnic", "Anarkalis & dresses")]
SAREE_STOCK = {"bhairavi": 4, "hindol": 2, "yaman": 3, "kalyani": 1}


def seed_catalog(db) -> dict[str, Product]:
    dest = get_settings().uploads_dir / "products"
    dest.mkdir(parents=True, exist_ok=True)
    for i, (cid, name) in enumerate(CATEGORIES):
        db.merge(Category(id=cid, name=name, sort=i, active=True))
    db.merge(StoreSettings(id=1, free_ship_above=5000, ship_fee=150, low_stock_at=2))
    db.flush()

    products = {}
    for i, raw in enumerate(json.loads((HERE / "seed_catalog.json").read_text())):
        p = db.scalar(select(Product).where(Product.slug == raw["id"]))
        if p:
            products[p.slug] = p
            continue
        urls = []
        for img in raw["images"]:
            shutil.copy(HERE / "seed_images" / img, dest / img)
            urls.append(f"/uploads/products/{img}")
        sizes = raw.get("sizes") or []
        variants = ([Variant(size=s, stock=0 if j == 0 else 3, sort=j) for j, s in enumerate(sizes)]
                    or [Variant(size=ONE_SIZE, stock=SAREE_STOCK.get(raw["id"], 3))])
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


def seed_demo_orders(db, products: dict[str, Product]) -> None:
    phone = "+919000000002"
    if db.scalar(select(User).where(User.phone == phone)):
        return
    addr = dict(name="Meera Iyer", phone="9000000002", line1="14, North Mada Street", line2="Mylapore",
                city="Chennai", state="Tamil Nadu", pincode="600004")
    user = User(phone=phone, name="Meera Iyer", email="meera@example.com", addresses=[Address(**addr)])
    db.add(user)
    db.flush()

    now = datetime.now(UTC)
    samples = [
        ([("yaman", None)], ["placed", "confirmed", "packed", "shipped", "delivered"], 21, ("Delhivery", "DL88213409")),
        ([("megh", "M")], ["placed", "cancelled"], 9, None),
        ([("hindol", None), ("chandrakauns", "S")], ["placed", "confirmed", "packed", "shipped"], 2, ("Blue Dart", "BD5521907")),
        ([("bhairavi", None)], ["placed"], 0.05, None),
    ]
    for lines, flow, age_days, tracking in samples:
        items = [OrderItem(product_id=products[s].id, name=products[s].name, raga=products[s].raga,
                           image=products[s].images[0].url, size=size, qty=1, price=products[s].price) for s, size in lines]
        subtotal = sum(i.price for i in items)
        created = now - timedelta(days=age_days)
        shipping = 0 if subtotal >= 5000 else 150
        o = Order(user_id=user.id, phone=phone, customer_name=addr["name"], email=user.email, address=addr,
                  subtotal=subtotal, shipping=shipping, total=subtotal + shipping, status=flow[-1],
                  payment_status="paid" if flow[-1] == "delivered" else "pending",
                  courier=tracking[0] if tracking else "", tracking_id=tracking[1] if tracking else "",
                  items=items, created_at=created,
                  events=[OrderEvent(status=s, created_at=created + timedelta(hours=18 * k),
                                     note="Cancelled by customer" if s == "cancelled" else "") for k, s in enumerate(flow)])
        db.add(o)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--admin", default="9000000001", help="10-digit mobile of the first admin")
    ap.add_argument("--demo", action="store_true", help="also add a test customer with sample orders")
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
    print(f"Seeded {len(products)} products, admin +91{args.admin}" + (", demo customer +919000000002" if args.demo else ""))


if __name__ == "__main__":
    main()
