"""Persistencia del seguimiento en vivo de la app móvil.

Cubre tres cosas que hasta ahora no existían:

- **Sesiones de ruta**: el conductor abre una al pulsar "Iniciar ruta" y se
  cierra al terminarla. Es lo que permite monitorearlo: quién salió, con qué
  camión, cuándo y cuánto recorrió.
- **Posiciones**: cada punto que emite el móvil durante la sesión. Se guardan
  todos para poder reconstruir el trayecto.
- **Tokens push y ubicación del ciudadano**: lo que hace falta para avisarle
  cuando el camión está a dos cuadras.

Como el resto de repositorios, cada función intenta PostgreSQL y cae al
almacén en memoria si no hay base de datos.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.database import execute_one, fetch_all, normalize_dates
from app.memory_store import memory
from app.services.proximity import haversine_distance_m

SESSION_ACTIVE = "activa"
SESSION_FINISHED = "finalizada"

#: Precisión peor que esto se descarta: son lecturas de antena, no de GPS, y
#: moverían el camión cientos de metros de golpe.
MAX_ACCEPTABLE_ACCURACY_M = 200

#: Salto máximo creíble entre dos lecturas consecutivas. Por encima se guarda
#: el punto pero no se suma a la distancia recorrida, para que un rebote del
#: GPS no infle el total.
MAX_CREDIBLE_JUMP_M = 2_000


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Sesiones de ruta -------------------------------------------------------


def build_session_payload(session: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": session.get("id"),
        "truck_id": session.get("truck_id"),
        "truck": session.get("truck"),
        "driver_id": session.get("driver_id"),
        "driver": session.get("driver"),
        "zone_id": session.get("zone_id"),
        "zone": session.get("zone"),
        "status": session.get("status"),
        "started_at": session.get("started_at"),
        "finished_at": session.get("finished_at"),
        "distance_m": float(session.get("distance_m", 0) or 0),
        "positions_count": int(session.get("positions_count", 0) or 0),
        "last_position": session.get("last_position"),
    }


def get_active_session_for_truck(truck_id: int) -> dict[str, Any] | None:
    try:
        rows = fetch_all(
            "select * from route_sessions where truck_id = %s and status = %s",
            (truck_id, SESSION_ACTIVE),
        )
        return normalize_dates(rows)[0] if rows else None
    except Exception:
        return next(
            (
                item for item in memory.route_sessions
                if item["truck_id"] == truck_id and item["status"] == SESSION_ACTIVE
            ),
            None,
        )


def get_active_session_for_driver(driver_id: int) -> dict[str, Any] | None:
    try:
        rows = fetch_all(
            "select * from route_sessions where driver_id = %s and status = %s order by started_at desc",
            (driver_id, SESSION_ACTIVE),
        )
        return normalize_dates(rows)[0] if rows else None
    except Exception:
        return next(
            (
                item for item in memory.route_sessions
                if item["driver_id"] == driver_id and item["status"] == SESSION_ACTIVE
            ),
            None,
        )


def get_session(session_id: int) -> dict[str, Any] | None:
    try:
        rows = fetch_all("select * from route_sessions where id = %s", (session_id,))
        return normalize_dates(rows)[0] if rows else None
    except Exception:
        return next((item for item in memory.route_sessions if item["id"] == session_id), None)


def create_session(truck_id: int, driver_id: int, zone_id: int | None) -> dict[str, Any]:
    """Abre una sesión de ruta.

    Si el camión ya tiene una activa se devuelve esa en vez de crear otra: el
    conductor pudo cerrar la app y volver a entrar, y duplicar la sesión
    partiría el recorrido en dos.
    """
    existing = get_active_session_for_truck(truck_id)
    if existing is not None:
        return existing

    try:
        return normalize_dates([execute_one(
            "insert into route_sessions (truck_id, driver_id, zone_id, status) values (%s, %s, %s, %s) returning *",
            (truck_id, driver_id, zone_id, SESSION_ACTIVE),
        )])[0]
    except HTTPException:
        raise
    except Exception:
        session = {
            "id": max([item["id"] for item in memory.route_sessions], default=0) + 1,
            "truck_id": truck_id,
            "driver_id": driver_id,
            "zone_id": zone_id,
            "status": SESSION_ACTIVE,
            "started_at": _now(),
            "finished_at": None,
            "distance_m": 0.0,
            "positions_count": 0,
        }
        memory.route_sessions.append(session)
        return session


def finish_session(session_id: int) -> dict[str, Any]:
    try:
        return normalize_dates([execute_one(
            "update route_sessions set status = %s, finished_at = now() where id = %s returning *",
            (SESSION_FINISHED, session_id),
        )])[0]
    except HTTPException:
        raise
    except Exception:
        for session in memory.route_sessions:
            if session["id"] == session_id:
                session["status"] = SESSION_FINISHED
                session["finished_at"] = _now()
                return session
        raise HTTPException(status_code=404, detail="Sesión de ruta no encontrada")


def list_sessions(driver_id: int | None = None, limit: int = 50) -> list[dict[str, Any]]:
    """Sesiones más recientes primero. Sin `driver_id` devuelve las de todos."""
    try:
        if driver_id is None:
            rows = fetch_all("select * from route_sessions order by started_at desc limit %s", (limit,))
        else:
            rows = fetch_all(
                "select * from route_sessions where driver_id = %s order by started_at desc limit %s",
                (driver_id, limit),
            )
        return normalize_dates(rows)
    except Exception:
        sessions = [
            item for item in memory.route_sessions
            if driver_id is None or item["driver_id"] == driver_id
        ]
        return sorted(sessions, key=lambda item: str(item["started_at"]), reverse=True)[:limit]


def list_active_sessions() -> list[dict[str, Any]]:
    try:
        return normalize_dates(fetch_all(
            "select * from route_sessions where status = %s order by started_at desc",
            (SESSION_ACTIVE,),
        ))
    except Exception:
        return [item for item in memory.route_sessions if item["status"] == SESSION_ACTIVE]


# --- Posiciones -------------------------------------------------------------


def last_position(session_id: int) -> dict[str, Any] | None:
    try:
        rows = fetch_all(
            "select * from truck_positions where session_id = %s order by recorded_at desc limit 1",
            (session_id,),
        )
        return normalize_dates(rows)[0] if rows else None
    except Exception:
        points = [item for item in memory.truck_positions if item["session_id"] == session_id]
        return points[-1] if points else None


def list_positions(session_id: int, limit: int = 500) -> list[dict[str, Any]]:
    """Trayecto de una sesión, en orden cronológico."""
    try:
        rows = fetch_all(
            "select * from truck_positions where session_id = %s order by recorded_at asc limit %s",
            (session_id, limit),
        )
        return normalize_dates(rows)
    except Exception:
        return [item for item in memory.truck_positions if item["session_id"] == session_id][:limit]


def record_position(
    session_id: int,
    latitude: float,
    longitude: float,
    accuracy_m: float | None = None,
    speed_mps: float | None = None,
) -> dict[str, Any]:
    """Guarda un punto y actualiza las métricas acumuladas de la sesión.

    La distancia se suma respecto del punto anterior, descartando saltos
    increíbles para que un rebote del GPS no infle el total.
    """
    previous = last_position(session_id)
    step_m = 0.0
    if previous is not None:
        step_m = haversine_distance_m(
            float(previous["latitude"]), float(previous["longitude"]), latitude, longitude
        )
        if step_m > MAX_CREDIBLE_JUMP_M:
            step_m = 0.0

    try:
        row = execute_one(
            "insert into truck_positions (session_id, latitude, longitude, accuracy_m, speed_mps) "
            "values (%s, %s, %s, %s, %s) returning *",
            (session_id, latitude, longitude, accuracy_m, speed_mps),
        )
        execute_one(
            "update route_sessions set distance_m = distance_m + %s, positions_count = positions_count + 1 "
            "where id = %s returning id",
            (step_m, session_id),
        )
        return normalize_dates([row])[0]
    except HTTPException:
        raise
    except Exception:
        point = {
            "id": max([item["id"] for item in memory.truck_positions], default=0) + 1,
            "session_id": session_id,
            "latitude": latitude,
            "longitude": longitude,
            "accuracy_m": accuracy_m,
            "speed_mps": speed_mps,
            "recorded_at": _now(),
        }
        memory.truck_positions.append(point)
        for session in memory.route_sessions:
            if session["id"] == session_id:
                session["distance_m"] = float(session.get("distance_m", 0)) + step_m
                session["positions_count"] = int(session.get("positions_count", 0)) + 1
        return point


# --- Tokens de notificación push --------------------------------------------


def save_push_token(user_id: int, token: str, platform: str | None) -> None:
    """Asocia un token de dispositivo a un usuario.

    El token es único: si el dispositivo cambia de dueño (dos personas usando
    el mismo móvil), el registro se reasigna en vez de duplicarse, para que el
    aviso no siga llegándole a quien ya no lo usa.
    """
    try:
        execute_one(
            "insert into push_tokens (user_id, token, platform) values (%s, %s, %s) "
            "on conflict (token) do update set user_id = excluded.user_id, "
            "platform = excluded.platform, updated_at = now() returning id",
            (user_id, token, platform),
        )
    except Exception:
        for item in memory.push_tokens:
            if item["token"] == token:
                item["user_id"] = user_id
                item["platform"] = platform
                item["updated_at"] = _now()
                return
        memory.push_tokens.append({
            "id": max([item["id"] for item in memory.push_tokens], default=0) + 1,
            "user_id": user_id,
            "token": token,
            "platform": platform,
            "created_at": _now(),
            "updated_at": _now(),
        })


def delete_push_token(token: str) -> None:
    """Retira un token. Se llama al cerrar sesión y cuando Expo lo rechaza."""
    try:
        execute_one("delete from push_tokens where token = %s returning id", (token,))
    except Exception:
        memory.push_tokens = [item for item in memory.push_tokens if item["token"] != token]


def tokens_for_users(user_ids: list[int]) -> list[dict[str, Any]]:
    if not user_ids:
        return []
    try:
        return fetch_all(
            "select user_id, token from push_tokens where user_id = any(%s)",
            (list(user_ids),),
        )
    except Exception:
        wanted = set(user_ids)
        return [
            {"user_id": item["user_id"], "token": item["token"]}
            for item in memory.push_tokens
            if item["user_id"] in wanted
        ]


# --- Ubicación del ciudadano ------------------------------------------------


def save_user_location(user_id: int, latitude: float, longitude: float, accuracy_m: float | None) -> None:
    """Guarda la última posición conocida del usuario.

    Solo se conserva la última: no hace falta el historial de por dónde anda un
    ciudadano para avisarle de que viene el camión, y guardarlo sería recopilar
    datos personales sin razón.
    """
    try:
        execute_one(
            "insert into user_locations (user_id, latitude, longitude, accuracy_m) values (%s, %s, %s, %s) "
            "on conflict (user_id) do update set latitude = excluded.latitude, "
            "longitude = excluded.longitude, accuracy_m = excluded.accuracy_m, updated_at = now() "
            "returning user_id",
            (user_id, latitude, longitude, accuracy_m),
        )
    except Exception:
        memory.user_locations[user_id] = {
            "user_id": user_id,
            "latitude": latitude,
            "longitude": longitude,
            "accuracy_m": accuracy_m,
            "updated_at": _now(),
        }


def get_user_location(user_id: int) -> dict[str, Any] | None:
    try:
        rows = fetch_all("select * from user_locations where user_id = %s", (user_id,))
        return normalize_dates(rows)[0] if rows else None
    except Exception:
        return memory.user_locations.get(user_id)


def list_user_locations(max_age_minutes: int) -> list[dict[str, Any]]:
    """Ubicaciones recientes. Una de hace horas ya no dice dónde está nadie."""
    try:
        return normalize_dates(fetch_all(
            "select * from user_locations where updated_at > now() - make_interval(mins => %s)",
            (max_age_minutes,),
        ))
    except Exception:
        # En memoria no se filtra por antigüedad: el proceso se reinicia a
        # menudo y las entradas nunca llegan a ser viejas.
        return list(memory.user_locations.values())


# --- Avisos ya enviados -----------------------------------------------------


def was_notified(session_id: int, user_id: int) -> bool:
    try:
        rows = fetch_all(
            "select 1 from proximity_notices where session_id = %s and user_id = %s",
            (session_id, user_id),
        )
        return bool(rows)
    except Exception:
        return (session_id, user_id) in memory.proximity_notices


def mark_notified(session_id: int, user_id: int, distance_m: float) -> None:
    try:
        execute_one(
            "insert into proximity_notices (session_id, user_id, distance_m) values (%s, %s, %s) "
            "on conflict (session_id, user_id) do nothing returning id",
            (session_id, user_id, distance_m),
        )
    except Exception:
        memory.proximity_notices.add((session_id, user_id))


def notified_user_ids(session_id: int) -> list[int]:
    """Quiénes ya recibieron aviso en esta sesión de ruta."""
    try:
        rows = fetch_all("select user_id from proximity_notices where session_id = %s", (session_id,))
        return [int(row["user_id"]) for row in rows]
    except Exception:
        return [user_id for (sid, user_id) in memory.proximity_notices if sid == session_id]


def clear_notice(session_id: int, user_id: int) -> None:
    """Olvida el aviso para que pueda volver a emitirse en otra pasada."""
    try:
        execute_one(
            "delete from proximity_notices where session_id = %s and user_id = %s returning id",
            (session_id, user_id),
        )
    except Exception:
        memory.proximity_notices.discard((session_id, user_id))
