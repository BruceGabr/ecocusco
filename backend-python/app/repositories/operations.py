"""Actualizaciones de estado operativo: avance de rutas y llenado de contenedores."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.database import execute_one
from app.memory_store import memory

#: Rango admitido por los campos porcentuales.
PERCENT_MIN = 0
PERCENT_MAX = 100


def clamp_percent(value: int) -> int:
    return max(PERCENT_MIN, min(PERCENT_MAX, int(value)))


def _update_row(table: str, row_id: int, values: dict[str, Any], extra_sql: str = "") -> bool | None:
    """Aplica un UPDATE en PostgreSQL.

    Devuelve True si actualizó, False si la fila no existe, y None si no hay
    base de datos disponible (para que el llamador use el modo memoria).
    """
    assignments = [f"{column} = %s" for column in values]
    params: list[Any] = list(values.values())
    if extra_sql:
        assignments.append(extra_sql)
    params.append(row_id)
    try:
        execute_one(
            f"update {table} set {', '.join(assignments)} where id = %s returning id",
            tuple(params),
        )
        return True
    except HTTPException:
        # execute_one lanza 404 cuando el UPDATE no afecta a ninguna fila.
        return False
    except Exception:
        return None


def _update_in_memory(items: list[dict[str, Any]], item_id: int, values: dict[str, Any]) -> bool:
    for item in items:
        if int(item.get("id", 0)) == item_id:
            item.update(values)
            return True
    return False


def update_route(route_id: int, progress: int | None = None, delay: str | None = None) -> bool:
    """Actualiza el avance o el retraso de una ruta. False si no existe."""
    values: dict[str, Any] = {}
    if progress is not None:
        values["progress"] = clamp_percent(progress)
    if delay is not None:
        values["delay"] = delay
    if not values:
        return False

    result = _update_row("routes", route_id, values)
    if result is not None:
        return result
    return _update_in_memory(memory.routes, route_id, values)


def update_container(container_id: int, fill_level: int | None = None, status: str | None = None) -> bool:
    """Actualiza el llenado o el estado de un contenedor. False si no existe."""
    values: dict[str, Any] = {}
    if fill_level is not None:
        values["fill_level"] = clamp_percent(fill_level)
    if status is not None:
        values["status"] = status
    if not values:
        return False

    result = _update_row("containers", container_id, values, extra_sql="updated_at = now()")
    if result is not None:
        return result
    return _update_in_memory(memory.containers, container_id, values)
