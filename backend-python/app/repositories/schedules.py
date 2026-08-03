"""Persistencia de horarios de recolección."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.database import execute_one
from app.memory_store import memory
from app.repositories.zones import get_zone_name
from app.schemas import ScheduleCreate, ScheduleUpdate


def build_schedule_payload(schedule: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": schedule.get("id"),
        "zone_id": schedule.get("zone_id"),
        "zone": schedule.get("zone") or get_zone_name(schedule.get("zone_id")),
        "day": schedule.get("day"),
        "time": schedule.get("time"),
        "waste": schedule.get("waste"),
    }


def create_schedule_record(payload: ScheduleCreate) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into schedules (zone_id, day, time, waste) values (%s, %s, %s, %s) returning id, zone_id, day, time, waste",
            (payload.zone_id, payload.day, payload.time, payload.waste),
        )
        return build_schedule_payload({**row, "zone": get_zone_name(payload.zone_id)})
    except Exception:
        schedule = {
            "id": max([item["id"] for item in memory.schedules], default=0) + 1,
            "zone_id": payload.zone_id,
            "zone": get_zone_name(payload.zone_id),
            "day": payload.day,
            "time": payload.time,
            "waste": payload.waste,
        }
        memory.schedules.append(schedule)
        return build_schedule_payload(schedule)


def update_schedule(schedule_id: int, payload: ScheduleUpdate) -> dict[str, Any]:
    try:
        if payload.zone_id is not None:
            execute_one("update schedules set zone_id = %s where id = %s", (payload.zone_id, schedule_id))
        if payload.day is not None:
            execute_one("update schedules set day = %s where id = %s", (payload.day, schedule_id))
        if payload.time is not None:
            execute_one("update schedules set time = %s where id = %s", (payload.time, schedule_id))
        if payload.waste is not None:
            execute_one("update schedules set waste = %s where id = %s", (payload.waste, schedule_id))
        row = execute_one("select id, zone_id, day, time, waste from schedules where id = %s", (schedule_id,))
        return build_schedule_payload({**row, "zone": get_zone_name(row.get("zone_id"))})
    except Exception:
        for schedule in memory.schedules:
            if schedule["id"] == schedule_id:
                if payload.zone_id is not None:
                    schedule["zone_id"] = payload.zone_id
                    schedule["zone"] = get_zone_name(payload.zone_id)
                if payload.day is not None:
                    schedule["day"] = payload.day
                if payload.time is not None:
                    schedule["time"] = payload.time
                if payload.waste is not None:
                    schedule["waste"] = payload.waste
                return build_schedule_payload(schedule)
        raise HTTPException(status_code=404, detail="Horario no encontrado")


def delete_schedule(schedule_id: int) -> None:
    try:
        execute_one("delete from schedules where id = %s", (schedule_id,))
    except Exception:
        memory.schedules = [schedule for schedule in memory.schedules if schedule["id"] != schedule_id]
