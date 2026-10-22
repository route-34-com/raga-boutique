import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings

COOKIE_NAME = "raga_session"


def create_session_token(user_id: int) -> str:
    s = get_settings()
    payload = {"sub": str(user_id), "exp": datetime.now(UTC) + timedelta(days=s.session_days)}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def read_session_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def new_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(phone: str, code: str) -> str:
    return hmac.new(get_settings().jwt_secret.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()
