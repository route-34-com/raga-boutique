from fastapi.testclient import TestClient

from app.core.db import SessionLocal
from app.main import app
from app.models import ONE_SIZE, Product, ProductImage, Variant
from app.services import search


def add_kanjivaram():
    with SessionLocal() as db:
        db.add(
            Product(
                slug="hindol",
                name="Marigold Kanjivaram Silk Saree",
                raga="Hindol",
                category_id="sarees",
                price=18500,
                material="Kanjivaram silk",
                details=["Pure zari border"],
                occasions=["Wedding"],
                images=[ProductImage(url="/uploads/products/z.jpg")],
                variants=[Variant(size=ONE_SIZE, stock=1)],
            )
        )
        db.commit()


def slugs(q: str) -> set[str]:
    r = TestClient(app).get("/api/products", params={"q": q})
    assert r.status_code == 200, r.text
    return {p["slug"] for p in r.json()}


def test_spelling_variants_and_local_words_find_pieces():
    add_kanjivaram()
    assert "hindol" in slugs("kanchipuram")
    assert "hindol" in slugs("kanjeevaram")
    assert "hindol" in slugs("pattu")
    assert "hindol" in slugs("pattu saree")
    assert slugs("sari") == slugs("saree") == {"yaman", "megh", "hindol"}
    assert "hindol" in slugs("jari")
    assert "hindol" in slugs("muhurtham")
    assert "yaman" in slugs("benarasi")


def test_every_word_still_has_to_match():
    add_kanjivaram()
    assert slugs("kanchipuram banarasi") == set()
    assert slugs("nothing-like-this") == set()


def test_terms_and_phrases():
    assert search.terms("Sarees")[:1] == ["sarees"]
    assert "saree" in search.terms("sarees")
    assert search.words("half  saree red") == ["half saree", "red"]
    assert search.terms("") == []
