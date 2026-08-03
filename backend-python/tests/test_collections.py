"""Pruebas del flujo de recolecciones.

Existen porque `create_collection_record` y `confirm_collection_by_citizen`
estuvieron indentadas dentro de `delete_maintenance`: no existían a nivel de
módulo y ambos endpoints respondían 500 con NameError. Ningún test tocaba
`POST /api/collections`, así que el fallo pasó desapercibido.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.main import app, build_collection_payload, confirm_collection_by_citizen, create_collection_record
from app.main import CollectionCreate


@pytest.fixture
def client():
    return TestClient(app)


def _token(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _register(client, email, role):
    """Crea una cuenta con el rol pedido usando la API de administración."""
    admin_token = _token(client, "admin@ecocusco.pe", "admin123")
    response = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": f"Usuario {role}", "email": email, "password": "Password123", "role": role, "zone": "Wanchaq"},
    )
    assert response.status_code in (200, 409), response.text
    return _token(client, email, "Password123")


# --- Las funciones deben ser invocables a nivel de módulo ---
def test_collection_helpers_are_module_level():
    assert callable(create_collection_record)
    assert callable(confirm_collection_by_citizen)


def test_build_collection_payload_resolves_names():
    payload = build_collection_payload({"id": 1, "zone_id": 1, "truck_id": 1, "kg": 100, "status": "Confirmada", "date": "2026-06-10"})
    assert payload["zone"], "la zona debe resolverse a su nombre"
    assert payload["truck"], "el camión debe resolverse a su código"
    assert payload["kg"] == 100


# --- Un conductor puede registrar una recolección ---
def test_driver_can_register_collection(client):
    token = _register(client, "conductor.test@ecocusco.pe", "conductor")
    response = client.post(
        "/api/collections",
        headers={"Authorization": f"Bearer {token}"},
        json={"truck_id": 1, "zone_id": 1, "kg": 250, "status": "Confirmada"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kg"] == 250
    assert body["zone"] and body["truck"]


# --- Un ciudadano NO puede registrar recolecciones ---
def test_citizen_cannot_register_collection(client):
    token = _register(client, "ciudadano.test@ecocusco.pe", "ciudadano")
    response = client.post(
        "/api/collections",
        headers={"Authorization": f"Bearer {token}"},
        json={"truck_id": 1, "zone_id": 1, "kg": 10, "status": "Confirmada"},
    )
    assert response.status_code == 403


# --- Un ciudadano confirma una recolección; el resultado nunca es None ---
def test_citizen_can_confirm_collection(client):
    driver_token = _register(client, "conductor2.test@ecocusco.pe", "conductor")
    created = client.post(
        "/api/collections",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"truck_id": 1, "zone_id": 1, "kg": 120, "status": "Parcial"},
    ).json()

    citizen_token = _register(client, "ciudadano2.test@ecocusco.pe", "ciudadano")
    response = client.post(
        f"/api/collections/{created['id']}/confirm",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body is not None, "en modo memoria la función devolvía None"
    assert "ciudadano" in str(body["status"]).lower()


# --- Confirmar algo que no existe es 404, no 500 ---
def test_confirm_unknown_collection_returns_404(client):
    token = _register(client, "ciudadano3.test@ecocusco.pe", "ciudadano")
    response = client.post(
        "/api/collections/999999/confirm",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
