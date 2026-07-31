import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from fastapi.testclient import TestClient


# --- LOGIN: Credenciales correctas ---
def test_login_valid_credentials():
    client = TestClient(app)
    response = client.post("/api/auth/login", json={
        "email": "admin@ecocusco.pe",
        "password": "admin123",
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert "token" in payload
    assert payload["user"]["email"] == "admin@ecocusco.pe"
    assert payload["user"]["role"] == "admin"


# --- LOGIN: Contrasena incorrecta ---
def test_login_invalid_credentials():
    client = TestClient(app)
    response = client.post("/api/auth/login", json={
        "email": "admin@ecocusco.pe",
        "password": "wrongpassword",
    })
    assert response.status_code == 401
    assert "inválidas" in response.json()["detail"].lower()


# --- LOGIN: Formato de email invalido ---
def test_login_invalid_email_format():
    client = TestClient(app)
    response = client.post("/api/auth/login", json={
        "email": "not-an-email",
        "password": "admin123",
    })
    assert response.status_code == 422


# --- REGISTRO: Usuario nuevo exitoso ---
def test_register_new_user():
    client = TestClient(app)
    response = client.post("/api/auth/register", json={
        "name": "Lab10 User",
        "email": "lab10@test.pe",
        "password": "testpass123",
        "role": "ciudadano",
        "zone": "Wanchaq",
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert "token" in payload
    assert payload["user"]["email"] == "lab10@test.pe"
    assert payload["user"]["role"] == "ciudadano"


# --- REGISTRO: Email duplicado ---
def test_register_duplicate_email():
    client = TestClient(app)
    response = client.post("/api/auth/register", json={
        "name": "Admin Duplicate",
        "email": "admin@ecocusco.pe",
        "password": "admin123",
    })
    assert response.status_code == 409
    assert "registrado" in response.json()["detail"].lower()


# --- REGISTRO: Campos obligatorios faltantes ---
def test_register_missing_fields():
    client = TestClient(app)
    response = client.post("/api/auth/register", json={
        "name": "No Password",
        "email": "nopass@test.pe",
    })
    assert response.status_code == 422


# --- HORARIOS: Lista no vacia ---
def test_get_schedules_returns_list():
    client = TestClient(app)
    response = client.get("/api/schedules")
    assert response.status_code == 200
    schedules = response.json()
    assert isinstance(schedules, list)
    assert len(schedules) > 0


# --- HORARIOS: Estructura correcta de datos ---
def test_get_schedules_structure():
    client = TestClient(app)
    response = client.get("/api/schedules")
    schedules = response.json()
    for schedule in schedules:
        assert "id" in schedule
        assert "zone_id" in schedule
        assert "day" in schedule
        assert "time" in schedule
        assert "waste" in schedule


# --- HORARIOS: Filtro por zona especifica ---
def test_get_schedules_filter_by_zone():
    client = TestClient(app)
    response = client.get("/api/schedules")
    schedules = response.json()
    centro = [s for s in schedules if s.get("zone_name") == "Centro Historico" or s.get("zone_id") == 1]
    assert len(centro) > 0
