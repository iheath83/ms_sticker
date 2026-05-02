"""Settings du service via variables d'env (Pydantic Settings)."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)

    # Clé partagée avec le proxy Next.js
    api_key: str = "dev-secret-change-me"

    # Modèle rembg (téléchargé au build)
    rembg_model: str = "isnet-general-use"

    # Limites
    max_image_bytes: int = 25 * 1024 * 1024  # 25 MB

    # Cutline defaults
    cutline_grid_size: int = 220
    cutline_close_radius_px: int = 8
    cutline_pad_px: int = 14
    cutline_simplify_epsilon_factor: float = 0.0015
    cutline_smooth_passes: int = 5

    # CORS (par défaut, le service est interne donc pas de CORS)
    cors_origins: list[str] = []


settings = Settings()
