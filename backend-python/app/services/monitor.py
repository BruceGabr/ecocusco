"""Monitoreo operativo: estado en vivo, prioridades y plan de intervención."""

from __future__ import annotations

from typing import Any

from app.database import database_mode
from app.memory_store import memory
from app.repositories.bootstrap import bootstrap
from app.services.alerts import build_alerts
from app.services.metrics import build_performance_metrics
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


def build_monitor(simulate: bool = True, user: dict[str, Any] | None = None) -> dict[str, Any]:
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
    return {
        "trucks": simulate_truck_positions(data.get("routes", [])),
        "alerts": build_alerts(routes=data.get("routes", []), containers=data.get("containers", [])),
        "containers": data.get("containers", []),
        "maintenance": data.get("maintenance", []),
        "notifications": (
            visible_notifications_for(user, data.get("notifications", []))
            if user is not None
            else data.get("notifications", [])
        ),
        "prioritized_zones": prioritized_zones,
        "optimized_routes": optimized_routes,
        "truck_assignments": assignments,
        "intervention_plan": intervention_plan,
        "performance": build_performance_metrics(data.get("routes", []), data.get("reports", []), data.get("containers", [])),
    }
