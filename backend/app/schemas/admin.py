from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.order import OrderSummary

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]
Attr = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]


class AdminOrderRow(OrderSummary):
    customer_name: str
    address: dict
    phone: str
    payment_method: str
    payment_status: str


class StatusChange(BaseModel):
    status: str
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ""
    courier: Short = ""
    tracking_id: Short = ""


class DispatchItem(BaseModel):
    order_id: int
    courier: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    tracking_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class DispatchIn(BaseModel):
    items: list[DispatchItem] = Field(min_length=1, max_length=100)


class DispatchResult(BaseModel):
    order_id: int
    order_no: str
    ok: bool
    error: str = ""
    whatsapp_link: str = ""


class VariantIn(BaseModel):
    size: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)]
    stock: int = Field(ge=0, le=100_000)


class ProductIn(BaseModel):
    name: Name
    raga: Short = ""
    category_id: str
    mood: str = "festive"
    price: int = Field(gt=0)
    mrp: int | None = Field(default=None, ge=0)
    tag: Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)] = ""
    swatch: Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")] = "#c08040"
    raga_note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    details: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]] = []
    care: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""
    active: bool = True
    color: Attr = ""
    material: Attr = ""
    work: Attr = ""
    pattern: Attr = ""
    occasions: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]] = Field(default=[], max_length=8)
    variants: list[VariantIn] = Field(min_length=1, max_length=12)
    images: list[Annotated[str, StringConstraints(pattern=r"^/uploads/products/[\w.-]+$")]] = Field(min_length=1, max_length=12)  # first is the cover


class StockAdjust(BaseModel):
    size: str
    delta: int = Field(ge=-1000, le=1000)


class ActiveToggle(BaseModel):
    active: bool


class CategoryIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    active: bool = True


class CategoryPatch(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    active: bool | None = None


class Reorder(BaseModel):
    ids: list[str]


Mobile10 = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^(\d{10})?$")]
SocialUrl = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200, pattern=r"^(https://\S+)?$")]


class CourierIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    # Where the tracking ID goes, e.g. https://www.dtdc.in/tracking?awb={id}. Empty = no link in messages.
    track_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300, pattern=r"^(https?://\S*\{id\}\S*)?$")] = ""


class SettingsIn(BaseModel):
    free_ship_above: int = Field(ge=0)
    ship_fee: int = Field(ge=0)
    low_stock_at: int = Field(ge=0)
    contact_phone: Mobile10 = ""
    contact_whatsapp: Mobile10 = ""
    contact_email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120, pattern=r"^([^@\s]+@[^@\s]+\.[^@\s]+)?$")] = ""
    contact_address: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ""
    contact_hours: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    instagram_url: SocialUrl = ""
    facebook_url: SocialUrl = ""
    couriers: list[CourierIn] = Field(default_factory=list, max_length=20)


class AdminPhone(BaseModel):
    phone: Annotated[str, StringConstraints(pattern=r"^[6-9]\d{9}$")]
