"""Rutas, monitoreo y eventos operativos.

Este router no lleva prefijo: varios endpoints se publican a la vez con y sin
`/api` porque el microservicio TypeScript de geolocalización expone las mismas
rutas sin prefijo y el frontend usa ambas formas.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.constants import OPERATIONAL_ROLES
from app.dependencies import require_current_user, require_role
from app.repositories.bootstrap import bootstrap
from app.repositories.notifications import NOTIFICATION_TYPE_EVENT, create_notification
from app.repositories.operations import update_container, update_route
from app.schemas import OperationUpdateRequest
from app.services.alerts import build_alerts
from app.services.events import CONTAINER_UPDATE, EVENT_TITLE, ROUTE_UPDATE, build_event_message
from app.services.monitor import build_monitor, geo_trucks


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
def get_alerts() -> dict[str, list[str]]:
    data = bootstrap()
    routes = data.get("routes", [])
    containers = data.get("containers", [])
    return {"alerts": build_alerts(routes=routes, containers=containers)}


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
