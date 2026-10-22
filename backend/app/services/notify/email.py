"""Email: "console" logs it (demo), "smtp" sends it through any SMTP provider."""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

log = logging.getLogger(__name__)


def send(to: str, subject: str, text: str, html: str) -> tuple[str, str]:
    s = get_settings()
    if s.email_provider != "smtp":
        log.info("EMAIL to %s: %s\n%s", to, subject, text)
        return "logged", ""
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, s.email_from or s.smtp_user, to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
        return "sent", ""
    except (OSError, smtplib.SMTPException) as e:
        log.warning("Email to %s failed: %s", to, e)
        return "failed", str(e)[:200]
