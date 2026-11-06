"""Brings a live database's catalogue in line with seed_catalog.json. Dry run unless --apply.

    uv run python -m scripts.sync_catalog ../.env.production.local           # show the plan
    uv run python -m scripts.sync_catalog ../.env.production.local --apply   # do it

Only the retired demo pieces in RETIRED are deleted; pieces added in the admin panel are kept and listed after the catalogue.
"""

import argparse
import json
import os
import sys
from pathlib import Path

RETIRED = ["desh", "pilu", "khamaj", "shivranjani", "chandrakauns", "megh", "mohanam", "kirwani", "bahar",
           "puriya", "kedar", "bilaval", "multani"]
PHOTO_SWAPS = ["saveri", "lalit", "kanada"]
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
    args = ap.parse_args()
    load_env(args.env_file)

    from sqlalchemy import func, select
    from sqlalchemy.orm import selectinload

    from app.core.db import SessionLocal
    from app.models import OrderItem, Product, ProductImage, Review
    from app.services.images import delete_product_image, store_image_file
    from scripts.seed import seed_catalog

    catalog = json.loads((HERE / "seed_catalog.json").read_text(encoding="utf-8"))
    order = [raw["id"] for raw in catalog]
    by_slug = {raw["id"]: raw for raw in catalog}

    with SessionLocal() as db:
        live = {p.slug: p for p in db.scalars(select(Product).options(selectinload(Product.images)))}
        retire = [s for s in RETIRED if s in live]
        add = [s for s in order if s not in live]
        swap = [s for s in PHOTO_SWAPS if s in live and [Path(i.url).name for i in live[s].images] != by_slug[s]["images"]]
        extra = [s for s in live if s not in by_slug and s not in RETIRED]
        ids = [live[s].id for s in retire]
        orders = db.scalar(select(func.count(func.distinct(OrderItem.order_id))).where(OrderItem.product_id.in_(ids))) if ids else 0
        reviews = db.scalar(select(func.count()).where(Review.product_id.in_(ids))) if ids else 0

        print(f"Live now: {len(live)} pieces")
        print(f"Delete {len(retire)}: {', '.join(retire) or '-'}")
        print(f"   their {orders} past order(s) keep their own copy; {reviews} review(s) on them are deleted")
        print(f"Add {len(add)}: {', '.join(add) or '-'}")
        print(f"New photos for {len(swap)}: {', '.join(swap) or '-'}")
        print(f"Kept as they are (added in admin): {', '.join(extra) or '-'}")
        print(f"After: {len(live) - len(retire) + len(add)} pieces")
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
        db.commit()

        products = seed_catalog(db)
        tail = sorted((p for p in db.scalars(select(Product)) if p.slug not in by_slug), key=lambda p: (p.sort, p.id))
        for i, slug in enumerate(order):
            products[slug].sort = i
        for j, p in enumerate(tail):
            p.sort = len(order) + j
        db.commit()

    kept = {f"/uploads/products/{n}" for raw in catalog for n in raw["images"]}
    for url in set(old_urls) - kept:
        delete_product_image(url)
    print("\nDone.")


if __name__ == "__main__":
    main()
