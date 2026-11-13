"""Razorpay webhook: marks an order paid even when the shopper closed the tab before returning to the shop."""

import json
import logging

from fastapi import APIRouter, Request
from sqlalchemy import select

from app.core.deps import DB
from app.core.errors import ServiceError
from app.models import Order
from app.services import orders as svc
from app.services import payments

router = APIRouter(prefix="/api/payments", tags=["payments"])
log = logging.getLogger(__name__)


@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request, db: DB):
    body = await request.body()
    if not payments.webhook_ok(body, request.headers.get("X-Razorpay-Signature", "")):
        return {"ok": False}
    event = json.loads(body)
    if event.get("event") in ("payment.captured", "order.paid"):
        pay = event.get("payload", {}).get("payment", {}).get("entity", {})
        order = db.scalar(select(Order).where(Order.gateway_order_id == pay.get("order_id", "")).with_for_update())
        if order and pay.get("id"):
            try:
                svc.mark_paid_online(db, order, pay["id"], "webhook")
            except ServiceError as e:
                log.warning("Webhook for %s: %s", order.order_no, e.message)
    return {"ok": True}
