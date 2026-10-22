from fastapi import APIRouter, Response

from app.core.config import get_settings
from app.core.deps import DB, OptionalUser
from app.core.errors import ServiceError
from app.core.security import COOKIE_NAME, create_session_token
from app.schemas.account import OtpRequest, OtpRequested, OtpVerify, UserOut
from app.services import auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/otp", response_model=OtpRequested)
def send_otp(body: OtpRequest, db: DB):
    try:
        code, resend_in = auth.request_otp(db, body.phone)
    except ServiceError as e:
        raise e.http() from None
    return OtpRequested(resend_in=resend_in, dev_code=code if get_settings().otp_shown_on_screen else None)


@router.post("/verify", response_model=UserOut)
def verify(body: OtpVerify, response: Response, db: DB):
    try:
        user = auth.verify_otp(db, body.phone, body.code)
    except ServiceError as e:
        raise e.http() from None
    s = get_settings()
    response.set_cookie(COOKIE_NAME, create_session_token(user.id), max_age=s.session_days * 86400,
                        httponly=True, samesite="lax", secure=s.cookie_secure, path="/")
    return user


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut | None)
def me(user: OptionalUser):
    return user
