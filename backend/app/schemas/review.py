from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.common import Out


class ReviewIn(BaseModel):
    product_id: int
    rating: int = Field(ge=1, le=5)
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=600)] = ""


class MyReview(Out):
    product_id: int
    rating: int
    comment: str


class ReviewProduct(BaseModel):
    name: str
    slug: str
    image: str


class ReviewOut(Out):
    id: int
    rating: int
    comment: str
    name: str
    city: str
    created_at: datetime


class ReviewWithProduct(ReviewOut):
    product: ReviewProduct


class ReviewList(BaseModel):
    average: float
    count: int
    reviews: list[ReviewWithProduct] | list[ReviewOut]


class AdminReview(ReviewWithProduct):
    phone: str
