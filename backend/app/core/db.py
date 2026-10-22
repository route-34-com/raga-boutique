from collections.abc import Iterator
from datetime import datetime

from sqlalchemy import DateTime, NullPool, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import get_settings

_s = get_settings()
# Small pool: the droplet's Postgres runs with max_connections = 20.
# Serverless: no pool, the provider's pooled endpoint (Neon "-pooler") does the pooling.
engine = (create_engine(_s.database_url, poolclass=NullPool) if _s.serverless
          else create_engine(_s.database_url, pool_size=5, max_overflow=5, pool_pre_ping=True))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
