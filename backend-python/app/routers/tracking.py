"""Seguimiento en vivo y avisos al móvil.

Es la API que consume la aplicación móvil. Dos flujos:

- El **conductor** abre una sesión de ruta, emite su posición mientras conduce
  y la cierra al terminar.
- El **ciudadano** registra su token de notificaciones y su ubicación, y
  consulta qué camiones están circulando ahora mismo.

El envío de notificaciones va en segundo plano: el móvil del conductor no debe
esperar a que Expo responda para poder emitir el siguiente punto.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.constants import (
    ADMIN_ROLES,
    OPERATIONAL_ROLES,
    PUBLIC_REGISTRATION_ROLE,
    PUSH_ALERT_RADIUS_M,
    Role,
    TRUCK_STATUS_ON_ROUTE,
    normalize_role,
)
from app.dependencies import require_current_user, require_role
from app.repositories.bootstrap import bootstrap
from app.repositories.tracking import (
    SESSION_ACTIVE,
    build_session_payload,
    create_session,
    delete_push_token,
    finish_session,
    get_active_session_for_driver,
    get_session,
    get_user_location,
    last_position,
    list_active_sessions,
    list_positions,
    list_sessions,
    record_position,
    save_push_token,
    save_user_location,
)
from app.schemas import (
    PositionReport,
    PushTokenRegister,
    RouteSessionStart,
    UserLocationReport,
)
from app.services.proximity import haversine_distance_m
from app.services.tracking import notify_nearby_citizens

router = APIRouter(prefix="/api/tracking", tags=["seguimiento"])

CONDUCTOR_ROLES = {Role.CONDUCTOR.value}
MONITORING_ROLES = OPERATIONAL_ROLES | ADMIN_ROLES


def _truck_for_driver(user: dict[str, Any], truck_id: int | None) -> dict[str, Any]:
    """Camión con el que sale este conductor.

    Se busca por nombre porque la ficha del camión guarda el nombre del
    conductor, no su id. Si el conductor indica un `truck_id` distinto del
    suyo, se rechaza: si no, cualquiera podría emitir posiciones falsas en
    nombre de otro vehículo.
    """
    trucks = bootstrap().get("trucks", [])
    own = next(
        (
            truck for truck in trucks
            if str(truck.get("driver", "")).strip().lower() == str(user.get("name", "")).strip().lower()
        ),
        None,
    )

    if truck_id is None:
        if own is None:
            raise HTTPException(
                status_code=409,
                detail="No tienes un camión asignado. Pide a un administrador que te asigne uno.",
            )
        return own

    requested = next((truck for truck in trucks if int(truck.get("id", 0)) == truck_id), None)
    if requested is None:
        raise HTTPException(status_code=404, detail="Camión no encontrado")
    if own is not None and int(own.get("id", 0)) != truck_id:
        raise HTTPException(status_code=403, detail="Solo puedes iniciar ruta con el camión que tienes asignado")
    return requested


def _decorate(session: dict[str, Any]) -> dict[str, Any]:
    """Completa la sesión con el código del camión, la zona y su último punto."""
    data = bootstrap()
    truck = next(
        (item for item in data.get("trucks", []) if int(item.get("id", 0)) == int(session.get("truck_id", 0))),
        None,
    )
    zone_id = session.get("zone_id") or (truck or {}).get("zone_id")
    zone = next((item for item in data.get("zones", []) if int(item.get("id", 0)) == int(zone_id or 0)), None)
    driver = next(
        (item for item in data.get("users", []) if int(item.get("id", 0)) == int(session.get("driver_id", 0))),
        None,
    )
    point = last_position(int(session["id"]))
    return build_session_payload({
        **session,
        "truck": (truck or {}).get("code"),
        "driver": (driver or {}).get("name") or (truck or {}).get("driver"),
        "zone_id": zone_id,
        "zone": (zone or {}).get("name"),
        "last_position": point and {
            "latitude": float(point["latitude"]),
            "longitude": float(point["longitude"]),
            "recorded_at": point.get("recorded_at"),
            "speed_mps": point.get("speed_mps"),
        },
    })


# --- Conductor --------------------------------------------------------------


@router.post("/sessions")
def start_route(
    payload: RouteSessionStart,
    current_user: dict[str, Any] = Depends(require_role(CONDUCTOR_ROLES)),
) -> dict[str, Any]:
    """"Iniciar ruta": abre la sesión y deja el camión marcado como en ruta."""
    truck = _truck_for_driver(current_user, payload.truck_id)
    session = create_session(
        truck_id=int(truck["id"]),
        driver_id=int(current_user["id"]),
        zone_id=truck.get("zone_id"),
    )

    # El primer punto se guarda ya si el móvil lo trae: así el ciudadano ve el
    # camión en el mapa desde el segundo cero, sin esperar al siguiente envío.
    if payload.latitude is not None and payload.longitude is not None:
        record_position(int(session["id"]), payload.latitude, payload.longitude)

    _set_truck_on_route(int(truck["id"]), True)
    return _decorate(get_session(int(session["id"])) or session)


@router.get("/sessions/active")
def my_active_session(
    current_user: dict[str, Any] = Depends(require_role(CONDUCTOR_ROLES)),
) -> dict[str, Any] | None:
    """Sesión abierta del conductor, para restaurar el estado al abrir la app."""
    session = get_active_session_for_driver(int(current_user["id"]))
    return _decorate(session) if session else None


@router.post("/sessions/{session_id}/positions")
def report_position(
    session_id: int,
    payload: PositionReport,
    background: BackgroundTasks,
    current_user: dict[str, Any] = Depends(require_role(CONDUCTOR_ROLES)),
) -> dict[str, Any]:
    """Registra un punto del recorrido y avisa a quien haya quedado cerca."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sesión de ruta no encontrada")
    if int(session["driver_id"]) != int(current_user["id"]):
        raise HTTPException(status_code=403, detail="Esta sesión de ruta no es tuya")
    if session["status"] != SESSION_ACTIVE:
        raise HTTPException(status_code=409, detail="La sesión de ruta ya está finalizada")

    record_position(
        session_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_m=payload.accuracy_m,
        speed_mps=payload.speed_mps,
    )
    _sync_truck_position(int(session["truck_id"]), payload.latitude, payload.longitude)

    # En segundo plano: el móvil no espera a que Expo entregue los avisos.
    background.add_task(notify_nearby_citizens, session_id, payload.latitude, payload.longitude)

    return {"ok": True, "alert_radius_m": PUSH_ALERT_RADIUS_M}


@router.post("/sessions/{session_id}/finish")
def finish_route(
    session_id: int,
    current_user: dict[str, Any] = Depends(require_role(CONDUCTOR_ROLES)),
) -> dict[str, Any]:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sesión de ruta no encontrada")
    if int(session["driver_id"]) != int(current_user["id"]):
        raise HTTPException(status_code=403, detail="Esta sesión de ruta no es tuya")

    finished = finish_session(session_id)
    _set_truck_on_route(int(session["truck_id"]), False)
    return _decorate(finished)


# --- Ciudadano --------------------------------------------------------------


@router.get("/live")
def live_trucks(current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    """Camiones circulando ahora mismo, con su última posición conocida.

    Cualquier sesión con rol puede consultarlo: el ciudadano necesita ver el
    camión que se acerca a su calle. Se devuelven todos y es el móvil quien
    centra el mapa en la zona del usuario.
    """
    sessions = [_decorate(session) for session in list_active_sessions()]
    trucks = [session for session in sessions if session.get("last_position")]

    location = get_user_location(int(current_user["id"]))
    if location is not None:
        # Se adjunta la distancia para que el móvil pueda ordenar y destacar
        # sin recalcularla.
        for truck in trucks:
            point = truck["last_position"]
            truck["distance_m"] = haversine_distance_m(
                float(location["latitude"]), float(location["longitude"]),
                point["latitude"], point["longitude"],
            )
        trucks.sort(key=lambda item: item.get("distance_m", float("inf")))

    return {"trucks": trucks, "alert_radius_m": PUSH_ALERT_RADIUS_M}


@router.post("/me/location")
def report_my_location(
    payload: UserLocationReport,
    current_user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    """Guarda dónde está el usuario, para medir el aviso de proximidad.

    Solo se conserva la última posición: para avisar de que viene el camión no
    hace falta el historial de por dónde anda una persona.
    """
    save_user_location(
        user_id=int(current_user["id"]),
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_m=payload.accuracy_m,
    )
    return {"ok": True}


@router.post("/push-token")
def register_push_token(
    payload: PushTokenRegister,
    current_user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    save_push_token(int(current_user["id"]), payload.token, payload.platform)
    return {"ok": True}


@router.delete("/push-token")
def unregister_push_token(
    payload: PushTokenRegister,
    current_user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    """Se llama al cerrar sesión: sin esto el móvil seguiría recibiendo avisos
    dirigidos a la cuenta anterior."""
    delete_push_token(payload.token)
    return {"ok": True}


# --- Monitoreo (web) --------------------------------------------------------


@router.get("/sessions")
def monitor_sessions(
    driver_id: int | None = None,
    current_user: dict[str, Any] = Depends(require_current_user),
) -> list[dict[str, Any]]:
    """Historial de sesiones de ruta.

    Operadores y administradores las ven todas; un conductor solo las suyas.
    """
    role = normalize_role(str(current_user.get("role", PUBLIC_REGISTRATION_ROLE)))
    if role in MONITORING_ROLES:
        return [_decorate(session) for session in list_sessions(driver_id=driver_id)]
    if role == Role.CONDUCTOR.value:
        return [_decorate(session) for session in list_sessions(driver_id=int(current_user["id"]))]
    raise HTTPException(status_code=403, detail="No autorizado para consultar el seguimiento")


@router.get("/sessions/{session_id}/track")
def session_track(
    session_id: int,
    current_user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    """Trayecto completo de una sesión, para dibujarlo en el mapa."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sesión de ruta no encontrada")

    role = normalize_role(str(current_user.get("role", PUBLIC_REGISTRATION_ROLE)))
    is_owner = int(session["driver_id"]) == int(current_user["id"])
    if role not in MONITORING_ROLES and not is_owner:
        raise HTTPException(status_code=403, detail="No autorizado para consultar este recorrido")

    points = [
        {
            "latitude": float(point["latitude"]),
            "longitude": float(point["longitude"]),
            "recorded_at": point.get("recorded_at"),
            "speed_mps": point.get("speed_mps"),
        }
        for point in list_positions(session_id)
    ]
    return {"session": _decorate(session), "points": points}


# --- Utilidades internas ----------------------------------------------------


def _set_truck_on_route(truck_id: int, on_route: bool) -> None:
    """Refleja en la ficha del camión que salió o volvió.

    Mantiene coherente lo que ya mira el resto del sistema: las alertas de
    proximidad de la web y el conteo de "camiones en ruta" leen `status`.
    """
    from app.repositories.trucks import update_truck
    from app.schemas import TruckUpdate

    status = TRUCK_STATUS_ON_ROUTE if on_route else "Disponible"
    try:
        update_truck(truck_id, TruckUpdate(status=status))
    except Exception:
        # Que no se pueda actualizar el estado no debe impedir iniciar la ruta.
        print(f"[tracking] no se pudo marcar el camión {truck_id} como '{status}'", flush=True)


def _sync_truck_position(truck_id: int, latitude: float, longitude: float) -> None:
    """Copia la última posición a la ficha del camión.

    Así el mapa de la web y las alertas de proximidad existentes, que leen
    `trucks`, ven al camión donde está de verdad sin conocer las sesiones.
    """
    from app.repositories.trucks import update_truck
    from app.schemas import TruckUpdate

    try:
        update_truck(truck_id, TruckUpdate(latitude=latitude, longitude=longitude))
    except Exception:
        print(f"[tracking] no se pudo sincronizar la posición del camión {truck_id}", flush=True)
