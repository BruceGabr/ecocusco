"""Política de sesión: deslizante por actividad, con tope absoluto.

Antes el token duraba 12 horas fijas desde el inicio de sesión, así que cortaba
a mitad de la jornada aunque se estuviera trabajando. Ahora vive poco y se
renueva mientras haya actividad, pero nunca más allá del tope absoluto.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import (
    JWT_ALGORITHM,
    JWT_SECRET,
    SESSION_ABSOLUTE_MAX_HOURS,
    TOKEN_TTL_MINUTES,
)
from app.main import app
from app.security import create_token, session_exceeded_max_age, session_expires_at


@pytest.fixture
def client():
    return TestClient(app)


def _login(client):
    response = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _claims(token):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# --- El token emitido dura lo configurado, no 12 horas ---
def test_login_token_lives_the_configured_minutes(client):
    claims = _claims(_login(client))
    lifetime = datetime.fromtimestamp(claims["exp"], timezone.utc) - datetime.now(timezone.utc)
    assert timedelta(minutes=TOKEN_TTL_MINUTES) - lifetime < timedelta(seconds=30)


# --- El inicio de sesión original queda marcado ---
def test_login_records_original_auth_time(client):
    claims = _claims(_login(client))
    assert "auth_time" in claims
    started = datetime.fromtimestamp(claims["auth_time"], timezone.utc)
    assert datetime.now(timezone.utc) - started < timedelta(seconds=30)


# --- Renovar desplaza la caducidad pero NO el inicio de la sesión ---
def test_refresh_extends_expiry_but_keeps_auth_time(client):
    original = _login(client)
    original_claims = _claims(original)

    response = client.post("/api/auth/refresh", headers=_auth(original))
    assert response.status_code == 200, response.text
    renewed_claims = _claims(response.json()["token"])

    assert renewed_claims["auth_time"] == original_claims["auth_time"], (
        "el tope absoluto se perdería si renovar reiniciara el inicio de sesión"
    )
    assert renewed_claims["exp"] >= original_claims["exp"]


# --- Sin sesión no se renueva nada ---
def test_refresh_requires_a_token(client):
    assert client.post("/api/auth/refresh").status_code == 401


# --- Un token caducado no puede renovarse: hay que volver a entrar ---
def test_expired_token_cannot_be_refreshed(client):
    expired = jwt.encode(
        {
            "sub": "1",
            "email": "admin@ecocusco.pe",
            "role": "admin",
            "name": "Admin",
            "zone": "Centro Historico",
            "auth_time": int(datetime.now(timezone.utc).timestamp()),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    assert client.post("/api/auth/refresh", headers=_auth(expired)).status_code == 401


# --- El tope absoluto corta aunque el token siga vigente ---
def test_session_older_than_the_cap_is_rejected(client):
    started = datetime.now(timezone.utc) - timedelta(hours=SESSION_ABSOLUTE_MAX_HOURS, minutes=1)
    aged = create_token(
        {"id": 1, "email": "admin@ecocusco.pe", "role": "admin", "name": "Admin", "zone": "Centro Historico"},
        auth_time=int(started.timestamp()),
    )

    # El token en sí no ha caducado: lo que agota la sesión es su antigüedad.
    assert _claims(aged)["exp"] > datetime.now(timezone.utc).timestamp()

    assert client.post("/api/auth/refresh", headers=_auth(aged)).status_code == 401
    assert client.get("/api/bootstrap", headers=_auth(aged)).status_code == 401, (
        "el tope debe aplicarse en cada petición, no solo al renovar"
    )


# --- Un token sin auth_time (versión anterior) se considera agotado ---
def test_token_without_auth_time_is_rejected():
    assert session_exceeded_max_age({"email": "admin@ecocusco.pe"}) is True


def test_session_expires_at_uses_the_configured_cap():
    started = datetime.now(timezone.utc)
    expected = started + timedelta(hours=SESSION_ABSOLUTE_MAX_HOURS)
    assert session_expires_at(int(started.timestamp())) == pytest.approx(expected, abs=timedelta(seconds=1))


# --- Renovar mantiene el acceso operativo ---
def test_renewed_token_still_authorizes(client):
    token = client.post("/api/auth/refresh", headers=_auth(_login(client))).json()["token"]
    assert client.get("/api/bootstrap", headers=_auth(token)).status_code == 200
