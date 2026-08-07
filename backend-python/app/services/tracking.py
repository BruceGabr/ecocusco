"""Qué ocurre cada vez que el camión emite una posición.

Es el corazón del aviso móvil: por cada punto que manda el conductor se mira
qué ciudadanos han quedado a dos cuadras y se les manda la notificación.

Dos reglas evitan que el móvil se convierta en una alarma insoportable:

- **Una sola vez por pasada.** Un aviso ya enviado no se repite mientras el
  camión siga cerca (`proximity_notices`).
- **Histéresis.** El aviso solo vuelve a habilitarse cuando el camión se aleja
  bastante más del umbral de entrada. Sin ella, una lectura de GPS oscilando
  alrededor de los 160 m dispararía una notificación tras otra.
"""

from __future__ import annotations

from typing import Any

from app.constants import (
    PUSH_ALERT_RADIUS_M,
    PUSH_ALERT_RESET_M,
    PUBLIC_REGISTRATION_ROLE,
    Role,
    USER_LOCATION_MAX_AGE_MINUTES,
    normalize_role,
)
from app.repositories.tracking import (
    clear_notice,
    delete_push_token,
    get_session,
    list_user_locations,
    mark_notified,
    notified_user_ids,
    tokens_for_users,
    was_notified,
)
from app.repositories.bootstrap import bootstrap
from app.repositories.users import list_users
from app.services.proximity import haversine_distance_m
from app.services.push import build_message, invalid_tokens, send_push


def _truck_code(session: dict[str, Any]) -> str:
    """Código del camión de la sesión ("C-01").

    La fila de `route_sessions` solo guarda `truck_id`; el aviso tiene que
    nombrar el camión como lo conoce la gente, no por su identificador.
    """
    truck_id = int(session.get("truck_id", 0) or 0)
    truck = next(
        (item for item in bootstrap().get("trucks", []) if int(item.get("id", 0)) == truck_id),
        None,
    )
    return str((truck or {}).get("code") or f"Camión #{truck_id}")


def _blocks_away(distance_m: float) -> str:
    """Traduce la distancia a cuadras, que es como se orienta la gente."""
    blocks = max(1, round(distance_m / 80))
    return "una cuadra" if blocks == 1 else f"{blocks} cuadras"


def citizens_near(latitude: float, longitude: float, radius_m: float) -> list[dict[str, Any]]:
    """Ciudadanos cuya última ubicación conocida cae dentro del radio.

    Solo ciudadanos: el aviso es para quien saca la basura, no para el resto
    del personal municipal, que ya ve la operación en el panel web.
    """
    locations = list_user_locations(USER_LOCATION_MAX_AGE_MINUTES)
    if not locations:
        return []

    citizens = {
        int(user["id"]): user
        for user in list_users()
        if normalize_role(str(user.get("role", PUBLIC_REGISTRATION_ROLE))) == Role.CIUDADANO.value
    }

    near: list[dict[str, Any]] = []
    for location in locations:
        user_id = int(location["user_id"])
        user = citizens.get(user_id)
        if user is None:
            continue
        distance = haversine_distance_m(
            latitude, longitude, float(location["latitude"]), float(location["longitude"])
        )
        if distance <= radius_m:
            near.append({"user": user, "distance_m": distance})

    return sorted(near, key=lambda item: item["distance_m"])


def notify_nearby_citizens(session_id: int, latitude: float, longitude: float) -> dict[str, Any]:
    """Avisa a los ciudadanos que acaban de quedar a dos cuadras del camión.

    Devuelve un resumen para poder verlo en las pruebas y en los registros; el
    conductor no espera a esto, se ejecuta en segundo plano.
    """
    session = get_session(session_id)
    if session is None:
        return {"notified": [], "reason": "sesión inexistente"}

    truck_code = _truck_code(session)

    # Se evalúa un radio amplio: dentro del umbral hay que avisar, y entre el
    # umbral y el de reinicio hay que decidir si ya se alejó lo suficiente como
    # para volver a habilitar el aviso.
    candidates = citizens_near(latitude, longitude, PUSH_ALERT_RESET_M)

    messages: list[dict[str, Any]] = []
    sent_tokens: list[str] = []
    notified: list[int] = []

    # Quien quedó fuera del radio de reinicio vuelve a poder recibir aviso: el
    # camión ya se alejó de verdad y una segunda pasada es una novedad, no un
    # rebote del GPS. `candidates` son justo los que siguen dentro.
    still_close = {int(item["user"]["id"]) for item in candidates}
    for user_id in notified_user_ids(session_id):
        if user_id not in still_close:
            clear_notice(session_id, user_id)

    to_notify = [
        candidate for candidate in candidates
        if candidate["distance_m"] <= PUSH_ALERT_RADIUS_M
        and not was_notified(session_id, int(candidate["user"]["id"]))
    ]
    # Entre el umbral de aviso y el de reinicio no se hace nada: el aviso sigue
    # marcado hasta que el camión se aleje.

    if not to_notify:
        return {"notified": [], "candidates": len(candidates)}

    tokens_by_user: dict[int, list[str]] = {}
    for row in tokens_for_users([int(item["user"]["id"]) for item in to_notify]):
        tokens_by_user.setdefault(int(row["user_id"]), []).append(str(row["token"]))

    for candidate in to_notify:
        user_id = int(candidate["user"]["id"])
        distance = candidate["distance_m"]
        tokens = tokens_by_user.get(user_id, [])
        # Se marca aunque no haya token: así el usuario que instale la app a
        # mitad de la ruta no recibe de golpe un aviso de un camión que ya pasó.
        mark_notified(session_id, user_id, distance)
        notified.append(user_id)
        for token in tokens:
            messages.append(build_message(
                token=token,
                title="El camión está cerca",
                body=(
                    f"{truck_code} está a {_blocks_away(distance)} de ti "
                    f"({int(distance)} m). Saca tus residuos."
                ),
                data={
                    "type": "proximity",
                    "session_id": session_id,
                    "truck": truck_code,
                    "distance_m": int(distance),
                    "latitude": latitude,
                    "longitude": longitude,
                },
            ))
            sent_tokens.append(token)

    receipts = send_push(messages)
    for dead_token in invalid_tokens(receipts, sent_tokens):
        delete_push_token(dead_token)

    return {"notified": notified, "messages": len(messages), "candidates": len(candidates)}
