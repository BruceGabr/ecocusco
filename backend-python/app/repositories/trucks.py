"""Persistencia de camiones."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.database import execute_one
from app.memory_store import memory
from app.repositories.zones import get_zone_name
from app.schemas import TruckCreate, TruckUpdate


def build_truck_payload(truck: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": truck.get("id"),
        "code": truck.get("code"),
        "driver": truck.get("driver"),
        "status": truck.get("status"),
        "zone_id": truck.get("zone_id"),
        "zone": truck.get("zone") or get_zone_name(truck.get("zone_id")),
        "latitude": truck.get("latitude"),
        "longitude": truck.get("longitude"),
    }


def create_truck_record(payload: TruckCreate) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into trucks (code, driver, status, zone_id, latitude, longitude) values (%s, %s, %s, %s, %s, %s) returning id, code, driver, status, zone_id, latitude, longitude",
            (payload.code, payload.driver, payload.status, payload.zone_id, payload.latitude, payload.longitude),
        )
        return build_truck_payload({**row, "zone": get_zone_name(payload.zone_id)})
    except Exception:
        truck = {
            "id": max([item["id"] for item in memory.trucks], default=0) + 1,
            "code": payload.code,
            "driver": payload.driver,
            "status": payload.status,
            "zone_id": payload.zone_id,
            "zone": get_zone_name(payload.zone_id),
            "latitude": payload.latitude,
            "longitude": payload.longitude,
        }
        memory.trucks.append(truck)
        return build_truck_payload(truck)


def update_truck(truck_id: int, payload: TruckUpdate) -> dict[str, Any]:
    try:
        if payload.code is not None:
            execute_one("update trucks set code = %s where id = %s", (payload.code, truck_id))
        if payload.driver is not None:
            execute_one("update trucks set driver = %s where id = %s", (payload.driver, truck_id))
        if payload.status is not None:
            execute_one("update trucks set status = %s where id = %s", (payload.status, truck_id))
        if payload.zone_id is not None:
            execute_one("update trucks set zone_id = %s where id = %s", (payload.zone_id, truck_id))
        if payload.latitude is not None:
            execute_one("update trucks set latitude = %s where id = %s", (payload.latitude, truck_id))
        if payload.longitude is not None:
            execute_one("update trucks set longitude = %s where id = %s", (payload.longitude, truck_id))
        row = execute_one("select id, code, driver, status, zone_id, latitude, longitude from trucks where id = %s", (truck_id,))
        return build_truck_payload({**row, "zone": get_zone_name(row.get("zone_id"))})
    except Exception:
        for truck in memory.trucks:
            if truck["id"] == truck_id:
                if payload.code is not None:
                    truck["code"] = payload.code
                if payload.driver is not None:
                    truck["driver"] = payload.driver
                if payload.status is not None:
                    truck["status"] = payload.status
                if payload.zone_id is not None:
                    truck["zone_id"] = payload.zone_id
                    truck["zone"] = get_zone_name(payload.zone_id)
                if payload.latitude is not None:
                    truck["latitude"] = payload.latitude
                if payload.longitude is not None:
                    truck["longitude"] = payload.longitude
                return build_truck_payload(truck)
        raise HTTPException(status_code=404, detail="Camión no encontrado")


def delete_truck(truck_id: int) -> None:
    try:
        execute_one("delete from trucks where id = %s", (truck_id,))
    except Exception:
        memory.trucks = [truck for truck in memory.trucks if truck["id"] != truck_id]


def get_truck_code(truck_id: int | None) -> str | None:
    """Código visible del camión (C-01), no su id interno."""
    if truck_id is None:
        return None
    try:
        return str(execute_one("select id, code from trucks where id = %s", (truck_id,)).get("code"))
    except Exception:
        for truck in memory.trucks:
            if int(truck.get("id", 0)) == int(truck_id):
                return str(truck.get("code"))
        return None
