"""Contraseñas y tokens de sesión."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.config import (
    JWT_ALGORITHM,
    JWT_SECRET,
    SESSION_ABSOLUTE_MAX_HOURS,
    TOKEN_TTL_MINUTES,
)
from app.constants import PUBLIC_REGISTRATION_ROLE, normalize_role

#: Zona por defecto cuando una cuenta no tiene una asignada.
DEFAULT_ZONE = "Centro Historico"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def build_user_payload(user: dict[str, Any]) -> dict[str, Any]:
    """Vista pública de un usuario: nunca incluye el hash de la contraseña."""
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": normalize_role(str(user.get("role", PUBLIC_REGISTRATION_ROLE))),
        "zone": user.get("zone", DEFAULT_ZONE),
        "created_at": user.get("created_at"),
    }


def create_token(user: dict[str, Any], auth_time: int | None = None) -> str:
    """Emite un token de sesión.

    `auth_time` es el instante del inicio de sesión ORIGINAL, en segundos. Se
    conserva intacto al renovar: es lo que permite aplicar el tope absoluto,
    porque `exp` se desplaza en cada renovación y por sí solo no diría hace
    cuánto empezó realmente la sesión.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": normalize_role(str(user.get("role", PUBLIC_REGISTRATION_ROLE))),
        "name": user.get("name"),
        "zone": user.get("zone", DEFAULT_ZONE),
        "auth_time": auth_time if auth_time is not None else int(now.timestamp()),
        "exp": now + timedelta(minutes=TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Valida firma y caducidad. Lanza si el token no sirve."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def session_expires_at(auth_time: int) -> datetime:
    """Momento en que la sesión muere sí o sí, por antigüedad."""
    started = datetime.fromtimestamp(auth_time, timezone.utc)
    return started + timedelta(hours=SESSION_ABSOLUTE_MAX_HOURS)


def session_exceeded_max_age(payload: dict[str, Any]) -> bool:
    """True si la sesión superó el tope absoluto desde su inicio original.

    Un token sin `auth_time` se considera agotado: o lo emitió una versión
    anterior, o alguien lo armó a mano. En ambos casos toca volver a entrar.
    """
    auth_time = payload.get("auth_time")
    if auth_time is None:
        return True
    return datetime.now(timezone.utc) >= session_expires_at(int(auth_time))
