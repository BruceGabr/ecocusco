"""Métricas e indicadores del panel de analítica."""

from __future__ import annotations

from typing import Any

from app.constants import (
    COLLECTION_STATUS_CONFIRMED,
    REPORT_STATUS_RESOLVED,
    ROUTE_PROGRESS_LOW,
    TRUCK_STATUS_ON_ROUTE,
)
from app.services.routing import route_is_delayed


def calculate_compliance(routes: list[dict[str, Any]]) -> int:
    """Cumplimiento de rutas, en porcentaje.

    Se define como la proporción de rutas que avanzan sin retraso. Antes este
    valor estaba escrito a mano como `87` en los dos sitios que lo devolvían,
    así que el indicador "Cumplimiento de rutas" del PDF (Módulo 6) mostraba un
    número inventado que nunca cambiaba.

    Limitación conocida: la medida correcta sería *rutas completadas / rutas
    programadas* en un periodo, pero la tabla `routes` todavía no guarda fecha
    ni estado. Queda pendiente en la Fase 5 del plan (docs/AUDITORIA-Y-PLAN.md).
    """
    if not routes:
        return 0
    on_time = len([route for route in routes if not route_is_delayed(route)])
    return round(on_time / len(routes) * 100)


def build_analytics(
    zones: list[dict[str, Any]],
    trucks: list[dict[str, Any]],
    reports: list[dict[str, Any]],
    collections: list[dict[str, Any]],
    routes: list[dict[str, Any]],
) -> dict[str, Any]:
    """Resumen para el panel de analítica. Única definición de estas métricas."""
    return {
        "zones": len(zones),
        "active_trucks": len([truck for truck in trucks if truck.get("status") == TRUCK_STATUS_ON_ROUTE]),
        "open_reports": len([report for report in reports if report.get("status") != REPORT_STATUS_RESOLVED]),
        "confirmed_collections": len(
            [item for item in collections if item.get("status") == COLLECTION_STATUS_CONFIRMED]
        ),
        "total_kg": sum(item.get("kg", 0) for item in collections),
        "compliance": calculate_compliance(routes),
    }


def analytics_from(rows: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return build_analytics(
        zones=rows["zones"],
        trucks=rows["trucks"],
        reports=rows["reports"],
        collections=rows["collections"],
        routes=rows.get("routes", []),
    )


def build_performance_metrics(routes: list[dict[str, Any]], reports: list[dict[str, Any]], containers: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    containers = containers or []
    total_routes = len(routes)
    delayed_routes = len([route for route in routes if route_is_delayed(route)])
    low_progress_routes = len([route for route in routes if int(route.get("progress", 0)) < ROUTE_PROGRESS_LOW])
    average_progress = round(sum(int(route.get("progress", 0)) for route in routes) / max(1, total_routes)) if total_routes else 0
    average_fill = round(sum(int(container.get("fill_level", 0)) for container in containers) / max(1, len(containers))) if containers else 0
    open_reports = len([report for report in reports if str(report.get("status", "")).lower() != REPORT_STATUS_RESOLVED.lower()])
    compliance_estimate = max(0, 100 - delayed_routes * 10 - low_progress_routes * 5)
    return {
        "total_routes": total_routes,
        "delayed_routes": delayed_routes,
        "low_progress_routes": low_progress_routes,
        "average_progress": average_progress,
        "open_reports": open_reports,
        "average_container_fill": average_fill,
        "compliance_estimate": compliance_estimate,
    }
