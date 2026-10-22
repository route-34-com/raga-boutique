from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    env: str = "dev"
    database_url: str = "postgresql+psycopg://raga:raga_dev@127.0.0.1:5432/raga"
    jwt_secret: str = "dev-only-secret-change-me-in-production-0000"
    session_days: int = 30
    cookie_secure: bool = False

    # "console" prints the code to the log and returns it to the browser (demo only).
    # "msg91" sends a real SMS.
    otp_provider: str = "console"
    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5
    otp_resend_seconds: int = 30
    otp_max_per_hour: int = 5
    msg91_authkey: str = ""
    msg91_template_id: str = ""

    uploads_dir: Path = BASE_DIR / "uploads"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def otp_shown_on_screen(self) -> bool:
        return self.otp_provider == "console"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.env == "prod" and (s.jwt_secret.startswith("dev-only") or s.otp_provider == "console"):
        raise RuntimeError("In production set JWT_SECRET and a real OTP_PROVIDER in .env")
    return s
