import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from fastapi.testclient import TestClient


def _login_as_admin(client):
    response = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    return response.json()["token"]


# --- ZONAS: Los nombres y criticalidad deben ser coherentes ---
def test_zones_have_valid_criticality():
    client = TestClient(app)
    zones = client.get("/api/zones").json()
    valid = {"Alta", "Media", "Baja"}
    for zone in zones:
        assert zone["criticality"] in valid, f"{zone['name']} tiene criticality invalida: {zone['criticality']}"


# --- CAMIONES: Estado debe ser uno de los valores permitidos ---
def test_trucks_have_valid_status():
    client = TestClient(app)
    trucks = client.get("/api/trucks").json()
    valid = {"En ruta", "Disponible", "Mantenimiento", "Descanso", "Completado"}
    for truck in trucks:
        assert truck["status"] in valid, f"{truck['code']} tiene estado invalido: {truck['status']}"


# --- RUTAS: El progreso debe estar entre 0 y 100 ---
def test_routes_progress_is_valid_percentage():
    client = TestClient(app)
    routes = client.get("/api/routes").json()
    for route in routes:
        assert 0 <= route["progress"] <= 100, f"Ruta {route['id']}: progress={route['progress']} fuera de rango"


# --- RUTAS: Si el progreso es 100, el estado debe ser Completado ---
def test_completed_routes_have_completed_status():
    client = TestClient(app)
    routes = client.get("/api/routes").json()
    for route in routes:
        if route["progress"] == 100:
            assert route["delay"] == "Completado", f"Ruta {route['id']} completada pero delay={route['delay']}"


# --- BOOTSTRAP: Los IDs de schedules deben coincidir con zonas existentes ---
def test_schedules_reference_valid_zones():
    client = TestClient(app)
    token = _login_as_admin(client)
    data = client.get("/api/bootstrap", headers={"Authorization": f"Bearer {token}"}).json()
    zone_ids = {z["id"] for z in data["zones"]}
    for schedule in data["schedules"]:
        assert schedule["zone_id"] in zone_ids, f"Schedule {schedule['id']} referencia zone_id {schedule['zone_id']} inexistente"


# --- REPORTES: FLUJO COMPLETO - crear, listar, resolver ---
def test_report_full_crud_flow():
    client = TestClient(app)
    token = _login_as_admin(client)

    before = client.get("/api/reports", headers={"Authorization": f"Bearer {token}"}).json()
    count_before = len(before)

    created = client.post("/api/reports", json={
        "citizen": "Test Flujo",
        "zone": "Wanchaq",
        "type": "Recolecta no realizada",
        "detail": "Prueba de creacion y resolucion de reporte",
    }, headers={"Authorization": f"Bearer {token}"}).json()
    report_id = created["id"]

    after_create = client.get("/api/reports", headers={"Authorization": f"Bearer {token}"}).json()
    assert len(after_create) == count_before + 1

    resolved = client.patch(f"/api/reports/{report_id}/resolve", headers={"Authorization": f"Bearer {token}"}).json()
    assert resolved["status"] == "Resuelto"


# --- ANALYTICS: Las metricas deben ser coherentes con los datos reales ---
def test_analytics_metrics_are_coherent():
    client = TestClient(app)
    token = _login_as_admin(client)
    summary = client.get("/api/analytics/summary").json()
    zones = client.get("/api/zones").json()
    reports = client.get("/api/reports", headers={"Authorization": f"Bearer {token}"}).json()

    assert summary["zones"] == len(zones)
    assert summary["open_reports"] <= len(reports)
    assert summary["active_trucks"] <= len(client.get("/api/trucks").json())


# --- AUTH: Token invalido debe ser rechazado ---
def test_invalid_token_is_rejected():
    client = TestClient(app)
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer token-falso"})
    assert response.status_code == 401


# --- ROLES: Ciudadano registrado NO puede acceder a /api/users ---
def test_ciudadano_cannot_access_admin_endpoints():
    client = TestClient(app)

    register = client.post("/api/auth/register", json={
        "name": "Ciudadano Test",
        "email": "ciudadano_test@test.pe",
        "password": "testpass123",
        "role": "ciudadano",
        "zone": "Centro Historico",
    })
    token = register.json()["token"]

    response = client.get("/api/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


# --- COLECCIONES: Las colecciones confirmadas deben tener fecha ---
def test_confirmed_collections_have_date():
    client = TestClient(app)
    collections = client.get("/api/collections").json()
    for collection in collections:
        if collection.get("confirmed"):
            assert collection.get("confirmed_at") is not None, f"Coleccion {collection.get('id')} confirmada sin fecha"


# --- REPORTE SIN AUTENTICACION: Debe ser rechazado ---
def test_create_report_without_auth_fails():
    client = TestClient(app)
    response = client.post("/api/reports", json={
        "citizen": "Anonimo",
        "zone": "Centro Historico",
        "type": "Basura acumulada",
        "detail": "Reporte sin token de prueba",
    })
    assert response.status_code == 401


# --- ROLES: Login como admin devuelve rol admin ---
def test_login_as_admin_returns_admin_role():
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "admin"


# --- ROLES: el registro público ignora el rol pedido y crea un ciudadano ---
#
# Este test comprobaba lo contrario (que pedir "operador" te daba "operador"),
# es decir, fijaba por escrito una escalada de privilegios: cualquiera podía
# registrarse como "admin" desde el formulario público y tomar el control.
def test_public_register_always_creates_citizen():
    client = TestClient(app)
    response = client.post("/api/auth/register", json={
        "name": "Operador Test",
        "email": "operador_test@test.pe",
        "password": "operador123",
        "role": "admin",
        "zone": "Wanchaq",
    })
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "ciudadano"

    login = client.post("/api/auth/login", json={"email": "operador_test@test.pe", "password": "operador123"})
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "ciudadano"


# --- ROLES: los roles con privilegios solo los asigna un administrador ---
def test_admin_can_create_privileged_user():
    client = TestClient(app)
    token = _login_as_admin(client)
    response = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Operador Municipal",
            "email": "operador_municipal@test.pe",
            "password": "operador123",
            "role": "operador",
            "zone": "Wanchaq",
        },
    )
    assert response.status_code == 200
    assert response.json()["role"] == "operador"


# --- ROLES: sin autenticación no se pueden crear usuarios privilegiados ---
def test_anonymous_cannot_create_privileged_user():
    client = TestClient(app)
    response = client.post("/api/users", json={
        "name": "Intruso",
        "email": "intruso@test.pe",
        "password": "intruso123",
        "role": "admin",
        "zone": "Wanchaq",
    })
    assert response.status_code == 401
