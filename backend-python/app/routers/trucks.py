"""Camiones y su mantenimiento."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.constants import ADMIN_ROLES
from app.dependencies import require_role
from app.repositories.bootstrap import bootstrap
from app.repositories.maintenance import (
    create_maintenance_record,
    delete_maintenance,
    update_maintenance,
)
from app.repositories.trucks import create_truck_record, delete_truck, update_truck
from app.schemas import MaintenanceCreate, MaintenanceUpdate, TruckCreate, TruckUpdate


router = APIRouter(prefix="/api", tags=["camiones"])


@router.get("/trucks")
def get_trucks() -> list[dict[str, Any]]:
    return bootstrap()["trucks"]


@router.post("/trucks", dependencies=[Depends(require_role(ADMIN_ROLES))])
def create_truck(payload: TruckCreate) -> dict[str, Any]:
    return create_truck_record(payload)


@router.patch("/trucks/{truck_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def patch_truck(truck_id: int, payload: TruckUpdate) -> dict[str, Any]:
    return update_truck(truck_id, payload)


@router.delete("/trucks/{truck_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def remove_truck(truck_id: int) -> dict[str, Any]:
    delete_truck(truck_id)
    return {"ok": "true", "message": "Camión eliminado"}


@router.get("/maintenance")
def get_maintenance() -> list[dict[str, Any]]:
    return bootstrap()["maintenance"]


@router.post("/maintenance", dependencies=[Depends(require_role(ADMIN_ROLES))])
def create_maintenance(payload: MaintenanceCreate) -> dict[str, Any]:
    return create_maintenance_record(payload)


@router.patch("/maintenance/{maintenance_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def patch_maintenance(maintenance_id: int, payload: MaintenanceUpdate) -> dict[str, Any]:
    return update_maintenance(maintenance_id, payload)


@router.delete("/maintenance/{maintenance_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def remove_maintenance(maintenance_id: int) -> dict[str, Any]:
    delete_maintenance(maintenance_id)
    return {"ok": "true", "message": "Registro de mantenimiento eliminado"}
