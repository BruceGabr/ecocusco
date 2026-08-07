"""Envío de notificaciones push a los móviles, por el servicio de Expo.

Un solo POST a `exp.host` con la lista de mensajes. Se usa `urllib` de la
biblioteca estándar en vez de añadir un cliente HTTP a la imagen de producción:
es una única petición JSON y no justifica una dependencia más.

El envío nunca debe bloquear la petición del conductor: quien llama lo hace
desde un `BackgroundTask`.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

#: Punto de entrada del servicio push de Expo.
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

#: Expo acepta como mucho 100 mensajes por petición.
MAX_MESSAGES_PER_REQUEST = 100

#: Si Expo no responde en este plazo se abandona el envío. El aviso de
#: proximidad caduca en minutos: reintentarlo más tarde no sirve de nada.
REQUEST_TIMEOUT_S = 10

#: Canal de Android. El móvil lo crea con prioridad alta para que la
#: notificación aparezca sobre la pantalla y suene.
ANDROID_CHANNEL_ID = "proximidad"


def _chunks(items: list[Any], size: int):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def build_message(token: str, title: str, body: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "to": token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": "default",
        # `high` pide a Android que despierte el dispositivo: sin ella, el
        # aviso podría llegar cuando ya pasó el camión.
        "priority": "high",
        "channelId": ANDROID_CHANNEL_ID,
    }


def send_push(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Entrega los mensajes y devuelve los recibos de Expo.

    Los fallos no se propagan: si el servicio push no responde, la ruta del
    conductor debe seguir grabándose igual. Se registran en consola para poder
    diagnosticarlos.
    """
    if not messages:
        return []

    receipts: list[dict[str, Any]] = []
    for batch in _chunks(messages, MAX_MESSAGES_PER_REQUEST):
        request = urllib.request.Request(
            EXPO_PUSH_URL,
            data=json.dumps(batch).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "identity",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
                payload = json.loads(response.read().decode("utf-8"))
                receipts.extend(payload.get("data", []))
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            print(f"[push] no se pudo enviar el lote de {len(batch)} avisos: {error}", flush=True)

    return receipts


def invalid_tokens(receipts: list[dict[str, Any]], sent_tokens: list[str]) -> list[str]:
    """Tokens que Expo rechaza por no existir ya (app desinstalada).

    Los recibos vienen en el mismo orden que los mensajes enviados. Conviene
    borrarlos: seguir mandándoles avisos gasta cuota y nunca llegan.
    """
    dead: list[str] = []
    for index, receipt in enumerate(receipts):
        if receipt.get("status") != "error":
            continue
        error_code = (receipt.get("details") or {}).get("error")
        if error_code == "DeviceNotRegistered" and index < len(sent_tokens):
            dead.append(sent_tokens[index])
    return dead
