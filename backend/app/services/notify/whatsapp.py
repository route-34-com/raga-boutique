"""WhatsApp: "tap" hands back a wa.me link for the owner to send; "cloud" sends through Meta's Cloud API."""

import logging
import re
from urllib.parse import quote

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)
# Meta template names, as approved in WhatsApp Manager (see README for their text).
TEMPLATES = {"accepted": "order_accepted", "shipped": "order_shipped", "new_order": "new_order_owner"}


def wa_link(phone: str, text: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        digits = "91" + digits
    return f"https://wa.me/{digits}?text={quote(text, safe='')}"


def send(to_phone: str, kind: str, text: str, params: list[str]) -> tuple[str, str]:
    s = get_settings()
    if s.whatsapp_mode != "cloud":
        return "tap", wa_link(to_phone, text)
    to = wa_link(to_phone, "").split("/")[-1].split("?")[0]
    body = {"messaging_product": "whatsapp", "to": to, "type": "template",
            "template": {"name": TEMPLATES[kind], "language": {"code": s.whatsapp_lang},
                         "components": [{"type": "body", "parameters": [{"type": "text", "text": v or "-"} for v in params]}]}}
    try:
        r = httpx.post(f"https://graph.facebook.com/v21.0/{s.whatsapp_phone_id}/messages", json=body,
                       headers={"Authorization": f"Bearer {s.whatsapp_token}"}, timeout=15)
        if r.status_code >= 400:
            return "failed", r.text[:300]
        return "sent", r.json().get("messages", [{}])[0].get("id", "")
    except (httpx.HTTPError, ValueError) as e:
        log.warning("WhatsApp send failed: %s", e)
        return "failed", str(e)[:300]
