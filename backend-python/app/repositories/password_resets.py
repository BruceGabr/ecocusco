"""Persistencia de tokens de recuperación de contraseña."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.database import execute_one
from app.memory_store import memory


def create_password_reset_token(email: str, token: str, expires_at: datetime) -> dict[str, Any]:
    try:
        return execute_one(
            "insert into password_reset_tokens (email, token, expires_at, created_at) values (%s, %s, %s, %s) returning id, email, token, expires_at",
            (email, token, expires_at, datetime.now(timezone.utc)),
        )
    except Exception:
        memory.password_resets[token] = {"email": email, "expires_at": expires_at.isoformat()}
        return {"id": len(memory.password_resets), "email": email, "token": token, "expires_at": expires_at.isoformat()}


def get_password_reset_entry(token: str) -> Optional[dict[str, Any]]:
    try:
        return execute_one(
            "select id, email, token, expires_at from password_reset_tokens where token = %s",
            (token,),
        )
    except Exception:
        return memory.password_resets.get(token)


def delete_password_reset_token(token: str) -> None:
    try:
        execute_one("delete from password_reset_tokens where token = %s", (token,))
    except Exception:
        memory.password_resets.pop(token, None)
