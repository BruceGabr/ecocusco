"""Rutas, monitoreo y eventos operativos.

Este router no lleva prefijo: varios endpoints se publican a la vez con y sin
`/api` porque el microservicio TypeScript de geolocalización expone las mismas
rutas sin prefijo y el frontend usa ambas formas.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.constants import (
    OPERATIONAL_ROLES,
    PUBLIC_REGISTRATION_ROLE,
    Role,
    normalize_role,
)
from app.dependencies import optional_current_user, require_current_user, require_role
from app.repositories.bootstrap import bootstrap
from app.repositories.notifications import NOTIFICATION_TYPE_EVENT, create_notification
from app.repositories.operations import update_container, update_route
from app.schemas import OperationUpdateRequest, ProximityCheckRequest
from app.services.alerts import build_alerts
from app.services.events import CONTAINER_UPDATE, EVENT_TITLE, ROUTE_UPDATE, build_event_message
from app.services.monitor import build_monitor, geo_trucks
from app.services.proximity import build_proximity_alerts, find_nearby_trucks


router = APIRouter(tags=["operaciones"])


@router.get("/truck-locations")
@router.get("/api/truck-locations")
def get_truck_locations() -> dict[str, list[dict[str, Any]]]:
    return {"trucks": geo_trucks()}


@router.get("/api/routes")
def get_routes() -> list[dict[str, Any]]:
    return bootstrap()["routes"]


@router.get("/api/operations/monitor")
def get_monitor(current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    # Requiere sesión: el monitor incluye notificaciones, que son personales.
    return build_monitor(user=current_user)


@router.post("/api/operations/update")
def update_operation(
    payload: OperationUpdateRequest,
    current_user: dict[str, Any] = Depends(require_role(OPERATIONAL_ROLES)),
) -> dict[str, Any]:
    """Registra un evento operativo y devuelve el monitoreo ya actualizado."""
    if payload.type == ROUTE_UPDATE:
        if payload.progress is None and payload.delay is None:
            raise HTTPException(
                status_code=400,
                detail="Se requiere progreso o retraso para la actualización de ruta",
            )
        updated = update_route(payload.id, progress=payload.progress, delay=payload.delay)
        if not updated:
            raise HTTPException(status_code=404, detail="Ruta no encontrada")

    elif payload.type == CONTAINER_UPDATE:
        if payload.fill_level is None and payload.status is None:
            raise HTTPException(
                status_code=400,
                detail="Se requiere nivel de llenado o estado para la actualización de contenedor",
            )
        updated = update_container(payload.id, fill_level=payload.fill_level, status=payload.status)
        if not updated:
            raise HTTPException(status_code=404, detail="Contenedor no encontrado")

    else:
        raise HTTPException(status_code=400, detail="Tipo de evento operativo no reconocido")

    create_notification(
        user_id=current_user.get("id"),
        title=EVENT_TITLE,
        message=build_event_message(str(current_user.get("name")), payload),
        notification_type=NOTIFICATION_TYPE_EVENT,
    )

    # simulate=False: se devuelve el estado recién guardado, no el simulado.
    return build_monitor(simulate=False, user=current_user)


@router.get("/alerts")
@router.get("/api/alerts")
def get_alerts(current_user: dict[str, Any] | None = Depends(optional_current_user)) -> dict[str, list[str]]:
    """Alertas operativas en texto plano, recortadas a la zona del ciudadano.

    Sigue siendo accesible sin sesión porque el microservicio de geolocalización
    la consume sin token; en ese caso devuelve la vista global.
    """
    data = bootstrap()
    routes = data.get("routes", [])
    containers = data.get("containers", [])

    if current_user is not None:
        role = normalize_role(str(current_user.get("role", PUBLIC_REGISTRATION_ROLE)))
        citizen_zone = str(current_user.get("zone", "")).strip().lower()
        if role == Role.CIUDADANO.value and citizen_zone:
            routes = [
                route for route in routes
                if str(route.get("zone", "")).strip().lower() == citizen_zone
            ]

    alerts = build_alerts(routes=routes, containers=containers)
    proximity = build_proximity_alerts(
        user=current_user,
        trucks=data.get("trucks", []),
        zones=data.get("zones", []),
        routes=routes,
    )
    alerts.extend(f"[Proximidad] {item['message']}" for item in proximity)
    return {"alerts": alerts}


@router.post("/api/proximity/check")
def check_proximity(
    payload: ProximityCheckRequest,
    current_user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    """Camiones en ruta dentro del radio pedido desde un punto concreto.

    Se consulta con la posición de la zona del ciudadano (o la del propio
    dispositivo) en lugar de esperar al siguiente ciclo del monitor.
    """
    data = bootstrap()
    nearby = find_nearby_trucks(
        latitude=payload.latitude,
        longitude=payload.longitude,
        radius_m=payload.radius_m,
        trucks=data.get("trucks", []),
        routes=data.get("routes", []),
    )
    return {"nearby": nearby, "radius_m": payload.radius_m}


@router.get("/eta")
@router.get("/api/eta")
def get_eta(truck: str | None = None) -> dict[str, Any]:
    trucks = geo_trucks()
    selected = next((item for item in trucks if item["code"] == truck), trucks[0])
    return {
        "truck": selected["code"],
        "etaMinutes": selected["etaMinutes"],
        "eta": f'{selected["etaMinutes"]} min',
    }
