"""Administración de cuentas de usuario."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.constants import ADMIN_ROLES
from app.dependencies import require_role
from app.repositories.users import create_user_record, delete_user, get_user_by_email, list_users, update_user
from app.schemas import RegisterRequest, UserUpdate


router = APIRouter(prefix="/api", tags=["usuarios"])


@router.get("/users", dependencies=[Depends(require_role(ADMIN_ROLES))])
def get_users() -> list[dict[str, Any]]:
    return list_users()


@router.post("/users", dependencies=[Depends(require_role(ADMIN_ROLES))])
def create_user(payload: RegisterRequest) -> dict[str, Any]:
    existing = get_user_by_email(str(payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Este correo ya está registrado")
    user = create_user_record(payload)
    return user


@router.patch("/users/{user_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def patch_user(user_id: int, payload: UserUpdate) -> dict[str, Any]:
    return update_user(user_id, payload)


@router.delete("/users/{user_id}", dependencies=[Depends(require_role(ADMIN_ROLES))])
def remove_user(user_id: int) -> dict[str, Any]:
    delete_user(user_id)
    return {"ok": "true", "message": "Usuario eliminado"}
