"""Estado del servicio."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import APP_VERSION
from app.database import database_mode


router = APIRouter(prefix="/api", tags=["salud"])


@router.get("/health")
def health() -> dict[str, str]:
    db_status = database_mode()
    return {
        "status": "ok",
        "database": db_status,
        "version": APP_VERSION,
        "mode": "production" if db_status == "postgresql" else "demo"
    }
