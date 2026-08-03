"""Alertas operativas derivadas del estado de rutas y contenedores."""

from __future__ import annotations

from typing import Any

from app.constants import CONTAINER_FILL_CRITICAL, CONTAINER_FILL_WARNING, ROUTE_PROGRESS_LOW
from app.services.routing import route_is_delayed


def build_alerts(routes: list[dict[str, Any]], containers: list[dict[str, Any]] | None = None) -> list[str]:
    alerts: list[str] = []
    for route in routes:
        if route_is_delayed(route):
            alerts.append(f"{route['truck']} presenta retraso en {route['zone']}.")
        elif int(route.get("progress", 0)) < ROUTE_PROGRESS_LOW:
            alerts.append(f"{route['truck']} presenta posible retraso en {route['zone']} debido a bajo avance.")
    for container in containers or []:
        fill_level = int(container.get("fill_level", 0))
        if fill_level >= CONTAINER_FILL_CRITICAL:
            alerts.append(f"Contenedor {container['name']} está casi lleno ({fill_level}%).")
        elif fill_level >= CONTAINER_FILL_WARNING:
            alerts.append(f"Contenedor {container['name']} requiere revisión ({fill_level}%).")
    return alerts
