"""Health check endpoint (utilisé par Docker healthcheck + Traefik)."""
from __future__ import annotations

from fastapi import APIRouter

from app.services.bgremove import is_ready as rembg_ready
from app.settings import settings

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, str | bool]:
    """Liveness check : 200 dès que uvicorn répond (pas besoin de rembg)."""
    return {
        "status": "ok",
        "rembg_loaded": rembg_ready(),
        "rembg_model": settings.rembg_model,
    }


@router.get("/readyz")
async def readyz() -> dict[str, str | bool]:
    """Readiness : 200 seulement si le modèle rembg est chargé."""
    if not rembg_ready():
        return {"status": "loading", "rembg_loaded": False}
    return {"status": "ready", "rembg_loaded": True}
