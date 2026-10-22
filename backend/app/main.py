import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.routers import account, auth, catalog
from app.routers import admin

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Raga Boutique API", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(CORSMiddleware, allow_origins=s.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    for r in (auth.router, catalog.router, account.router, admin.router):
        app.include_router(r)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    # In production Caddy serves /uploads directly; this is for local dev.
    s.uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=s.uploads_dir), name="uploads")
    return app


app = create_app()
