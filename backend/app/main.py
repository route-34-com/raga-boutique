import logging

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.validation import friendly_errors
from app.routers import account, admin, auth, catalog, pages, payments
from app.services.images import load_or_make_variant

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Raga Boutique API", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(
        CORSMiddleware, allow_origins=s.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
    )
    for r in (auth.router, catalog.router, account.router, payments.router, admin.router):
        app.include_router(r)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        details = friendly_errors(exc.errors())
        return JSONResponse(status_code=422, content={"detail": {"message": " ".join(details), "details": details}})

    @app.get("/api/health")
    def health():
        return {"ok": True}

    # Photo names are random and never reused, so browsers and the CDN can keep them forever. Smaller copies
    # ("<name>.w480.jpg") are made from the original the first time they're asked for.
    @app.get("/uploads/products/{name}")
    def product_photo(name: str):
        data = load_or_make_variant(name)
        if data is None:
            raise HTTPException(404)
        # s-maxage lets Vercel's CDN keep the photo; without it the CDN asks the function every time.
        return Response(
            data,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable"},
        )

    if s.image_store != "db":
        # Other files under /uploads; in production Caddy serves them and sends only missing copies here.
        s.uploads_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=s.uploads_dir), name="uploads")
    # Last: robots.txt, sitemap.xml and the catch-all page route, so they never shadow /api or /uploads.
    app.include_router(pages.router)
    return app


app = create_app()
