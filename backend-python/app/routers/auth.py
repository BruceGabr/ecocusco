"""Registro, inicio de sesión y recuperación de contraseña."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.config import PASSWORD_RESET_TTL_MINUTES
from app.constants import PUBLIC_REGISTRATION_ROLE
from app.dependencies import require_current_user
from app.repositories.password_resets import (
    create_password_reset_token,
    delete_password_reset_token,
    get_password_reset_entry,
)
from app.repositories.users import (
    create_user_record,
    get_user_by_email,
    get_user_record_by_email,
    set_password,
)
from app.schemas import LoginRequest, PasswordResetConfirm, PasswordResetRequest, RegisterRequest
from app.security import build_user_payload, create_token, hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["autenticación"])


@router.post("/register")
def register(payload: RegisterRequest) -> dict[str, Any]:
    existing = get_user_by_email(str(payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Este correo ya está registrado")
    # El registro público SIEMPRE crea un ciudadano. Antes el rol venía del
    # cuerpo de la petición, así que cualquiera podía darse de alta como "admin"
    # y quedarse con el control del sistema. Los roles con privilegios solo se
    # asignan desde POST /api/users, que exige un administrador autenticado.
    public_payload = payload.model_copy(update={"role": PUBLIC_REGISTRATION_ROLE})
    user = create_user_record(public_payload)
    token = create_token(user)
    return {"ok": True, "token": token, "user": user}


@router.post("/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    user_record = get_user_record_by_email(str(payload.email))
    if user_record is None:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    password_hash = user_record.get("password_hash") or ""
    user = build_user_payload(user_record)
    if not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_token(user)
    return {"ok": True, "token": token, "user": user}


@router.get("/me")
def get_me(current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    return current_user


@router.post("/forgot-password")
def forgot_password(payload: PasswordResetRequest) -> dict[str, Any]:
    user = get_user_by_email(str(payload.email))
    if user is None:
        return {"ok": True, "message": "Si el correo existe, se ha enviado un enlace de recuperación"}
    token = os.urandom(8).hex()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES)
    create_password_reset_token(str(payload.email), token, expires_at)
    return {"ok": True, "token": token, "message": "Usa este token para restablecer la contraseña"}


@router.post("/reset-password")
def reset_password(payload: PasswordResetConfirm) -> dict[str, Any]:
    entry = get_password_reset_entry(payload.token)
    if entry is None:
        raise HTTPException(status_code=400, detail="Token de recuperación inválido")
    expires_at = datetime.fromisoformat(str(entry["expires_at"]))
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token de recuperación expirado")
    email = str(entry["email"])
    user = get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    set_password(email, hash_password(payload.password))
    delete_password_reset_token(payload.token)
    return {"ok": True, "message": "Contraseña actualizada correctamente"}
