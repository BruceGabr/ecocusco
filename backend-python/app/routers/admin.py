"""Acciones transversales del panel de administración."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.constants import ADMIN_ROLES
from app.dependencies import require_role
from app.repositories.bulk import BULK_ACTION_DELETE, bulk_delete
from app.schemas import BulkActionRequest

router = APIRouter(prefix="/api/admin", tags=["administracion"])


@router.post("/bulk-action", dependencies=[Depends(require_role(ADMIN_ROLES))])
def run_bulk_action(payload: BulkActionRequest) -> dict[str, Any]:
    """Aplica una acción a varios registros de un mismo catálogo."""
    if payload.action != BULK_ACTION_DELETE:
        raise HTTPException(
            status_code=400,
            detail=f"Acción no soportada: {payload.action}. Use '{BULK_ACTION_DELETE}'.",
        )
    return bulk_delete(payload.resource, payload.ids)
