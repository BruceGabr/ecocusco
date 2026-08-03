"""Persistencia de zonas de recolección."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.database import execute_one
from app.memory_store import memory
from app.schemas import ZoneCreate, ZoneUpdate


def get_zone_name(zone_id: int | None) -> str | None:
    if zone_id is None:
        return None
    try:
        row = execute_one("select id, name from zones where id = %s", (zone_id,))
        return row.get("name")
    except Exception:
        for zone in memory.zones:
            if int(zone.get("id", 0)) == zone_id:
                return str(zone.get("name", ""))
        return None


def build_zone_payload(zone: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": zone.get("id"),
        "name": zone.get("name"),
        "latitude": zone.get("latitude"),
        "longitude": zone.get("longitude"),
        "criticality": zone.get("criticality", "Media"),
    }


def create_zone_record(payload: ZoneCreate) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into zones (name, latitude, longitude, criticality) values (%s, %s, %s, %s) returning id, name, latitude, longitude, criticality",
            (payload.name, payload.latitude, payload.longitude, payload.criticality),
        )
        return build_zone_payload(row)
    except Exception:
        zone = {
            "id": max([item["id"] for item in memory.zones], default=0) + 1,
            "name": payload.name,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "criticality": payload.criticality,
        }
        memory.zones.append(zone)
        return build_zone_payload(zone)


def update_zone(zone_id: int, payload: ZoneUpdate) -> dict[str, Any]:
    try:
        if payload.name is not None:
            execute_one("update zones set name = %s where id = %s", (payload.name, zone_id))
        if payload.latitude is not None:
            execute_one("update zones set latitude = %s where id = %s", (payload.latitude, zone_id))
        if payload.longitude is not None:
            execute_one("update zones set longitude = %s where id = %s", (payload.longitude, zone_id))
        if payload.criticality is not None:
            execute_one("update zones set criticality = %s where id = %s", (payload.criticality, zone_id))
        return build_zone_payload(execute_one("select id, name, latitude, longitude, criticality from zones where id = %s", (zone_id,)))
    except Exception:
        for zone in memory.zones:
            if zone["id"] == zone_id:
                if payload.name is not None:
                    zone["name"] = payload.name
                if payload.latitude is not None:
                    zone["latitude"] = payload.latitude
                if payload.longitude is not None:
                    zone["longitude"] = payload.longitude
                if payload.criticality is not None:
                    zone["criticality"] = payload.criticality
                return build_zone_payload(zone)
        raise HTTPException(status_code=404, detail="Zona no encontrada")


def delete_zone(zone_id: int) -> None:
    try:
        execute_one("delete from zones where id = %s", (zone_id,))
    except Exception:
        memory.zones = [zone for zone in memory.zones if zone["id"] != zone_id]
