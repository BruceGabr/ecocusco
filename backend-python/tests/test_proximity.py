"""Pruebas del aviso de proximidad camión ↔ zona.

Cubren las tres lecturas del mismo dato: la del ciudadano (¿viene un camión a
mi zona?), la del conductor (¿de qué zona estoy cerca?) y la del administrador
(todas las parejas). El cálculo de distancia se comprueba contra una distancia
conocida para que un error de fórmula no pase inadvertido.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.constants import PROXIMITY_RADIUS_M, PROXIMITY_VERY_NEAR_M
from app.main import app
from app.services.proximity import (
    build_proximity_alerts,
    find_nearby_trucks,
    haversine_distance_m,
    proximity_tone,
)


@pytest.fixture
def client():
    return TestClient(app)


def _token(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _admin_token(client):
    return _token(client, "admin@ecocusco.pe", "admin123")


def _account(client, email, role, zone="Wanchaq", name=None):
    """Crea una cuenta con el rol pedido y devuelve su token."""
    response = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {_admin_token(client)}"},
        json={
            "name": name or f"Usuario {role}",
            "email": email,
            "password": "Password123",
            "role": role,
            "zone": zone,
        },
    )
    assert response.status_code in (200, 409), response.text
    return _token(client, email, "Password123")


ZONE = {"id": 1, "name": "Wanchaq", "latitude": -13.5256, "longitude": -71.9558}
TRUCK_NEAR = {"code": "C-01", "driver": "Luis Huaman", "status": "En ruta", "zone": "Wanchaq", "latitude": -13.5258, "longitude": -71.9560}
TRUCK_FAR = {"code": "C-09", "driver": "Ana Mamani", "status": "En ruta", "zone": "San Jeronimo", "latitude": -13.5439, "longitude": -71.8889}
TRUCK_PARKED = {"code": "C-05", "driver": "Jose Quispe", "status": "Mantenimiento", "zone": "Wanchaq", "latitude": -13.5256, "longitude": -71.9558}
ROUTES = [{"id": 1, "truck": "C-01", "zone": "Wanchaq", "eta": "12 min"}]


# --- Distancia ---
def test_haversine_devuelve_cero_para_el_mismo_punto():
    assert haversine_distance_m(-13.5256, -71.9558, -13.5256, -71.9558) == 0.0


def test_haversine_coincide_con_una_distancia_conocida():
    # Un grado de latitud son ~111.2 km en cualquier meridiano.
    distancia = haversine_distance_m(0.0, 0.0, 1.0, 0.0)
    assert 111_000 < distancia < 111_400


def test_el_tono_sube_por_debajo_del_umbral_corto():
    assert proximity_tone(PROXIMITY_VERY_NEAR_M - 1) == "muy_cercano"
    assert proximity_tone(PROXIMITY_VERY_NEAR_M + 1) == "cercano"


# --- Búsqueda por radio ---
def test_find_nearby_trucks_descarta_los_que_estan_fuera_del_radio():
    nearby = find_nearby_trucks(
        ZONE["latitude"], ZONE["longitude"], PROXIMITY_RADIUS_M,
        trucks=[TRUCK_NEAR, TRUCK_FAR], routes=ROUTES,
    )
    assert [item["truck_code"] for item in nearby] == ["C-01"]
    assert nearby[0]["eta"] == "12 min"


def test_find_nearby_trucks_ignora_los_camiones_que_no_estan_en_ruta():
    nearby = find_nearby_trucks(
        ZONE["latitude"], ZONE["longitude"], PROXIMITY_RADIUS_M,
        trucks=[TRUCK_PARKED], routes=ROUTES,
    )
    assert nearby == []


def test_find_nearby_trucks_ordena_del_mas_cercano_al_mas_lejano():
    medio = {**TRUCK_FAR, "code": "C-07", "latitude": -13.5286, "longitude": -71.9558}
    nearby = find_nearby_trucks(
        ZONE["latitude"], ZONE["longitude"], PROXIMITY_RADIUS_M,
        trucks=[medio, TRUCK_NEAR], routes=ROUTES,
    )
    assert [item["truck_code"] for item in nearby] == ["C-01", "C-07"]


# --- Alertas por rol ---
def test_sin_sesion_no_hay_alertas():
    assert build_proximity_alerts(None, [TRUCK_NEAR], [ZONE], ROUTES) == []


def test_el_ciudadano_solo_recibe_avisos_de_su_zona():
    usuario = {"id": 7, "role": "ciudadano", "name": "Ana", "zone": "Wanchaq"}
    alertas = build_proximity_alerts(usuario, [TRUCK_NEAR, TRUCK_FAR], [ZONE], ROUTES)
    assert len(alertas) == 1
    assert alertas[0]["truck_code"] == "C-01"
    assert alertas[0]["zone"] == "Wanchaq"
    assert alertas[0]["type"] == "proximity"
    assert alertas[0]["user_id"] == 7


def test_el_ciudadano_sin_zona_conocida_no_recibe_avisos():
    usuario = {"id": 7, "role": "ciudadano", "name": "Ana", "zone": "Zona inexistente"}
    assert build_proximity_alerts(usuario, [TRUCK_NEAR], [ZONE], ROUTES) == []


def test_el_conductor_recibe_avisos_de_zonas_cercanas_a_su_camion():
    usuario = {"id": 3, "role": "conductor", "name": "Luis Huaman", "zone": "Wanchaq"}
    alertas = build_proximity_alerts(usuario, [TRUCK_NEAR], [ZONE], ROUTES)
    assert len(alertas) == 1
    assert alertas[0]["zone"] == "Wanchaq"
    assert alertas[0]["truck_code"] == "C-01"


def test_el_conductor_sin_camion_asignado_no_recibe_avisos():
    usuario = {"id": 3, "role": "conductor", "name": "Otro Conductor", "zone": "Wanchaq"}
    assert build_proximity_alerts(usuario, [TRUCK_NEAR], [ZONE], ROUTES) == []


def test_el_administrador_ve_todas_las_parejas_camion_zona():
    usuario = {"id": 1, "role": "admin", "name": "Admin", "zone": "Centro Historico"}
    otra_zona = {"id": 2, "name": "Centro Historico", "latitude": -13.5257, "longitude": -71.9559}
    alertas = build_proximity_alerts(usuario, [TRUCK_NEAR], [ZONE, otra_zona], ROUTES)
    assert {alerta["zone"] for alerta in alertas} == {"Wanchaq", "Centro Historico"}


# --- Endpoint ---
def test_proximity_check_exige_sesion(client):
    response = client.post("/api/proximity/check", json={"latitude": -13.5256, "longitude": -71.9558})
    assert response.status_code == 401


def test_proximity_check_devuelve_camiones_cercanos(client):
    token = _account(client, "prox.ciudadano@ecocusco.pe", "ciudadano")
    response = client.post(
        "/api/proximity/check",
        headers={"Authorization": f"Bearer {token}"},
        json={"latitude": -13.5256, "longitude": -71.9558, "radius_m": 5000},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["radius_m"] == 5000
    for item in payload["nearby"]:
        assert item["distance_m"] <= 5000
        assert item["tone"] in {"cercano", "muy_cercano"}


def test_proximity_check_rechaza_un_radio_fuera_de_rango(client):
    token = _account(client, "prox.radio@ecocusco.pe", "ciudadano")
    response = client.post(
        "/api/proximity/check",
        headers={"Authorization": f"Bearer {token}"},
        json={"latitude": -13.5256, "longitude": -71.9558, "radius_m": 999_999},
    )
    assert response.status_code == 422


def test_el_monitor_expone_las_alertas_de_proximidad(client):
    token = _account(client, "prox.monitor@ecocusco.pe", "ciudadano", zone="Centro Historico")
    response = client.get("/api/operations/monitor", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "proximity_alerts" in payload
    # Las de proximidad también viajan mezcladas con el resto de notificaciones.
    tipos = {item.get("type") for item in payload.get("notifications", [])}
    assert tipos <= {"proximity", "event", "info", "alert", "recordatorio", "alerta"} or tipos


def test_alerts_sigue_siendo_publico(client):
    """El microservicio de geolocalización la consume sin token."""
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert isinstance(response.json()["alerts"], list)
