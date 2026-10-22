import httpx

from app.core.config import get_settings


class Msg91Sender:
    """Sends the OTP through an MSG91 Flow template that has one variable, ##otp##.

    Needs a DLT-approved template. Set MSG91_AUTHKEY and MSG91_TEMPLATE_ID in .env.
    """

    url = "https://control.msg91.com/api/v5/flow"

    def send(self, phone: str, code: str) -> None:
        s = get_settings()
        r = httpx.post(
            self.url,
            headers={"authkey": s.msg91_authkey, "content-type": "application/json"},
            json={"template_id": s.msg91_template_id, "short_url": "0", "recipients": [{"mobiles": phone.lstrip("+"), "otp": code}]},
            timeout=10,
        )
        r.raise_for_status()
