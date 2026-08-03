"""Registro y confirmación de recolecciones."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.constants import Role, normalize_role
from app.dependencies import require_current_user, require_role
from app.repositories.bootstrap import bootstrap
from app.repositories.collections import confirm_collection_by_citizen, create_collection_record
from app.schemas import CollectionCreate


router = APIRouter(prefix="/api", tags=["recolecciones"])


@router.get("/collections")
def get_collections() -> list[dict[str, Any]]:
    return bootstrap()["collections"]


@router.post("/collections", dependencies=[Depends(require_role({Role.CONDUCTOR.value}))])
def register_collection(payload: CollectionCreate, current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    # Permitimos que un conductor registre la recolección realizada
    created = create_collection_record(payload, created_by=current_user)
    return created


@router.post("/collections/{collection_id}/confirm")
def confirm_collection(collection_id: int, current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    # Solo un ciudadano puede confirmar la recolección de su zona/registro
    if normalize_role(str(current_user.get("role"))) != Role.CIUDADANO.value:
        raise HTTPException(status_code=403, detail="Solo ciudadanos pueden confirmar recolecciones")
    return confirm_collection_by_citizen(collection_id)
