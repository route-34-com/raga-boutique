from app.models import Product
from app.schemas.catalog import ProductDetail


class AdminProduct(ProductDetail):
    active: bool
    sort: int


def product_out(p: Product) -> AdminProduct:
    return AdminProduct.model_validate(p)
