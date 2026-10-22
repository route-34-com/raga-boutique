from fastapi import APIRouter, HTTPException, Response

from app.core.deps import DB, Admin
from app.models import Review
from app.schemas.review import AdminReview
from app.services import reviews

router = APIRouter(prefix="/reviews")


@router.get("", response_model=list[AdminReview])
def list_reviews(_: Admin, db: DB, limit: int = 200):
    return [{**reviews.with_product(r), "phone": r.user.phone} for r in reviews.latest(db, min(limit, 500))]


@router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, _: Admin, db: DB):
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(404, {"message": "Review not found."})
    db.delete(r)
    db.commit()
    return Response(status_code=204)
