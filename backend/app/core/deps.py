from typing import Annotated

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import COOKIE_NAME, read_session_token
from app.models import User

DB = Annotated[Session, Depends(get_db)]


def current_user_optional(db: DB, raga_session: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None) -> User | None:
    user_id = read_session_token(raga_session) if raga_session else None
    return db.get(User, user_id) if user_id else None


def require_user(user: Annotated[User | None, Depends(current_user_optional)]) -> User:
    if not user:
        raise HTTPException(401, {"message": "Please log in with your mobile number."})
    return user


def require_admin(user: Annotated[User, Depends(require_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(403, {"message": "Admins only."})
    return user


CurrentUser = Annotated[User, Depends(require_user)]
OptionalUser = Annotated[User | None, Depends(current_user_optional)]
Admin = Annotated[User, Depends(require_admin)]
