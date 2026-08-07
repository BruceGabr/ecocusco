"""Qué datos puede ver cada rol.

`/api/bootstrap` era anónimo y devolvía el listado completo de usuarios con sus
correos, todos los reportes ciudadanos (nombre + detalle) y las notificaciones
de todo el mundo. Estos tests fijan el recorte por rol.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.visibility import visible_notifications_for, visible_reports_for


@pytest.fixture
def client():
    return TestClient(app)


def _admin_token(client):
    response = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _citizen_token(client, email="vecina.visibilidad@test.pe"):
    client.post("/api/auth/register", json={
        "name": "Vecina Visibilidad",
        "email": email,
        "password": "Password123",
        "zone": "Wanchaq",
    })
    response = client.post("/api/auth/login", json={"email": email, "password": "Password123"})
    assert response.status_code == 200, response.text
    return response.json()["token"]


# --- Sin sesión no se accede a la carga inicial ---
def test_bootstrap_requires_authentication(client):
    assert client.get("/api/bootstrap").status_code == 401


# --- Las zonas siguen siendo públicas: la pantalla de acceso las necesita ---
def test_zones_remain_public(client):
    response = client.get("/api/zones")
    assert response.status_code == 200
    assert len(response.json()) > 0


# --- Un ciudadano no recibe el listado de usuarios ---
def test_citizen_bootstrap_hides_user_directory(client):
    token = _citizen_token(client)
    data = client.get("/api/bootstrap", headers={"Authorization": f"Bearer {token}"}).json()
    assert data["users"] == [], "un ciudadano no debe recibir los correos de los demás"


# --- Un administrador sí lo recibe ---
def test_admin_bootstrap_includes_user_directory(client):
    token = _admin_token(client)
    data = client.get("/api/bootstrap", headers={"Authorization": f"Bearer {token}"}).json()
    assert len(data["users"]) > 0


# --- Un ciudadano solo ve sus propios reportes ---
def test_citizen_only_sees_own_reports():
    reports = [
        {"id": 1, "citizen": "Ana Quispe", "detail": "a"},
        {"id": 2, "citizen": "Jose Huaman", "detail": "b"},
    ]
    visible = visible_reports_for({"role": "ciudadano", "name": "Ana Quispe"}, reports)
    assert [item["id"] for item in visible] == [1]


def test_admin_sees_all_reports():
    reports = [{"id": 1, "citizen": "Ana"}, {"id": 2, "citizen": "Jose"}]
    assert len(visible_reports_for({"role": "admin", "name": "Admin"}, reports)) == 2


# --- Las notificaciones ajenas no se filtran; las de difusión sí llegan ---
def test_notifications_are_scoped_to_the_user():
    notifications = [
        {"id": 1, "user_id": 1, "message": "para el usuario 1"},
        {"id": 2, "user_id": 2, "message": "para el usuario 2"},
        {"id": 3, "user_id": None, "message": "difusión"},
    ]
    visible = visible_notifications_for({"id": 1}, notifications)
    assert [item["id"] for item in visible] == [1, 3]
