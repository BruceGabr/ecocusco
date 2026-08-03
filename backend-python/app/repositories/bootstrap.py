"""Carga inicial: reúne en una sola respuesta todo lo que la interfaz necesita."""

from __future__ import annotations

from typing import Any

from app.database import fetch_all, normalize_dates
from app.memory_store import memory, memory_payload
from app.repositories.users import list_users
from app.services.metrics import analytics_from


def bootstrap() -> dict[str, Any]:
    try:
        rows = {
            "zones": fetch_all("select id, name, latitude, longitude, criticality from zones order by id"),
            "schedules": fetch_all("select s.id, z.name as zone, s.day, s.time, s.waste from schedules s join zones z on z.id = s.zone_id order by s.id"),
            "trucks": fetch_all("select t.id, t.code, t.driver, t.status, z.name as zone, t.latitude, t.longitude from trucks t join zones z on z.id = t.zone_id order by t.id"),
            "routes": fetch_all("select r.id, t.code as truck, z.name as zone, r.progress, r.eta, r.delay, r.latitude, r.longitude from routes r join trucks t on t.id = r.truck_id join zones z on z.id = r.zone_id order by r.id"),
            "reports": fetch_all("select id, citizen, zone, type, detail, status from reports order by id desc"),
            "collections": normalize_dates(fetch_all("select c.id, z.name as zone, t.code as truck, c.kg, c.status, c.date from collections c join zones z on z.id = c.zone_id join trucks t on t.id = c.truck_id order by c.date desc")),
            "users": list_users(),
            "containers": fetch_all("select id, zone_id, name, fill_level, status, updated_at from containers order by id"),
            "maintenance": fetch_all("select id, truck_id, description, status, created_at from maintenance_records order by id desc"),
            "notifications": fetch_all("select id, user_id, title, message, type, is_read, created_at from notifications order by id desc"),
        }
        rows["analytics"] = analytics_from(rows)
        return rows
    except Exception:
        payload = memory_payload()
        payload["users"] = list_users()
        payload["containers"] = memory.containers
        payload["maintenance"] = memory.maintenance
        payload["notifications"] = memory.notifications
        return payload
