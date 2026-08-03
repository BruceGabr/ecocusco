"""Horarios de recolección."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.constants import ADMIN_ROLES
from app.dependencies import require_role
from app.repositories.bootstrap import bootstrap
from app.repositories.schedules import create_schedule_record, delete_schedule, update_schedule
from app.schemas import ScheduleCreate, ScheduleUpdate


router = APIRouter(prefix="/api", tags=["horarios"])


@router.get("/schedules")
def get_schedules() -> list[dict[str, Any]]:
    return bootstrap()["schedules"]


@router.post("/schedules", dependencies=[Depends(require_role(ADMIN_ROLES))])
def create_schedule(payload: ScheduleCreate) -> dict[str, Any]:
    return create_schedule_record(payload)


@router.patch("/schedules/{schedule_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def patch_schedule(schedule_id: int, payload: ScheduleUpdate) -> dict[str, Any]:
    return update_schedule(schedule_id, payload)


@router.delete("/schedules/{schedule_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def remove_schedule(schedule_id: int) -> dict[str, Any]:
    delete_schedule(schedule_id)
    return {"ok": "true", "message": "Horario eliminado"}
