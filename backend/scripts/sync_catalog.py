"""Brings a live database's catalogue in line with seed_catalog.json. Dry run unless --apply.

    uv run python -m scripts.sync_catalog ../.env.production.local           # show the plan
    uv run python -m scripts.sync_catalog ../.env.production.local --apply   # do it
    uv run python -m scripts.sync_catalog ../.env.production.local --apply --reset-demo   # also rebuild the demo orders

Only the retired demo pieces in RETIRED are deleted; pieces added in the admin panel are kept and listed after the catalogue.
"""

import argparse
import json
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

RETIRED = ["desh", "pilu", "khamaj", "shivranjani", "chandrakauns", "megh", "mohanam", "kirwani", "bahar",
           "puriya", "kedar", "bilaval", "multani"]
PHOTO_SWAPS = ["saveri", "lalit", "kanada"]
# Same file name, new picture: the stored copy is rewritten.
RECROPPED = ["marigold-hindol-detail.jpg", "copper-basant-detail.jpg"]
# Pieces from the November refresh: their launch date follows the seed, so "Just in" shows them ahead of older stock.
REFRESH = ["neelambari", "hamsadhwani", "kambhoji", "bageshri", "sohini", "malkauns", "sarang", "megh-malhar", "shree",
           "gaud-malhar", "bhimpalasi", "yaman", "kalavati", "vrindavani", "ahir-bhairav", "jog", "charukesi", "marwa",
           "shuddh-kalyan", "bhupali", "gaud-sarang"]
HERE = Path(__file__).parent


def load_env(path: Path) -> None:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"')
    url = values.get("DATABASE_URL_UNPOOLED") or values.get("DATABASE_URL")
    if not url:
        sys.exit(f"No DATABASE_URL in {path}")
    os.environ["DATABASE_URL"] = url
    os.environ["IMAGE_STORE"] = values.get("IMAGE_STORE", "db")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("env_file", type=Path, help="env file with the target DATABASE_URL, e.g. ../.env.production.local")
    ap.add_argument("--apply", action="store_true", help="make the changes (default: only show the plan)")
    ap.add_argument("--reset-demo", action="store_true", help="replace the demo customers' orders and reviews, and add demo business data")
    args = ap.parse_args()
    load_env(args.env_file)

    from sqlalchemy import func, select, text
    from sqlalchemy.orm import selectinload

    from app.core.db import SessionLocal
    from app.models import OrderItem, Product, ProductImage, Review
    from app.services.images import delete_product_image, store_image_file
    from app.models import Order, Purchase, Staff, User
    from scripts.seed import DEMO_CUSTOMERS, seed_catalog, seed_demo_business, seed_demo_orders, seed_demo_reviews

    catalog = json.loads((HERE / "seed_catalog.json").read_text(encoding="utf-8"))
    order = [raw["id"] for raw in catalog]
    by_slug = {raw["id"]: raw for raw in catalog}

    with SessionLocal() as db:
        from sqlalchemy import inspect
        if args.reset_demo and not inspect(db.get_bind()).has_table("purchases"):
            sys.exit("The new tables aren't there yet. Run the migration first:  uv run python -m alembic upgrade head")
        live = {p.slug: p for p in db.scalars(select(Product).options(selectinload(Product.images)))}
        retire = [s for s in RETIRED if s in live]
        add = [s for s in order if s not in live]
        swap = [s for s in PHOTO_SWAPS if s in live and [Path(i.url).name for i in live[s].images] != by_slug[s]["images"]]
        extra = [s for s in live if s not in by_slug and s not in RETIRED]
        now = datetime.now(UTC)
        want = {s: now - timedelta(days=by_slug[s].get("addedDaysAgo", 0)) for s in REFRESH if s in live}
        redate = [s for s, when in want.items() if abs((live[s].created_at - when).total_seconds()) > 86400]
        ids = [live[s].id for s in retire]
        orders = db.scalar(select(func.count(func.distinct(OrderItem.order_id))).where(OrderItem.product_id.in_(ids))) if ids else 0
        reviews = db.scalar(select(func.count()).where(Review.product_id.in_(ids))) if ids else 0

        print(f"Live now: {len(live)} pieces")
        print(f"Delete {len(retire)}: {', '.join(retire) or '-'}")
        print(f"   their {orders} past order(s) keep their own copy; {reviews} review(s) on them are deleted")
        print(f"Add {len(add)}: {', '.join(add) or '-'}")
        print(f"New photos for {len(swap)}: {', '.join(swap) or '-'}")
        print(f"New launch date for {len(redate)}: {', '.join(redate) or '-'}")
        print(f"Recropped close-ups to store: {', '.join(RECROPPED)}")
        print(f"Kept as they are (added in admin): {', '.join(extra) or '-'}")
        print(f"After: {len(live) - len(retire) + len(add)} pieces")
        demo_phones = ["+91" + c[0] for c in DEMO_CUSTOMERS]
        demo_users = list(db.scalars(select(User).where(User.phone.in_(demo_phones) | User.phone.like("+9190000001%"), User.is_admin.is_(False))))
        if args.reset_demo:
            n_orders = db.scalar(select(func.count()).where(Order.user_id.in_([u.id for u in demo_users]))) if demo_users else 0
            has_business = bool(db.scalar(select(Purchase.id).limit(1)) or db.scalar(select(Staff.id).limit(1)))
            print(f"Demo reset: remove {len(demo_users)} demo customers/reviewers and their {n_orders} orders, then reload demo orders"
                  f" and reviews; business demo data {'kept as is (already has entries)' if has_business else 'added'}")
        if not args.apply:
            print("\nDry run. Nothing changed. Add --apply to do it.")
            return

        old_urls = []
        for s in retire:
            old_urls += [i.url for i in live[s].images]
            db.delete(live[s])
        for s in swap:
            p = live[s]
            old_urls += [i.url for i in p.images]
            urls = [store_image_file(name, (HERE / "seed_images" / name).read_bytes()) for name in by_slug[s]["images"]]
            p.images = [ProductImage(url=u, position=j) for j, u in enumerate(urls)]
        for s in redate:
            live[s].created_at = want[s]
        db.commit()
        for name in RECROPPED:
            store_image_file(name, (HERE / "seed_images" / name).read_bytes())

        products = seed_catalog(db)
        tail = sorted((p for p in db.scalars(select(Product)) if p.slug not in by_slug), key=lambda p: (p.sort, p.id))
        for i, slug in enumerate(order):
            products[slug].sort = i
        for j, p in enumerate(tail):
            p.sort = len(order) + j
        db.commit()

        if args.reset_demo:
            ids = [u.id for u in demo_users]
            if ids:
                for o in db.scalars(select(Order).where(Order.user_id.in_(ids))):
                    db.delete(o)
                db.flush()
                for u in db.scalars(select(User).where(User.id.in_(ids))):
                    db.delete(u)
                db.commit()
            products = {p.slug: p for p in db.scalars(select(Product).options(selectinload(Product.images), selectinload(Product.variants)))}
            seed_demo_orders(db, products)
            seed_demo_reviews(db, products)
            seed_demo_business(db, products)
            db.commit()
            db.execute(text("SELECT setval('order_no_seq', GREATEST((SELECT COALESCE(MAX(seq), 1000) FROM orders), 1000))"))
            db.commit()

    kept = {f"/uploads/products/{n}" for raw in catalog for n in raw["images"]}
    for url in set(old_urls) - kept:
        delete_product_image(url)
    print("\nDone.")


if __name__ == "__main__":
    main()
