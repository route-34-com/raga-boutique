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
    with SessionLocal() as db:
        f = db.get(ImageFile, name)
        return f.data if f else None


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
    return store_image_file(f"{uuid.uuid4().hex}.jpg", out.getvalue())


def delete_product_image(url: str) -> None:
    if not url.startswith(URL_PREFIX):
        return
    name = Path(url).name
    if get_settings().image_store == "db":
        with SessionLocal() as db:
            if f := db.get(ImageFile, name):
                db.delete(f)
                db.commit()
    else:
        (get_settings().uploads_dir / "products" / name).unlink(missing_ok=True)
