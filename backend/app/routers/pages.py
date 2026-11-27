"""The site's pages as HTML, for search engines and link previews.

Every page gets the built React page (the "shell") with its own title, description, canonical link, Open Graph tags
and structured data in the head, and the page's main text inside #root so crawlers that don't run scripts still read
it. React replaces #root when it starts, so shoppers see the normal site. Unknown addresses answer 404.
Also serves robots.txt, sitemap.xml and llms.txt from the live catalogue.
"""

import html
import json
import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlencode
from xml.sax.saxutils import escape as xml_escape

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.deps import DB
from app.models import Category, Product
from app.routers import page_text
from app.routers.page_text import rupees
from app.services import reviews
from app.services.orders import store_settings

log = logging.getLogger(__name__)
router = APIRouter(tags=["pages"])

BRAND = "Raga Boutique"
TAGLINE = "Handwoven sarees and ethnic wear, each named after the raga whose mood it carries."
POLICIES = {
    "shipping": ("Shipping & delivery", "Delivery times, charges and tracking for Raga Boutique orders across India."),
    "returns": (
        "Cancellation & refunds",
        "How to cancel a Raga Boutique order, and how damaged or wrong items are replaced or refunded.",
    ),
    "terms": ("Terms & conditions", "The terms for buying from Raga Boutique, Tiruchengode."),
    "privacy": ("Privacy policy", "What Raga Boutique collects, why, and who it is shared with."),
    "faq": (
        "Common questions",
        "Delivery time, cash on delivery, returns, fall and pico, video calls and the showroom: quick answers from Raga Boutique.",
    ),
    "contact": ("Contact us", "Call, WhatsApp, email or visit Raga Boutique in Tiruchengode, Tamil Nadu."),
}
PRIVATE = re.compile(r"^(checkout|account|wishlist|orders/[^/]+|admin(/.*)?)$")
SHELL_FILES = (
    Path(__file__).resolve().parents[1] / "web" / "shell.html",  # copied there by the Vercel build
    Path(__file__).resolve().parents[3] / "frontend" / "dist" / "index.html",  # a server with the built frontend
)
SHOP_LAT, SHOP_LNG = 11.3781119, 77.8881439
CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"


@dataclass
class Page:
    title: str
    description: str
    path: str
    body: str = ""
    image: str = "/brand/og-image.png"
    og_type: str = "website"
    data: list[dict] = field(default_factory=list)
    status: int = 200
    index: bool = True


def site() -> str:
    return get_settings().public_site_url.rstrip("/")


def absolute(url: str) -> str:
    return url if url.startswith("http") else f"{site()}{url}"


def clip(text: str, limit: int = 158) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0].rstrip(",;:") + "…"


@lru_cache(maxsize=1)
def _shell_from_disk() -> str | None:
    for f in SHELL_FILES:
        if f.is_file():
            return f.read_text(encoding="utf-8")
    return None


_fetched: dict[str, str] = {}


def shell() -> str:
    """The built index.html. Read from disk, else fetched once from the site's own static copy."""
    found = _shell_from_disk()
    if found:
        return found
    if "html" not in _fetched:
        r = httpx.get(f"{site()}/shell.html", timeout=10)
        r.raise_for_status()
        _fetched["html"] = r.text
    return _fetched["html"]


def e(text: object) -> str:
    return html.escape(str(text), quote=True)


def render(page: Page) -> str:
    out = shell()
    url = absolute(page.path)
    head = [
        f"<title>{e(page.title)}</title>",
        f'<meta name="description" content="{e(page.description)}" />',
        f'<link rel="canonical" href="{e(url)}" />',
        f'<meta property="og:type" content="{page.og_type}" />',
        f'<meta property="og:site_name" content="{BRAND}" />',
        f'<meta property="og:title" content="{e(page.title)}" />',
        f'<meta property="og:description" content="{e(page.description)}" />',
        f'<meta property="og:url" content="{e(url)}" />',
        f'<meta property="og:image" content="{e(absolute(page.image))}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
    ]
    if page.image.endswith("og-image.png"):
        head += [
            '<meta property="og:image:width" content="1200" />',
            '<meta property="og:image:height" content="630" />',
        ]
    if not page.index:
        head.append('<meta name="robots" content="noindex" />')
    for d in page.data:
        blob = json.dumps(d, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        head.append(f'<script type="application/ld+json">{blob}</script>')
    # The shell's own title, description and preview tags are replaced by this page's.
    out = re.sub(r"<title>.*?</title>\s*", "", out, flags=re.S)
    out = re.sub(r'<meta (?:name="(?:description|twitter:[^"]*)"|property="og:[^"]*")[^>]*>\s*', "", out)
    out = out.replace("</head>", "    " + "\n    ".join(head) + "\n  </head>", 1)
    return out.replace('<div id="root"></div>', f'<div id="root">{page.body}</div>', 1)


def nav(categories: list[Category]) -> str:
    links = "".join(f'<li><a href="/shop/{e(c.id)}">{e(c.name)}</a></li>' for c in categories)
    return f'<nav><ul><li><a href="/">{BRAND}</a></li><li><a href="/shop">Shop all</a></li>{links}<li><a href="/story">Our story</a></li></ul></nav>'


def product_list(products: list[Product]) -> str:
    items = "".join(
        f'<li><a href="/p/{e(p.slug)}">{e(p.name)}</a> · Raag {e(p.raga)} · {rupees(p.price)}</li>' for p in products
    )
    return f"<ul>{items}</ul>" if items else ""


def store_data(db) -> dict:
    s = store_settings(db)
    data = {
        "@context": "https://schema.org",
        "@type": "ClothingStore",
        "name": BRAND,
        "url": site() + "/",
        "image": absolute("/brand/og-image.png"),
        "logo": absolute("/brand/logo-plum.png"),
        "description": TAGLINE,
        "priceRange": "₹₹",
        "currenciesAccepted": "INR",
    }
    if s.contact_phone:
        data["telephone"] = f"+91{s.contact_phone[-10:]}"
    if s.contact_email:
        data["email"] = s.contact_email
    if s.contact_address:
        data["address"] = {
            "@type": "PostalAddress",
            "streetAddress": s.contact_address.split(", Tiruchengode")[0],
            "addressLocality": "Tiruchengode",
            "addressRegion": "Tamil Nadu",
            "postalCode": (re.findall(r"\b6\d{5}\b", s.contact_address) or [""])[-1],
            "addressCountry": "IN",
        }
    if s.contact_address:
        # The showroom's pin on Google Maps (Raga Boutique, Erode Main Road, Tiruchengode).
        data["geo"] = {"@type": "GeoCoordinates", "latitude": SHOP_LAT, "longitude": SHOP_LNG}
        data["hasMap"] = f"https://www.google.com/maps/search/?api=1&query={SHOP_LAT},{SHOP_LNG}"
    social = [u for u in (s.instagram_url, s.facebook_url) if u]
    if social:
        data["sameAs"] = social
    if hours := opening_hours(s.contact_hours):
        data["openingHoursSpecification"] = hours
    return data


DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_DAY = r"(mon|tue|wed|thu|fri|sat|sun)[a-z]*"
_TIME = r"(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)"


def _clock(h: str, m: str | None, half: str) -> str:
    hour = int(h) % 12 + (12 if half.lower() == "pm" else 0)
    return f"{hour:02d}:{m or '00'}"


def opening_hours(text: str) -> list[dict]:
    """Opening hours from the shop's hours line, e.g. "Mon–Sat 10 am – 8 pm · Sunday closed". Empty if unclear."""
    found = re.search(rf"{_DAY}\s*(?:–|-|to)\s*{_DAY}\s+{_TIME}\s*(?:–|-|to)\s*{_TIME}", text or "", re.I)
    if not found:
        return []
    first, last, h1, m1, a1, h2, m2, a2 = found.groups()
    names = [d[:3].lower() for d in DAYS]
    start, end = names.index(first.lower()), names.index(last.lower())
    if end < start:
        return []
    return [
        {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [f"https://schema.org/{d}" for d in DAYS[start : end + 1]],
            "opens": _clock(h1, m1, a1),
            "closes": _clock(h2, m2, a2),
        }
    ]


def active_categories(db) -> list[Category]:
    return list(db.scalars(select(Category).where(Category.active.is_(True)).order_by(Category.sort)))


def active_products(db, category: str | None = None) -> list[Product]:
    q = (
        select(Product)
        .join(Category)
        .where(Product.active.is_(True), Category.active.is_(True))
        .options(selectinload(Product.images), selectinload(Product.variants))
        .order_by(Product.sort, Product.id)
    )
    if category:
        q = q.where(Product.category_id == category)
    return list(db.scalars(q))


# As in the shipping and returns policies: dispatch in 2-3 working days, delivery in 3-6, India only, and no returns
# for a change of mind (a damaged or wrong piece is replaced or refunded).
RETURN_POLICY = {
    "@type": "MerchantReturnPolicy",
    "applicableCountry": "IN",
    "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
}


def shipping_details(s, price: int) -> dict:
    days = lambda lo, hi: {"@type": "QuantitativeValue", "minValue": lo, "maxValue": hi, "unitCode": "DAY"}  # noqa: E731
    return {
        "@type": "OfferShippingDetails",
        "shippingRate": {
            "@type": "MonetaryAmount",
            "value": 0 if price >= s.free_ship_above else s.ship_fee,
            "currency": "INR",
        },
        "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "IN"},
        "deliveryTime": {"@type": "ShippingDeliveryTime", "handlingTime": days(2, 3), "transitTime": days(3, 6)},
    }


def product_page(db, slug: str) -> Page | None:
    p = db.scalar(
        select(Product)
        .where(Product.slug == slug, Product.active.is_(True))
        .options(selectinload(Product.images), selectinload(Product.variants), selectinload(Product.category))
    )
    if not p or not p.category.active:
        return None
    stock = sum(v.stock for v in p.variants)
    facts = [x for x in (p.material, p.work, p.color) if x]
    desc = clip(p.raga_note or f"{p.name} from {BRAND}. {', '.join(facts)}.")
    images = [absolute(i.url) for i in p.images]
    offer = {
        "@type": "Offer",
        "price": p.price,
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock" if stock > 0 else "https://schema.org/OutOfStock",
        "url": absolute(f"/p/{p.slug}"),
        "itemCondition": "https://schema.org/NewCondition",
        "seller": {"@type": "Organization", "name": BRAND},
        "shippingDetails": shipping_details(store_settings(db), p.price),
        "hasMerchantReturnPolicy": RETURN_POLICY | {"merchantReturnLink": absolute("/policies/returns")},
    }
    product = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": p.name,
        "description": clip(p.raga_note or desc, 500),
        "sku": p.slug,
        "brand": {"@type": "Brand", "name": BRAND},
        "category": p.category.name,
        "offers": offer,
    }
    if images:
        product["image"] = images
    if p.color:
        product["color"] = p.color
    if p.material:
        product["material"] = p.material
    # Ratings come only from customers whose order with the piece was delivered.
    avg, count = reviews.summary(db, p.id)
    rated = ""
    if count:
        product["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": avg,
            "reviewCount": count,
            "bestRating": 5,
        }
        product["review"] = [
            {
                "@type": "Review",
                "author": {"@type": "Person", "name": r.name or "Customer"},
                "datePublished": r.created_at.date().isoformat(),
                "reviewRating": {"@type": "Rating", "ratingValue": r.rating, "bestRating": 5},
                **({"reviewBody": r.comment} if r.comment else {}),
            }
            for r in reviews.latest(db, 5, product_id=p.id, best=True)
        ]
        rated = f"<p>Rated {avg} out of 5 by {count} customer{'s' if count != 1 else ''}</p>"
    crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Shop", "item": absolute("/shop")},
            {"@type": "ListItem", "position": 2, "name": p.category.name, "item": absolute(f"/shop/{p.category_id}")},
            {"@type": "ListItem", "position": 3, "name": p.name, "item": absolute(f"/p/{p.slug}")},
        ],
    }
    details = "".join(f"<li>{e(d)}</li>" for d in p.details or [])
    mrp = f" <s>{rupees(p.mrp)}</s>" if p.mrp and p.mrp > p.price else ""
    body = (
        f'<main><p><a href="/shop">Shop</a> / <a href="/shop/{e(p.category_id)}">{e(p.category.name)}</a></p>'
        f"<h1>{e(p.name)}</h1><p>Raag {e(p.raga)}</p><p>{rupees(p.price)}{mrp} · "
        f"{'In stock' if stock > 0 else 'Sold out'}</p>{rated}<p>{e(p.raga_note)}</p>"
        f"{f'<ul>{details}</ul>' if details else ''}{f'<p>Care: {e(p.care)}</p>' if p.care else ''}</main>"
    )
    return Page(
        title=f"{p.name} · {BRAND}",
        description=desc,
        path=f"/p/{p.slug}",
        body=body,
        image=p.images[0].url if p.images else "/brand/og-image.png",
        og_type="product",
        data=[product, crumbs],
    )


def page_for(db, path: str) -> Page:
    path = path.strip("/")
    s = store_settings(db)
    free = f"Free shipping across India above {rupees(s.free_ship_above)}."
    if path == "":
        cats = active_categories(db)
        body = (
            f"{nav(cats)}<main><h1>{BRAND}: The Music of Colours</h1><p>{TAGLINE} {free}</p>"
            f'<h2>New in</h2>{product_list(active_products(db)[:12])}<p><a href="/shop">Shop all</a></p></main>'
        )
        website = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": BRAND,
            "url": site() + "/",
            "potentialAction": {
                "@type": "SearchAction",
                "target": f"{site()}/shop?q={{search_term_string}}",
                "query-input": "required name=search_term_string",
            },
        }
        home_desc = f"Handwoven silk sarees and ethnic wear from {BRAND}, Tiruchengode, each named after a raga. {free}"
        return Page(
            f"{BRAND} | Silk Sarees & Ethnic Wear in Tiruchengode", home_desc, "/", body, data=[store_data(db), website]
        )
    if path == "shop":
        cats = active_categories(db)
        return Page(
            f"Shop Sarees & Ethnic Wear · {BRAND}",
            clip(f"Shop handwoven sarees, lehengas, anarkalis and dress materials from {BRAND}, Tiruchengode. {free}"),
            "/shop",
            f"{nav(cats)}<main><h1>Shop all</h1>{product_list(active_products(db))}</main>",
        )
    if m := re.fullmatch(r"shop/([\w-]+)", path):
        cats = active_categories(db)
        cat = next((c for c in cats if c.id == m.group(1)), None)
        if cat:
            items = active_products(db, cat.id)
            return Page(
                f"{cat.name} Online · {BRAND}",
                clip(
                    f"Shop {cat.name.lower()} at {BRAND}: {len(items)} handpicked pieces, each named after a raga. {free}"
                ),
                f"/shop/{cat.id}",
                f"{nav(cats)}<main><h1>{e(cat.name)}</h1>{product_list(items)}</main>",
            )
    if m := re.fullmatch(r"p/([\w-]+)", path):
        found = product_page(db, m.group(1))
        if found:
            return found
    if path == "story":
        return Page(
            f"Our story · {BRAND}",
            "How Raga Boutique in Tiruchengode chooses each saree the way you'd choose a song: by the mood it leaves you in.",
            "/story",
            f"{nav(active_categories(db))}{page_text.story(s)}",
        )
    if (m := re.fullmatch(r"policies/([\w-]+)", path)) and m.group(1) in POLICIES:
        title, desc = POLICIES[m.group(1)]
        body = f"<main><h1>{e(title)}</h1>{page_text.policy(m.group(1), s)}</main>"
        return Page(f"{title} · {BRAND}", desc, f"/{path}", body)
    if PRIVATE.fullmatch(path):
        return Page(BRAND, TAGLINE, f"/{path}", index=False)
    return Page(
        f"Page not found · {BRAND}",
        "This page is out of tune. Browse the shop instead.",
        f"/{path}",
        '<main><h1>Page not found</h1><p><a href="/shop">Browse the shop</a></p></main>',
        status=404,
        index=False,
    )


# Pages of the earlier site on this domain (a static site), sent to their closest page here so old links and
# search results keep working. A weave, fabric, colour or search filter becomes a search on the new page.
OLD_PAGES = {
    "index.html": "/",
    "sarees.html": "/shop/sarees",
    "kurtas.html": "/shop/ethnic",
    "wishlist.html": "/wishlist",
    "cart.html": "/",
    "admin.html": "/admin",
}


def old_page_target(path: str, params) -> str:
    target = OLD_PAGES[path]
    term = next((params[k] for k in ("search", "weave", "fabric", "color") if params.get(k)), "")
    if term and target.startswith("/shop"):
        target += "?" + urlencode({"q": term[:80]})
    return target


@router.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
def robots():
    return PlainTextResponse(
        "User-agent: *\n"
        "Disallow: /admin\nDisallow: /account\nDisallow: /checkout\nDisallow: /orders/\nDisallow: /wishlist\n"
        "Disallow: /api/\n\n"
        f"Sitemap: {site()}/sitemap.xml\n",
        headers={"Cache-Control": CACHE},
    )


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap(db: DB):
    urls: list[tuple[str, str | None]] = [("/", None), ("/shop", None), ("/story", None)]
    urls += [(f"/shop/{c.id}", None) for c in active_categories(db)]
    urls += [(f"/p/{p.slug}", p.updated_at.date().isoformat() if p.updated_at else None) for p in active_products(db)]
    urls += [(f"/policies/{t}", None) for t in POLICIES]
    rows = "".join(
        f"<url><loc>{xml_escape(absolute(u))}</loc>{f'<lastmod>{d}</lastmod>' if d else ''}</url>" for u, d in urls
    )
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{rows}</urlset>'
    return Response(xml, media_type="application/xml", headers={"Cache-Control": CACHE})


@router.get("/llms.txt", response_class=PlainTextResponse, include_in_schema=False)
def llms(db: DB):
    s = store_settings(db)
    cats = "\n".join(f"- [{c.name}]({site()}/shop/{c.id})" for c in active_categories(db))
    pols = "\n".join(f"- [{t}]({site()}/policies/{k})" for k, (t, _) in POLICIES.items())
    contact = " · ".join(
        x for x in (s.contact_phone and f"+91 {s.contact_phone}", s.contact_email, s.contact_address) if x
    )
    text = (
        f"# {BRAND}\n\n> {TAGLINE} Showroom in Tiruchengode, Tamil Nadu; ships across India.\n\n"
        f"Contact: {contact}\n\n## Shop\n\n- [All pieces]({site()}/shop)\n{cats}\n\n## Policies\n\n{pols}\n\n"
        f"Full catalogue with prices: {site()}/sitemap.xml\n"
    )
    return PlainTextResponse(text, headers={"Cache-Control": CACHE})


@router.get("/{full_path:path}", include_in_schema=False)
def page(full_path: str, request: Request, db: DB):
    if full_path.startswith(("api/", "uploads/", "assets/", "brand/")):
        raise HTTPException(404)
    if full_path in OLD_PAGES:
        return RedirectResponse(old_page_target(full_path, request.query_params), status_code=301)
    if full_path.endswith("/"):
        # One address per page: /shop/ moves permanently to /shop, keeping any search.
        target = "/" + full_path.strip("/") + (f"?{request.url.query}" if request.url.query else "")
        return RedirectResponse(target, status_code=301)
    pg = page_for(db, full_path)
    try:
        doc = render(pg)
    except (OSError, httpx.HTTPError) as err:
        log.warning("Page shell unavailable: %s", err)
        raise HTTPException(503, {"message": "The site is updating. Please refresh in a moment."}) from None
    return HTMLResponse(doc, status_code=pg.status, headers={"Cache-Control": CACHE if pg.index else "no-store"})
