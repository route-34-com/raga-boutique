import json
import re

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import pages

SHELL = (
    '<!doctype html><html><head><meta charset="UTF-8" /><title>Old</title>'
    '<meta name="description" content="old" /><meta property="og:title" content="old" />'
    '<script type="module" src="/assets/x.js"></script></head><body><div id="root"></div></body></html>'
)


@pytest.fixture(autouse=True)
def fixed_shell(monkeypatch):
    monkeypatch.setattr(pages, "shell", lambda: SHELL)


def get(path: str):
    return TestClient(app).get(path)


def ld(html: str) -> list[dict]:
    return [json.loads(x) for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html)]


def test_product_page_has_its_own_head_content_and_structured_data():
    r = get("/p/yaman")
    assert r.status_code == 200
    h = r.text
    assert "<title>Aubergine Banarasi · Raga Boutique</title>" in h
    assert h.count("<title>") == 1 and 'content="old"' not in h
    assert '<link rel="canonical" href="http://localhost:5173/p/yaman" />' in h
    assert "<h1>Aubergine Banarasi</h1>" in h and "₹11,800" in h
    product = next(d for d in ld(h) if d["@type"] == "Product")
    assert product["offers"]["price"] == 11800 and product["offers"]["availability"].endswith("InStock")
    ship = product["offers"]["shippingDetails"]
    assert ship["shippingRate"]["value"] == 0 and ship["shippingDestination"]["addressCountry"] == "IN"
    assert ship["deliveryTime"]["transitTime"]["maxValue"] == 6
    assert product["offers"]["hasMerchantReturnPolicy"]["returnPolicyCategory"].endswith("MerchantReturnNotPermitted")
    megh = next(d for d in ld(get("/p/megh").text) if d["@type"] == "Product")
    assert megh["offers"]["shippingDetails"]["shippingRate"]["value"] == 150
    assert '<script type="module" src="/assets/x.js">' in h


def test_home_category_and_policy_pages():
    home = get("/")
    assert home.status_code == 200 and "ClothingStore" in home.text and 'href="/p/megh"' in home.text
    cat = get("/shop/sarees")
    assert cat.status_code == 200 and "<title>Sarees Online · Raga Boutique</title>" in cat.text
    pol = get("/policies/returns")
    assert pol.status_code == 200 and "Cancellation &amp; refunds" in pol.text


def test_unknown_pages_are_real_404s_and_private_pages_are_not_indexed():
    for path in ("/no-such-page", "/p/no-such-saree", "/shop/no-such-category", "/policies/nope"):
        r = get(path)
        assert r.status_code == 404, path
        assert 'content="noindex"' in r.text
    acc = get("/account")
    assert acc.status_code == 200 and 'content="noindex"' in acc.text
    assert get("/api/does-not-exist").status_code == 404


def test_robots_sitemap_and_llms():
    robots = get("/robots.txt")
    assert robots.status_code == 200 and "Sitemap: http://localhost:5173/sitemap.xml" in robots.text
    assert "Disallow: /admin" in robots.text
    sm = get("/sitemap.xml")
    assert sm.status_code == 200 and sm.headers["content-type"].startswith("application/xml")
    assert "<loc>http://localhost:5173/p/yaman</loc>" in sm.text and "/policies/terms" in sm.text
    llms = get("/llms.txt")
    assert llms.status_code == 200 and llms.text.startswith("# Raga Boutique")


def test_rupees():
    assert [pages.rupees(n) for n in (450, 7450, 11800, 123450, 1234567)] == [
        "₹450",
        "₹7,450",
        "₹11,800",
        "₹1,23,450",
        "₹12,34,567",
    ]


def test_policy_and_story_pages_carry_their_full_text(monkeypatch):
    from app.routers import page_text

    monkeypatch.setattr(page_text, "online_on", lambda: False)
    r = get("/policies/returns")
    assert "within 48 hours of delivery" in r.text and "5–7 working days" in r.text
    assert "Razorpay" not in r.text
    monkeypatch.setattr(page_text, "online_on", lambda: True)
    assert "through Razorpay are refunded" in get("/policies/returns").text
    story = get("/story")
    assert "Raga began in 2013" in story.text and "Dry clean silks" in story.text


def test_key_policy_facts_match_the_react_pages():
    from pathlib import Path

    front = Path(__file__).resolve().parents[2] / "frontend" / "src" / "pages" / "store"
    react = (front / "Policies.tsx").read_text(encoding="utf-8") + (front / "Story.tsx").read_text(encoding="utf-8")
    react = " ".join(react.split())
    for fact in (
        "dispatched within 2–3 working days",
        "Delivery takes 3–6 working days",
        "within 48 hours of delivery",
        "usually reach you in 5–7 working days",
        "courts of Namakkal district",
        "isn't paid within 30 minutes",
        "Raga began in 2013",
        "We dispatch within 2–3 working days of confirming your order",
        "Yes, on request. Message us on WhatsApp after you order",
    ):
        assert fact in react, f"React text changed: {fact!r}; update app/routers/page_text.py to match"


def test_product_ratings_and_shop_hours_in_structured_data():
    from app.core.db import SessionLocal
    from app.models import Product, Review, StoreSettings, User

    with SessionLocal() as db:
        u = User(phone="+919811111111", name="Lakshmi")
        db.add(u)
        db.flush()
        pid = db.query(Product).filter_by(slug="yaman").one().id
        db.add(Review(product_id=pid, user_id=u.id, rating=5, comment="Lovely weave", name="Lakshmi"))
        db.get(StoreSettings, 1).contact_hours = "Mon–Sat 10 am – 8 pm · Sunday closed"
        db.commit()
    product = next(d for d in ld(get("/p/yaman").text) if d["@type"] == "Product")
    assert product["aggregateRating"]["ratingValue"] == 5.0 and product["aggregateRating"]["reviewCount"] == 1
    assert product["review"][0]["reviewBody"] == "Lovely weave"
    shop = next(d for d in ld(get("/").text) if d["@type"] == "ClothingStore")
    hours = shop["openingHoursSpecification"][0]
    assert (hours["opens"], hours["closes"], len(hours["dayOfWeek"])) == ("10:00", "20:00", 6)
    assert shop.get("geo", {}).get("latitude") == 11.3781119 or "address" not in shop
    assert pages.opening_hours("open all day") == []


def test_trailing_slash_moves_to_one_address():
    c = TestClient(app, follow_redirects=False)
    r = c.get("/shop/")
    assert r.status_code == 301 and r.headers["location"] == "/shop"
    r = c.get("/p/yaman/?ref=wa")
    assert r.status_code == 301 and r.headers["location"] == "/p/yaman?ref=wa"
    assert c.get("/").status_code == 200
    assert c.get("/%2Fevil.example/").headers["location"] == "/evil.example"


def test_common_questions_page():
    r = get("/policies/faq")
    assert r.status_code == 200 and "<title>Common questions · Raga Boutique</title>" in r.text
    assert "Can I pay cash on delivery?" in r.text and "within 48 hours of delivery" in r.text
    assert "/policies/faq" in get("/sitemap.xml").text


def test_old_site_pages_redirect_to_their_new_pages():
    c = TestClient(app, follow_redirects=False)
    cases = {
        "/index.html": "/",
        "/sarees.html": "/shop/sarees",
        "/sarees.html?weave=Kanjivaram": "/shop/sarees?q=Kanjivaram",
        "/sarees.html?fabric=Silk&sort=rating": "/shop/sarees?q=Silk",
        "/sarees.html?search=red%20silk": "/shop/sarees?q=red+silk",
        "/kurtas.html?color=Blue": "/shop/ethnic?q=Blue",
        "/wishlist.html": "/wishlist",
        "/cart.html": "/",
        "/admin.html": "/admin",
    }
    for old, new in cases.items():
        r = c.get(old)
        assert (r.status_code, r.headers["location"]) == (301, new), old
