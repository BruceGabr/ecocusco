"""Priorización de zonas y ordenación de rutas.

Lógica de decisión pura: no toca la base de datos ni HTTP, así que se puede
probar con diccionarios sueltos.
"""

from __future__ import annotations

from typing import Any

from app.constants import ROUTE_PROGRESS_LOW, TRUCK_STATUS_ON_ROUTE


def eta_minutes(route: dict[str, Any]) -> int:
    eta = str(route.get("eta", "0 min")).split()[0]
    try:
        return int(eta)
    except ValueError:
        return 0


def route_is_delayed(route: dict[str, Any]) -> bool:
    delay_text = str(route.get("delay", "")).strip().lower()
    if not delay_text:
        return False
    if "sin retraso" in delay_text:
        return False
    return "retraso" in delay_text or "tarde" in delay_text


def prioritize_zones(zones: list[dict[str, Any]], reports: list[dict[str, Any]], containers: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    containers = containers or []
    container_priority = {int(item.get("zone_id")): int(item.get("fill_level", 0)) for item in containers if item.get("zone_id") is not None}
    report_priority = {}
    for report in reports:
        zone_name = str(report.get("zone", "")).strip()
        if zone_name:
            report_priority[zone_name] = report_priority.get(zone_name, 0) + 1
    scored = []
    for zone in zones:
        zone_name = str(zone.get("name", ""))
        score = 0
        if str(zone.get("criticality", "")).lower() == "alta":
            score += 3
        elif str(zone.get("criticality", "")).lower() == "media":
            score += 1
        score += report_priority.get(zone_name, 0) * 2
        zone_id = zone.get("id")
        if zone_id in container_priority:
            score += min(3, container_priority[zone_id] // 30)
        scored.append({**zone, "priority_score": score})
    return sorted(scored, key=lambda item: item["priority_score"], reverse=True)


def optimize_routes(routes: list[dict[str, Any]], priority_zones: list[str] | None = None) -> list[dict[str, Any]]:
    priority_zones = priority_zones or []
    priority_set = {zone.lower() for zone in priority_zones}

    def route_priority(route: dict[str, Any]) -> tuple[int, int, int]:
        zone_name = str(route.get("zone", "")).lower()
        score = 0
        if zone_name in priority_set:
            score += 100
        if route_is_delayed(route):
            score += 50
        score += max(0, 100 - int(route.get("progress", 0)))
        return score, int(route.get("progress", 0)), int(route.get("id", 0))

    return sorted(routes, key=route_priority, reverse=True)


def suggest_truck_assignments(trucks: list[dict[str, Any]], optimized_routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    active_trucks = [truck for truck in trucks if str(truck.get("status", "")).lower() == TRUCK_STATUS_ON_ROUTE.lower()]
    assignments = []
    for index, route in enumerate(optimized_routes[: len(active_trucks)]):
        truck = active_trucks[index] if index < len(active_trucks) else None
        priority_label = "Alta" if route_is_delayed(route) or int(route.get("progress", 0)) < ROUTE_PROGRESS_LOW else "Media"
        assignments.append({
            "route_id": route.get("id"),
            "truck_code": truck.get("code") if truck else route.get("truck"),
            "zone": route.get("zone"),
            "priority": priority_label,
            "eta": route.get("eta"),
            "action": f"Atender {route.get('zone')} con prioridad {priority_label.lower()}",
        })
    return assignments


def build_intervention_plan(prioritized_zones: list[dict[str, Any]], optimized_routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    primary_zone = prioritized_zones[0] if prioritized_zones else None
    primary_route = optimized_routes[0] if optimized_routes else None
    if primary_zone:
        steps.append({
            "title": "Intervención prioritaria",
            "detail": f"Dirigir el equipo a {primary_zone['name']} porque tiene puntaje {primary_zone['priority_score']} y criticidad {primary_zone['criticality']}",
            "priority": "alta" if str(primary_zone.get("criticality", "")).lower() == "alta" else "media",
            "zone": primary_zone.get("name"),
        })
    if primary_route:
        steps.append({
            "title": "Asignación de ruta",
            "detail": f"{primary_route.get('truck')} debe atender {primary_route.get('zone')} con ETA {primary_route.get('eta')}",
            "priority": "alta" if "retraso" in str(primary_route.get("delay", "")).lower() or int(primary_route.get("progress", 0)) < 40 else "media",
            "route": primary_route.get("truck"),
        })
    if not steps:
        steps.append({
            "title": "Sin acciones pendientes",
            "detail": "No hay una intervención prioritaria en este momento.",
            "priority": "media",
            "zone": None,
        })
    return steps
