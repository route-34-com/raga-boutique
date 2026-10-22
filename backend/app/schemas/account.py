from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.schemas.common import Out

Mobile = Annotated[str, StringConstraints(pattern=r"^[6-9]\d{9}$")]
Pincode = Annotated[str, StringConstraints(pattern=r"^[1-9]\d{5}$")]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class OtpRequest(BaseModel):
    phone: Mobile


class OtpRequested(BaseModel):
    sent: bool = True
    resend_in: int
    dev_code: str | None = None  # only when OTP_PROVIDER=console (demo)


class OtpVerify(BaseModel):
    phone: Mobile
    code: Annotated[str, StringConstraints(pattern=r"^\d{6}$")]


class UserOut(Out):
    id: int
    phone: str
    name: str
    email: str
    is_admin: bool


class ProfileIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    email: EmailStr | None = None


class AddressIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    phone: Mobile
    line1: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    line2: Text = ""
    city: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
    state: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
    pincode: Pincode


class AddressOut(Out):
    id: int
    name: str
    phone: str
    line1: str
    line2: str
    city: str
    state: str
    pincode: str


class CartLine(BaseModel):
    product_id: int
    size: str | None = None
    qty: int = Field(ge=1, le=10)


class PlaceOrderIn(BaseModel):
    items: list[CartLine] = Field(min_length=1, max_length=20)
    address_id: int | None = None
    address: AddressIn | None = None
    email: EmailStr | None = None
    payment_method: str = "cod"
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] = ""
