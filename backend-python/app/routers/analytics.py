"""Resumen analítico y carga inicial."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.dependencies import require_current_user
from app.repositories.bootstrap import bootstrap
from app.services.visibility import bootstrap_for


router = APIRouter(prefix="/api", tags=["analítica"])


@router.get("/bootstrap")
def get_bootstrap(current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    # Exige sesión: el catálogo público que necesita la pantalla de acceso
    # (las zonas) se sirve por GET /api/zones, que sí es anónimo.
    return bootstrap_for(current_user)


@router.get("/analytics/summary")
def get_analytics() -> dict[str, Any]:
    return bootstrap()["analytics"]
