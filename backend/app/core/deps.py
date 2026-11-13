from typing import Annotated

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
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


def is_super_admin(user: User) -> bool:
    return user.phone.removeprefix("+91") in get_settings().super_admin_phones


def promote_super_admin(db: Session, user: User | None) -> User | None:
    """Marks a super admin as admin the first time they show up, so the panel opens for them."""
    if user and not user.is_admin and is_super_admin(user):
        user.is_admin = True
        db.commit()
    return user


def require_admin(user: Annotated[User, Depends(require_user)]) -> User:
    if not (user.is_admin or is_super_admin(user)):
        raise HTTPException(403, {"message": "Admins only."})
    return user


def require_super_admin(user: Annotated[User, Depends(require_user)]) -> User:
    if not is_super_admin(user):
        raise HTTPException(403, {"message": "Only the super admins can add or remove admins."})
    return user


CurrentUser = Annotated[User, Depends(require_user)]
OptionalUser = Annotated[User | None, Depends(current_user_optional)]
Admin = Annotated[User, Depends(require_admin)]
SuperAdmin = Annotated[User, Depends(require_super_admin)]
