"""MS Adhésif – Cutline Service.

Microservice Python qui traite les images uploadées par les clients :
- /api/cutline : génération de ligne de coupe via OpenCV
- /api/background/remove : suppression de fond via rembg (IS-Net / U²-Net)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import bgremove, cutline, health
from app.services.bgremove import warmup_rembg
from app.settings import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("cutline-service")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    log.info("Booting cutline-service…")
    warmup_rembg(settings.rembg_model)
    log.info("rembg model %s ready", settings.rembg_model)
    yield


app = FastAPI(
    title="MS Adhésif – Cutline Service",
    version="1.0.0",
    description="Génération de ligne de coupe + suppression de fond pour stickers.",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["POST", "GET"],
        allow_headers=["*"],
    )


# ─── Auth (Bearer token partagé avec le proxy Next.js) ────────────────────────


async def require_api_key(request: Request) -> None:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )
    token = auth[len("Bearer ") :]
    if token != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )


app.include_router(health.router)
app.include_router(cutline.router, dependencies=[Depends(require_api_key)])
app.include_router(bgremove.router, dependencies=[Depends(require_api_key)])


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "error": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": "internal_error"},
    )
