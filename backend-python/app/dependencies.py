"""Dependencias de FastAPI para autenticación y autorización."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, Header, HTTPException

from app.constants import PUBLIC_REGISTRATION_ROLE, normalize_role
from app.repositories.users import get_user_by_email
from app.security import decode_token


def require_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc
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
