"""Reviews: only a customer whose order with that piece was delivered can write one."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import ServiceError
from app.models import Order, OrderItem, Product, Review, User
from app.schemas.review import ReviewIn


def save(db: Session, user: User, data: ReviewIn) -> Review:
    order = db.scalar(select(Order).join(OrderItem).where(Order.user_id == user.id, Order.status == "delivered",
                                                         OrderItem.product_id == data.product_id).order_by(Order.id.desc()))
    if not order:
        raise ServiceError("You can review a piece once your order with it has been delivered.", 403)
    r = db.scalar(select(Review).where(Review.product_id == data.product_id, Review.user_id == user.id)) \
        or Review(product_id=data.product_id, user_id=user.id)
    r.rating, r.comment = data.rating, data.comment
    r.name = (order.customer_name or user.name or "Customer").split()[0][:40]
    r.city = (order.address or {}).get("city", "")[:60]
    db.add(r)
    db.commit()
    return r


def summary(db: Session, product_id: int | None = None) -> tuple[float, int]:
    q = select(func.avg(Review.rating), func.count(Review.id))
    if product_id is not None:
        q = q.where(Review.product_id == product_id)
    avg, count = db.execute(q).one()
    return round(float(avg or 0), 1), count


def with_product(r: Review) -> dict:
    p = r.product
    return {"id": r.id, "rating": r.rating, "comment": r.comment, "name": r.name, "city": r.city, "created_at": r.created_at,
            "product": {"name": p.name, "slug": p.slug, "image": p.images[0].url if p.images else ""}}


def latest(db: Session, limit: int, product_id: int | None = None, best: bool = False) -> list[Review]:
    """Newest first; with best=True, highest rating first (newest first among equals), as shoppers see them."""
    newest = (Review.created_at.desc(), Review.id.desc())
    q = select(Review).options(selectinload(Review.product).selectinload(Product.images), selectinload(Review.user)) \
        .order_by(*((Review.rating.desc(), *newest) if best else newest)).limit(limit)
    if product_id is not None:
        q = q.where(Review.product_id == product_id)
    return list(db.scalars(q))
