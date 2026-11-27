"""Shop search: spelling variants and local words shoppers use for the same thing."""

import re

GROUPS = (
    ("saree", "sari", "sarees", "saris", "saree's", "sadi", "saadi", "selai", "sealai", "pudavai", "podavai"),
    ("silk", "pattu", "pattu saree", "resham", "reshmi"),
    ("kanjivaram", "kanchipuram", "kancheepuram", "kanjeevaram", "kanjeevaram", "kanchi", "kanjivaram silk"),
    ("banarasi", "banaras", "benarasi", "benaras", "varanasi"),
    (
        "lehenga",
        "lehanga",
        "lehnga",
        "lengha",
        "ghagra",
        "ghagara",
        "chaniya",
        "half saree",
        "dhavani",
        "davani",
        "pavadai",
    ),
    ("anarkali", "anarkalli", "salwar", "salwar kameez", "churidar", "suit", "kurta", "kurti"),
    ("dress material", "dress materials", "unstitched", "material"),
    ("bridal", "bride", "wedding", "marriage", "muhurtham", "muhurtam", "kalyanam"),
    ("zari", "jari"),
    ("cotton", "cottan", "handloom"),
    ("georgette", "georgete", "jorjet"),
    ("chiffon", "shifon"),
    ("organza", "organja"),
    ("blouse", "blouse piece"),
)
_LOOKUP: dict[str, tuple[str, ...]] = {}
for group in GROUPS:
    for word in group:
        _LOOKUP[word] = group


def terms(word: str) -> list[str]:
    """Every spelling that should match one search word, the word itself first."""
    w = word.strip().lower()
    if not w:
        return []
    found = _LOOKUP.get(w) or (_LOOKUP.get(w[:-1]) if w.endswith("s") and len(w) > 3 else None)
    out = [w, *(found or ())]
    if w.endswith("s") and len(w) > 3:
        out.append(w[:-1])
    return list(dict.fromkeys(out))


def words(q: str | None, limit: int = 6) -> list[str]:
    """The search split into words, keeping two-word phrases we know (half saree, dress material)."""
    text = re.sub(r"\s+", " ", (q or "").strip().lower())
    out: list[str] = []
    parts = text.split(" ") if text else []
    i = 0
    while i < len(parts) and len(out) < limit:
        pair = f"{parts[i]} {parts[i + 1]}" if i + 1 < len(parts) else ""
        if pair in _LOOKUP:
            out.append(pair)
            i += 2
        else:
            out.append(parts[i])
            i += 1
    return out
