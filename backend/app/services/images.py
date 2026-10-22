import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import ServiceError

MAX_BYTES = 12 * 1024 * 1024
MAX_SIDE = 1600


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
    name = f"{uuid.uuid4().hex}.jpg"
    folder = get_settings().uploads_dir / "products"
    folder.mkdir(parents=True, exist_ok=True)
    img.save(folder / name, "JPEG", quality=85, optimize=True, progressive=True)
    return f"/uploads/products/{name}"


def delete_product_image(url: str) -> None:
    if url.startswith("/uploads/products/"):
        path: Path = get_settings().uploads_dir / "products" / Path(url).name
        path.unlink(missing_ok=True)
