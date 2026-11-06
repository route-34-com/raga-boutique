from fastapi import APIRouter

from app.routers.admin import business, categories, customers, dashboard, orders, products, reviews, settings

router = APIRouter(prefix="/api/admin", tags=["admin"])
for module in (dashboard, orders, products, categories, customers, reviews, settings, business):
    router.include_router(module.router)
