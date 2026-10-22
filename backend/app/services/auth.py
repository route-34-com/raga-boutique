from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ServiceError
from app.core.security import hash_otp, new_otp
from app.models import OtpCode, User
from app.services.otp import get_sender


def e164(mobile: str) -> str:
    return "+91" + mobile


def request_otp(db: Session, mobile: str) -> tuple[str, int]:
    """Creates and sends a code. Returns (code, resend_in_seconds)."""
    s = get_settings()
    phone = e164(mobile)
    now = datetime.now(UTC)

    last = db.scalar(select(OtpCode).where(OtpCode.phone == phone).order_by(OtpCode.id.desc()).limit(1))
    if last and (wait := s.otp_resend_seconds - int((now - last.created_at).total_seconds())) > 0:
        raise ServiceError(f"Please wait {wait} seconds before asking for a new code.", 429)
    sent_last_hour = db.scalar(select(func.count()).where(OtpCode.phone == phone, OtpCode.created_at > now - timedelta(hours=1)))
    if sent_last_hour >= s.otp_max_per_hour:
        raise ServiceError("Too many codes requested. Please try again in an hour.", 429)

    code = new_otp()
    db.add(OtpCode(phone=phone, code_hash=hash_otp(phone, code), expires_at=now + timedelta(seconds=s.otp_ttl_seconds)))
    db.commit()
    get_sender().send(phone, code)
    return code, s.otp_resend_seconds


def verify_otp(db: Session, mobile: str, code: str) -> User:
    s = get_settings()
    phone = e164(mobile)
    now = datetime.now(UTC)
    otp = db.scalar(select(OtpCode).where(OtpCode.phone == phone, OtpCode.used.is_(False)).order_by(OtpCode.id.desc()).limit(1).with_for_update())
    if not otp or otp.expires_at < now:
        raise ServiceError("That code has expired. Please request a new one.")
    if otp.attempts >= s.otp_max_attempts:
        raise ServiceError("Too many wrong attempts. Please request a new code.", 429)
    if otp.code_hash != hash_otp(phone, code):
        otp.attempts += 1
        db.commit()
        raise ServiceError("That code doesn't match. Please check and try again.")

    otp.used = True
    user = db.scalar(select(User).where(User.phone == phone))
    if not user:
        user = User(phone=phone)
        db.add(user)
    user.last_login_at = now
    db.commit()
    return user
