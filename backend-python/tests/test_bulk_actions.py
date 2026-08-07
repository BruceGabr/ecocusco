"""Pruebas del borrado masivo del panel de administración.

Lo que hay que sostener: solo un administrador puede lanzarlo, solo se admite
la acción `delete`, solo sobre los recursos declarados, y un id inexistente no
puede abortar el resto de la selección.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.bulk import DELETERS, bulk_delete


@pytest.fixture
def client():
    return TestClient(app)


def _token(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _admin_token(client):
    return _token(client, "admin@ecocusco.pe", "admin123")


def _account(client, email, role, zone="Wanchaq"):
    response = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {_admin_token(client)}"},
        json={"name": f"Usuario {role}", "email": email, "password": "Password123", "role": role, "zone": zone},
    )
    assert response.status_code in (200, 409), response.text
    return _token(client, email, "Password123")


def test_los_recursos_soportados_son_los_del_panel():
    assert set(DELETERS) == {"users", "zones", "schedules", "trucks", "maintenance"}


def test_bulk_delete_rechaza_un_recurso_desconocido():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        bulk_delete("facturas", [1])
    assert error.value.status_code == 400


def test_exige_sesion(client):
    response = client.post("/api/admin/bulk-action", json={"resource": "zones", "action": "delete", "ids": [1]})
    assert response.status_code == 401


def test_un_ciudadano_no_puede_lanzarlo(client):
    token = _account(client, "bulk.ciudadano@ecocusco.pe", "ciudadano")
    response = client.post(
        "/api/admin/bulk-action",
        headers={"Authorization": f"Bearer {token}"},
        json={"resource": "zones", "action": "delete", "ids": [999]},
    )
    assert response.status_code == 403


def test_rechaza_una_accion_no_soportada(client):
    response = client.post(
        "/api/admin/bulk-action",
        headers={"Authorization": f"Bearer {_admin_token(client)}"},
        json={"resource": "zones", "action": "archivar", "ids": [1]},
    )
    assert response.status_code == 400
    assert "archivar" in response.json()["detail"]


def test_rechaza_una_seleccion_vacia(client):
    response = client.post(
        "/api/admin/bulk-action",
        headers={"Authorization": f"Bearer {_admin_token(client)}"},
        json={"resource": "zones", "action": "delete", "ids": []},
    )
    assert response.status_code == 422


def test_borra_varios_registros_en_una_sola_peticion(client):
    headers = {"Authorization": f"Bearer {_admin_token(client)}"}
    creadas = []
    for nombre in ("Zona masiva A", "Zona masiva B", "Zona masiva C"):
        response = client.post("/api/zones", headers=headers, json={"name": nombre, "latitude": -13.5, "longitude": -71.9, "criticality": "Baja"})
        assert response.status_code == 200, response.text
        creadas.append(response.json()["id"])

    response = client.post(
        "/api/admin/bulk-action",
        headers=headers,
        json={"resource": "zones", "action": "delete", "ids": creadas},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["count"] == len(creadas)
    assert sorted(payload["deleted"]) == sorted(creadas)

    restantes = {zona["id"] for zona in client.get("/api/zones").json()}
    assert restantes.isdisjoint(creadas)
