"""Contraseñas y tokens de sesión."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.config import JWT_ALGORITHM, JWT_SECRET, TOKEN_TTL_HOURS
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


def create_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": normalize_role(str(user.get("role", PUBLIC_REGISTRATION_ROLE))),
        "name": user.get("name"),
        "zone": user.get("zone", DEFAULT_ZONE),
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
