"""Persistencia de recolecciones."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.constants import COLLECTION_STATUS_CONFIRMED_BY_CITIZEN
from app.database import execute_one
from app.memory_store import memory
from app.repositories.trucks import get_truck_code
from app.repositories.zones import get_zone_name
from app.schemas import CollectionCreate


def build_collection_payload(row: dict[str, Any]) -> dict[str, Any]:
    """Forma común de una recolección: resuelve zona y camión a sus nombres.

    Antes cada función la construía a mano, y para obtener el código del camión
    llamaba a `bootstrap()` entero (todas las tablas) por una sola búsqueda.
    """
    truck_id = row.get("truck_id")
    zone_id = row.get("zone_id")
    date_value = row.get("date")
    return {
        "id": row.get("id"),
        "zone": row.get("zone") or get_zone_name(zone_id) or str(zone_id),
        "truck": row.get("truck") or get_truck_code(truck_id) or str(truck_id),
        "kg": row.get("kg"),
        "status": row.get("status"),
        "date": date_value.isoformat() if isinstance(date_value, (date, datetime)) else date_value,
    }


def create_collection_record(payload: CollectionCreate, created_by: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into collections (truck_id, zone_id, kg, status, date, created_by) "
            "values (%s, %s, %s, %s, %s, %s) "
            "returning id, kg, status, date, truck_id, zone_id",
            (
                payload.truck_id,
                payload.zone_id,
                payload.kg,
                payload.status,
                datetime.now(timezone.utc).date(),
                created_by and created_by.get("id"),
            ),
        )
        return build_collection_payload(row)
    except Exception:
        item = {
            "id": max([item["id"] for item in memory.collections], default=0) + 1,
            "zone": get_zone_name(payload.zone_id) or str(payload.zone_id),
            "truck": get_truck_code(payload.truck_id) or str(payload.truck_id),
            "kg": payload.kg,
            "status": payload.status,
            "date": datetime.now(timezone.utc).date().isoformat(),
        }
        memory.collections.append(item)
        return item


def confirm_collection_by_citizen(collection_id: int) -> dict[str, Any]:
    """Marca una recolección como confirmada por el ciudadano.

    La versión anterior solo devolvía algo dentro de `if database_mode() == "postgresql"`,
    así que en modo memoria caía al final del `try` y retornaba `None` sin error.
    """
    try:
        row = execute_one(
            "update collections set status = %s where id = %s "
            "returning id, kg, status, date, truck_id, zone_id",
            (COLLECTION_STATUS_CONFIRMED_BY_CITIZEN, collection_id),
        )
        return build_collection_payload(row)
    except Exception:
        for collection in memory.collections:
            if int(collection.get("id", 0)) == int(collection_id):
                collection["status"] = COLLECTION_STATUS_CONFIRMED_BY_CITIZEN
                return collection
        raise HTTPException(status_code=404, detail="Recolección no encontrada")
