"""Simulación del avance operativo para el modo demostración.

IMPORTANTE: estas funciones NO reflejan telemetría real. Mueven los camiones y
llenan los contenedores con incrementos fijos para que el monitoreo tenga
movimiento durante una demostración. Cualquier lectura que salga de aquí debe
presentarse como simulada.
"""

from __future__ import annotations

from typing import Any

from app.constants import CONTAINER_STATUS_FULL, CONTAINER_STATUS_OK, CONTAINER_FILL_CONSIDERED_FULL
from app.services.routing import eta_minutes


#: Incrementos por ciclo de simulación.
ROUTE_PROGRESS_STEP = 10
CONTAINER_FILL_STEP = 5
TRUCK_LATITUDE_STEP = 0.0015
TRUCK_LONGITUDE_STEP = 0.0012


def simulate_route_progress(routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    simulated: list[dict[str, Any]] = []
    for route in routes:
        progress = min(100, int(route.get("progress", 0)) + ROUTE_PROGRESS_STEP)
        if progress >= 100:
            delay = "Completado"
        elif progress > 70:
            delay = "Sin retraso"
        elif progress > 40:
            delay = "Retraso leve"
        else:
            delay = "Retraso moderado"
        simulated.append({
            **route,
            "progress": progress,
            "delay": delay,
        })
    return simulated


def simulate_container_fill(containers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    simulated: list[dict[str, Any]] = []
    for container in containers:
        fill_level = min(100, int(container.get("fill_level", 0)) + CONTAINER_FILL_STEP)
        status = CONTAINER_STATUS_FULL if fill_level >= CONTAINER_FILL_CONSIDERED_FULL else CONTAINER_STATUS_OK
        simulated.append({
            **container,
            "fill_level": fill_level,
            "status": status,
        })
    return simulated


def truck_positions(routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Posición de cada camión tal y como está registrada en su ruta.

    Sin desplazamiento inventado: es el dato real que se guarda.
    """
    return [
        {
            "code": route.get("truck"),
            "zone": route.get("zone"),
            "latitude": float(route.get("latitude", 0.0)),
            "longitude": float(route.get("longitude", 0.0)),
            "progress": int(route.get("progress", 0)),
            "etaMinutes": eta_minutes(route),
        }
        for route in routes
    ]


def simulate_truck_positions(routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Igual que `truck_positions`, con un desplazamiento fijo para la demo."""
    return [
        {
            **position,
            "latitude": position["latitude"] + TRUCK_LATITUDE_STEP,
            "longitude": position["longitude"] + TRUCK_LONGITUDE_STEP,
        }
        for position in truck_positions(routes)
    ]
