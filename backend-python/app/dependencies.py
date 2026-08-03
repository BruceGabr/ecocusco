"""Dependencias de FastAPI para autenticación y autorización."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, Header, HTTPException

from app.constants import PUBLIC_REGISTRATION_ROLE, normalize_role
from app.repositories.users import get_user_by_email
from app.security import decode_token, session_exceeded_max_age

#: Mensaje único para cualquier sesión que ya no sirve. La respuesta no
#: distingue entre firma inválida, token caducado y sesión demasiado antigua:
#: para quien llama la acción es la misma, volver a iniciar sesión, y detallar
#: el motivo solo daría pistas a quien esté probando tokens.
SESSION_REJECTED_DETAIL = "Sesión inválida o expirada"


def require_token_payload(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Valida el token y devuelve su contenido, sin tocar la base de datos.

    Se usa donde hacen falta las marcas de la sesión, como `auth_time` en la
    renovación.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=SESSION_REJECTED_DETAIL) from exc

    # El tope absoluto se comprueba en cada petición, no solo al renovar: si no,
    # un token emitido justo antes de alcanzarlo seguiría sirviendo después.
    if session_exceeded_max_age(payload):
        raise HTTPException(status_code=401, detail=SESSION_REJECTED_DETAIL)
    return payload


def require_current_user(
    payload: dict[str, Any] = Depends(require_token_payload),
) -> dict[str, Any]:
    """Usuario autenticado, releído de la base de datos.

    No se confía en el rol que viaja dentro del token: si un administrador
    cambia el rol de alguien, el token viejo seguiría anunciando el anterior.
    """
    user = get_user_by_email(str(payload.get("email", "")))
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


def require_role(allowed_roles: set[str]):
    def dependency(current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
        if normalize_role(str(current_user.get("role", PUBLIC_REGISTRATION_ROLE))) not in allowed_roles:
            raise HTTPException(status_code=403, detail="No autorizado para esta acción")
        return current_user

    return dependency
