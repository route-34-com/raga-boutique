"""Order messages on WhatsApp and email. Each (order, kind, channel) is attempted once and recorded; nothing here raises."""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Notification, Order, StoreSettings
from app.services.notify import email, messages, templates, whatsapp

log = logging.getLogger(__name__)


def notify(db: Session, order: Order, kind: str) -> list[Notification]:
    try:
        return _notify(db, order, kind)
    except Exception:  # a message must never break an order change
        log.exception("notify(%s, %s) failed", order.id, kind)
        db.rollback()
        return []


def _notify(db: Session, order: Order, kind: str) -> list[Notification]:
    cfg = db.get(StoreSettings, 1)
    couriers = (cfg.couriers if cfg else None) or []
    done = set(db.scalars(select(Notification.channel).where(Notification.order_id == order.id, Notification.kind == kind)))
    text = messages.render(kind, order, couriers)
    params = messages.params(kind, order, couriers)
    link = messages.track_link(order.courier, order.tracking_id, couriers) if kind == "shipped" else ""

    if kind == "new_order":
        wa_to, mail_to = (cfg.contact_whatsapp if cfg else ""), (cfg.contact_email if cfg else "")
        want_wa = get_settings().whatsapp_mode == "cloud" and bool(wa_to)  # the shop can't tap its own alert
    else:
        wa_to, mail_to, want_wa = order.phone, order.email, True

    made = []
    if want_wa and "whatsapp" not in done and (n := _claim(db, order, kind, "whatsapp")):
        made.append(_finish(db, n, whatsapp.send(wa_to, kind, text, params)))
    if "email" not in done and (n := _claim(db, order, kind, "email")):
        result = email.send(mail_to, templates.subject(kind, order), text, templates.html(text, order, link)) if mail_to \
            else ("skipped", "No email address")
        made.append(_finish(db, n, result))
    return made


def _claim(db: Session, order: Order, kind: str, channel: str) -> Notification | None:
    """Reserve the row before sending, so a second click at the same moment can't send again."""
    n = Notification(order_id=order.id, kind=kind, channel=channel, status="sending", detail="")
    db.add(n)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    return n


def _finish(db: Session, n: Notification, result: tuple[str, str]) -> Notification:
    n.status, n.detail = result
    db.commit()
    return n
