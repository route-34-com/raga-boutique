from app.schemas.common import Out


class CategoryOut(Out):
    id: str
    name: str
    sort: int
    active: bool


class ImageOut(Out):
    id: int
    url: str


class VariantOut(Out):
    size: str
    stock: int


class ProductCard(Out):
    id: int
    slug: str
    name: str
    raga: str
    category_id: str
    mood: str
    price: int
    mrp: int | None
    tag: str
    swatch: str
    images: list[ImageOut]
    variants: list[VariantOut]
    total_stock: int


class ProductDetail(ProductCard):
    raga_note: str
    details: list[str]
    care: str


class PublicSettings(Out):
    free_ship_above: int
    ship_fee: int
    contact_phone: str = ""
    contact_whatsapp: str = ""
    contact_email: str = ""
    contact_address: str = ""
    contact_hours: str = ""
