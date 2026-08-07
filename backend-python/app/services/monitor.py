"""Monitoreo operativo: estado en vivo, prioridades y plan de intervención."""

from __future__ import annotations

from typing import Any

from app.config import demo_simulation_enabled
from app.database import database_mode
from app.memory_store import memory
from app.repositories.bootstrap import bootstrap
from app.services.alerts import build_alerts
from app.services.metrics import build_performance_metrics
from app.services.proximity import build_proximity_alerts
from app.services.routing import (
    build_intervention_plan,
    eta_minutes,
    optimize_routes,
    prioritize_zones,
    suggest_truck_assignments,
)
from app.services.simulation import (
    simulate_container_fill,
    simulate_route_progress,
    simulate_truck_positions,
    truck_positions,
)
from app.services.visibility import visible_notifications_for


def geo_trucks() -> list[dict[str, Any]]:
    routes = bootstrap()["routes"]
    return [
        {
            "code": route["truck"],
            "zone": route["zone"],
            "latitude": route["latitude"],
            "longitude": route["longitude"],
            "progress": route["progress"],
            "etaMinutes": eta_minutes(route),
        }
        for route in routes
    ]


def _with_fleet_details(
    live_trucks: list[dict[str, Any]],
    fleet: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Completa las posiciones en vivo con conductor y estado de la flota.

    `simulate_truck_positions` sale de las rutas, así que solo trae código,
    zona y coordenadas. La proximidad necesita además el estado (para descartar
    los camiones que no están en ruta) y el conductor (para que un conductor
    reconozca su propio camión).
    """
    by_code = {str(truck.get("code", "")).strip().lower(): truck for truck in fleet}
    completed: list[dict[str, Any]] = []
    for truck in live_trucks:
        details = by_code.get(str(truck.get("code", "")).strip().lower(), {})
        completed.append({
            **truck,
            "id": details.get("id"),
            "driver": details.get("driver"),
            "status": details.get("status"),
        })
    return completed


def build_monitor(simulate: bool | None = None, user: dict[str, Any] | None = None) -> dict[str, Any]:
    """Estado operativo completo para `/api/operations/monitor`.

    `simulate=None` deja la decisión al entorno (`DEMO_SIMULATION`), que está
    apagado por defecto: lo que se devuelve es lo que hay guardado. Pasar
    `False` explícitamente lo fuerza, como hace el registro de eventos, que
    debe responder con el estado recién escrito.
    """
    simulate = demo_simulation_enabled() if simulate is None else simulate

    data = bootstrap()
    if simulate:
        data["routes"] = simulate_route_progress(data.get("routes", []))
        data["containers"] = simulate_container_fill(data.get("containers", []))
    else:
        data["routes"] = data.get("routes", [])
        data["containers"] = data.get("containers", [])

        if database_mode() == "memory":
            memory.routes = data["routes"]
            memory.containers = data["containers"]

    prioritized_zones = prioritize_zones(data.get("zones", []), data.get("reports", []), data.get("containers", []))
    optimized_routes = optimize_routes(data.get("routes", []), [zone["name"] for zone in prioritized_zones])
    assignments = suggest_truck_assignments(data.get("trucks", []), optimized_routes)
    intervention_plan = build_intervention_plan(prioritized_zones, optimized_routes)

    # Los camiones que se pintan en el mapa son las posiciones derivadas de las
    # rutas; la proximidad se mide contra esas mismas, no contra la última
    # posición guardada en la ficha del camión, para que aviso y mapa coincidan.
    positions = simulate_truck_positions if simulate else truck_positions
    live_trucks = _with_fleet_details(positions(data.get("routes", [])), data.get("trucks", []))
    proximity_alerts = build_proximity_alerts(
        user=user,
        trucks=live_trucks,
        zones=data.get("zones", []),
        routes=data.get("routes", []),
    )

    notifications = (
        visible_notifications_for(user, data.get("notifications", []))
        if user is not None
        else data.get("notifications", [])
    )

    return {
        "trucks": live_trucks,
        "alerts": build_alerts(routes=data.get("routes", []), containers=data.get("containers", [])),
        "containers": data.get("containers", []),
        "maintenance": data.get("maintenance", []),
        "notifications": notifications + proximity_alerts,
        "proximity_alerts": proximity_alerts,
        "prioritized_zones": prioritized_zones,
        "optimized_routes": optimized_routes,
        "truck_assignments": assignments,
        "intervention_plan": intervention_plan,
        "performance": build_performance_metrics(data.get("routes", []), data.get("reports", []), data.get("containers", [])),
    }
