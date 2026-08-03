"""Persistencia de registros de mantenimiento."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.database import execute_one
from app.memory_store import memory
from app.schemas import MaintenanceCreate, MaintenanceUpdate


def build_maintenance_payload(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item.get("id"),
        "truck_id": item.get("truck_id"),
        "description": item.get("description"),
        "status": item.get("status"),
        "created_at": item.get("created_at"),
    }


def create_maintenance_record(payload: MaintenanceCreate) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into maintenance_records (truck_id, description, status, created_at) values (%s, %s, %s, %s) returning id, truck_id, description, status, created_at",
            (payload.truck_id, payload.description, payload.status, datetime.now(timezone.utc)),
        )
        return build_maintenance_payload(row)
    except Exception:
        item = {
            "id": max([item["id"] for item in memory.maintenance], default=0) + 1,
            "truck_id": payload.truck_id,
            "description": payload.description,
            "status": payload.status,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        memory.maintenance.append(item)
        return build_maintenance_payload(item)


def update_maintenance(maintenance_id: int, payload: MaintenanceUpdate) -> dict[str, Any]:
    try:
        if payload.truck_id is not None:
            execute_one("update maintenance_records set truck_id = %s where id = %s", (payload.truck_id, maintenance_id))
        if payload.description is not None:
            execute_one("update maintenance_records set description = %s where id = %s", (payload.description, maintenance_id))
        if payload.status is not None:
            execute_one("update maintenance_records set status = %s where id = %s", (payload.status, maintenance_id))
        row = execute_one("select id, truck_id, description, status, created_at from maintenance_records where id = %s", (maintenance_id,))
        return build_maintenance_payload(row)
    except Exception:
        for item in memory.maintenance:
            if item["id"] == maintenance_id:
                if payload.truck_id is not None:
                    item["truck_id"] = payload.truck_id
                if payload.description is not None:
                    item["description"] = payload.description
                if payload.status is not None:
                    item["status"] = payload.status
                return build_maintenance_payload(item)
        raise HTTPException(status_code=404, detail="Mantenimiento no encontrado")


def delete_maintenance(maintenance_id: int) -> None:
    try:
        execute_one("delete from maintenance_records where id = %s", (maintenance_id,))
    except Exception:
        memory.maintenance = [item for item in memory.maintenance if item["id"] != maintenance_id]
