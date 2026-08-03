"""Zonas de recolección."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.constants import ADMIN_ROLES
from app.dependencies import require_role
from app.repositories.bootstrap import bootstrap
from app.repositories.zones import create_zone_record, delete_zone, update_zone
from app.schemas import ZoneCreate, ZoneUpdate


router = APIRouter(prefix="/api", tags=["zonas"])


@router.get("/zones")
def get_zones() -> list[dict[str, Any]]:
    return bootstrap()["zones"]


@router.post("/zones", dependencies=[Depends(require_role(ADMIN_ROLES))])
def create_zone(payload: ZoneCreate) -> dict[str, Any]:
    return create_zone_record(payload)


@router.patch("/zones/{zone_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def patch_zone(zone_id: int, payload: ZoneUpdate) -> dict[str, Any]:
    return update_zone(zone_id, payload)


@router.delete("/zones/{zone_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def remove_zone(zone_id: int) -> dict[str, Any]:
    delete_zone(zone_id)
    return {"ok": "true", "message": "Zona eliminada"}
