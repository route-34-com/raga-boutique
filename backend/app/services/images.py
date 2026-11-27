import re
import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.errors import ServiceError
from app.models import ImageFile

MAX_BYTES = 12 * 1024 * 1024
MAX_SIDE = 1600
URL_PREFIX = "/uploads/products/"
# Smaller copies for phones and product cards: "<name>.w480.jpg" and "<name>.w960.jpg" next to "<name>.jpg".
WIDTHS = (480, 960)
VARIANT = re.compile(r"^(?P<stem>[\w-]+)\.w(?P<width>480|960)\.jpg$")
SAFE_NAME = re.compile(r"^[\w.-]+\.jpg$")


def store_image_file(name: str, data: bytes) -> str:
    """Writes finished JPEG bytes to the configured store. Returns the public URL path."""
    if get_settings().image_store == "db":
        with SessionLocal() as db:
            db.merge(ImageFile(name=name, data=data))
            db.commit()
    else:
        folder = get_settings().uploads_dir / "products"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / name).write_bytes(data)
    return URL_PREFIX + name


def load_image_file(name: str) -> bytes | None:
    """A stored photo's bytes from the configured store, or None."""
    if not SAFE_NAME.fullmatch(name):
        return None
    if get_settings().image_store == "db":
        with SessionLocal() as db:
            f = db.get(ImageFile, name)
            return f.data if f else None
    path = get_settings().uploads_dir / "products" / name
    return path.read_bytes() if path.is_file() else None


def _shrink(data: bytes, width: int) -> bytes:
    img = Image.open(BytesIO(data)).convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    out = BytesIO()
    img.save(out, "JPEG", quality=80, optimize=True, progressive=True)
    return out.getvalue()


def load_or_make_variant(name: str) -> bytes | None:
    """A smaller copy of a stored photo; made from the original and kept the first time it's asked for."""
    found = load_image_file(name)
    m = VARIANT.fullmatch(name)
    if found is not None or not m:
        return found
    original = load_image_file(f"{m['stem']}.jpg")
    if original is None:
        return None
    data = _shrink(original, int(m["width"]))
    store_image_file(name, data)
    return data


def save_product_image(raw: bytes) -> str:
    """Resizes to at most 1600px, strips metadata, stores as JPEG. Returns the public URL path."""
    if len(raw) > MAX_BYTES:
        raise ServiceError("Photo is too large (max 12 MB).", 413)
    try:
        img = Image.open(BytesIO(raw))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise ServiceError("That file isn't a photo we can read.", 415) from None
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = BytesIO()
    img.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    stem = uuid.uuid4().hex
    for width in WIDTHS:
        store_image_file(f"{stem}.w{width}.jpg", _shrink(out.getvalue(), width))
    return store_image_file(f"{stem}.jpg", out.getvalue())


def delete_product_image(url: str) -> None:
    if not url.startswith(URL_PREFIX):
        return
    name = Path(url).name
    stem = name.removesuffix(".jpg")
    names = [name, *(f"{stem}.w{w}.jpg" for w in WIDTHS)]
    if get_settings().image_store == "db":
        with SessionLocal() as db:
            for n in names:
                if f := db.get(ImageFile, n):
                    db.delete(f)
            db.commit()
    else:
        for n in names:
            (get_settings().uploads_dir / "products" / n).unlink(missing_ok=True)
