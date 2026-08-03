"""Persistencia de usuarios.

Cada operación intenta PostgreSQL y, si no está disponible, recae en el
almacén en memoria del modo demostración.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from app.constants import normalize_role
from app.database import execute_one, fetch_all
from app.memory_store import memory
from app.schemas import RegisterRequest, UserUpdate
from app.security import build_user_payload, hash_password


def get_user_record_by_email(email: str) -> Optional[dict[str, Any]]:
    try:
        row = execute_one(
            "select id, name, email, role, zone, password_hash, created_at from users where email = %s",
            (email,),
        )
        return row
    except Exception:
        for user in memory.users:
            if user["email"].lower() == email.lower():
                return user
        return None


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    row = get_user_record_by_email(email)
    if row is None:
        return None
    return build_user_payload(row)


def create_user_record(payload: RegisterRequest) -> dict[str, Any]:
    hashed = hash_password(payload.password)
    try:
        row = execute_one(
            "insert into users (name, email, role, zone, password_hash) values (%s, %s, %s, %s, %s) returning id, name, email, role, zone, created_at",
            (payload.name, payload.email, normalize_role(payload.role), payload.zone, hashed),
        )
        user = build_user_payload({**row, "password_hash": hashed})
        return user
    except Exception:
        user = {
            "id": len(memory.users) + 1,
            "name": payload.name,
            "email": payload.email,
            "role": normalize_role(payload.role),
            "zone": payload.zone,
            "password_hash": hashed,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        memory.users.append(user)
        return build_user_payload(user)


def list_users() -> list[dict[str, Any]]:
    try:
        rows = fetch_all("select id, name, email, role, zone, created_at from users order by id")
        return [build_user_payload(row) for row in rows]
    except Exception:
        return [build_user_payload(user) for user in memory.users]


def update_user(user_id: int, payload: UserUpdate) -> dict[str, Any]:
    try:
        if payload.name is not None:
            execute_one("update users set name = %s where id = %s", (payload.name, user_id))
        if payload.email is not None:
            execute_one("update users set email = %s where id = %s", (str(payload.email), user_id))
        if payload.role is not None:
            execute_one("update users set role = %s where id = %s", (normalize_role(payload.role), user_id))
        if payload.zone is not None:
            execute_one("update users set zone = %s where id = %s", (payload.zone, user_id))
        row = execute_one("select id, name, email, role, zone, created_at from users where id = %s", (user_id,))
        return build_user_payload(row)
    except Exception:
        for user in memory.users:
            if user["id"] == user_id:
                if payload.name is not None:
                    user["name"] = payload.name
                if payload.email is not None:
                    user["email"] = str(payload.email)
                if payload.role is not None:
                    user["role"] = normalize_role(payload.role)
                if payload.zone is not None:
                    user["zone"] = payload.zone
                return build_user_payload(user)
        raise HTTPException(status_code=404, detail="Usuario no encontrado")


def set_password(email: str, password_hash: str) -> None:
    """Reemplaza la contraseña de una cuenta identificada por su correo."""
    try:
        execute_one("update users set password_hash = %s where email = %s", (password_hash, email))
    except Exception:
        for user in memory.users:
            if user["email"].lower() == email.lower():
                user["password_hash"] = password_hash
                break


def delete_user(user_id: int) -> None:
    try:
        execute_one("delete from users where id = %s", (user_id,))
    except Exception:
        memory.users = [user for user in memory.users if user["id"] != user_id]
