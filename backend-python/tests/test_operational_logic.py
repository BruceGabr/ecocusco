import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app, build_alerts, simulate_truck_positions
from fastapi.testclient import TestClient


def test_health_endpoint_reports_ok():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"] == "1.0.0"
    assert payload["database"] in {"memory", "postgresql", "memory (psycopg no instalado)"}
    assert payload["mode"] in {"demo", "production"}


def test_build_alerts_detects_full_containers_and_delays():
    routes = [{"id": 1, "truck": "C-04", "zone": "Santiago", "progress": 25, "eta": "28 min", "delay": "Sin retraso", "latitude": -13.5350, "longitude": -71.9847}]
    containers = [{"id": 1, "zone_id": 1, "name": "Contenedor 01", "fill_level": 92, "status": "Lleno"}]
    alerts = build_alerts(routes=routes, containers=containers)
    assert any("Contenedor 01" in alert for alert in alerts)
    assert any("retraso" in alert.lower() for alert in alerts)


def test_simulate_truck_positions_changes_coordinates():
    routes = [{"id": 1, "truck": "C-01", "zone": "Centro Historico", "progress": 80, "eta": "5 min", "delay": "Sin retraso", "latitude": -13.5166, "longitude": -71.9789}]
    positions = simulate_truck_positions(routes)
    assert positions[0]["code"] == "C-01"
    assert positions[0]["latitude"] != routes[0]["latitude"]
    assert positions[0]["longitude"] != routes[0]["longitude"]


def test_update_operation_route_event_requires_auth_and_updates_monitor():
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    assert login.status_code == 200
    token = login.json()["token"]

    response = client.post(
        "/api/operations/update",
        json={"type": "route_update", "id": 1, "progress": 70, "delay": "Retraso leve"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "truck_assignments" in payload
    assert "performance" in payload
    assert payload["performance"]["delayed_routes"] >= 1


def test_update_operation_container_event_requires_auth_and_updates_monitor():
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    assert login.status_code == 200
    token = login.json()["token"]

    response = client.post(
        "/api/operations/update",
        json={"type": "container_update", "id": 1, "fill_level": 95, "status": "Lleno"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "containers" in payload
    assert any(container["id"] == 1 and container["fill_level"] == 95 for container in payload["containers"])
    assert payload["notifications"] and any(
        isinstance(note, dict) and ("Contenedor 1 actualizado" in note.get("message", "") or "Lleno" in note.get("message", ""))
        for note in payload["notifications"]
    )


def test_e2e_route_update_persists_to_routes_and_monitor():
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    assert login.status_code == 200
    token = login.json()["token"]

    response = client.post(
        "/api/operations/update",
        json={"type": "route_update", "id": 1, "progress": 70, "delay": "Retraso leve"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["performance"]["delayed_routes"] >= 1
    assert any(
        isinstance(note, dict) and "Ruta 1 actualizada" in note.get("message", "")
        for note in payload["notifications"]
    )

    monitor = client.get("/api/operations/monitor")
    assert monitor.status_code == 200
    monitor_payload = monitor.json()
    assert monitor_payload["performance"]["delayed_routes"] >= 1

    routes = client.get("/api/routes")
    assert routes.status_code == 200
    assert any(route["id"] == 1 and route["progress"] == 70 and route["delay"] == "Retraso leve" for route in routes.json())


def test_e2e_container_update_persists_to_containers_and_monitor():
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    assert login.status_code == 200
    token = login.json()["token"]

    response = client.post(
        "/api/operations/update",
        json={"type": "container_update", "id": 1, "fill_level": 95, "status": "Lleno"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert any(
        isinstance(note, dict) and "Contenedor 1 actualizado" in note.get("message", "")
        for note in payload["notifications"]
    )
    assert any(container["id"] == 1 and container["fill_level"] == 95 for container in payload["containers"])

    monitor = client.get("/api/operations/monitor")
    assert monitor.status_code == 200
    monitor_payload = monitor.json()
    assert any(container["id"] == 1 for container in monitor_payload["containers"])
    assert any(container["id"] == 1 and container["fill_level"] >= 95 for container in monitor_payload["containers"])

    bootstrap_data = client.get("/api/bootstrap")
    assert bootstrap_data.status_code == 200
    assert any(container["id"] == 1 and container["fill_level"] == 95 for container in bootstrap_data.json()["containers"])


def test_password_reset_flow_uses_database_tokens(monkeypatch):
    calls: list[tuple[str, tuple]] = []

    def fake_execute(query: str, params: tuple = ()) -> dict | None:
        calls.append((query, params))
        if "from users where email = %s" in query:
            return {
                "id": 1,
                "name": "Administrador EcoCusco",
                "email": "admin@ecocusco.pe",
                "role": "admin",
                "zone": "Centro Historico",
                "password_hash": "$2b$12$8bI9mP5xQK4zbln0L7hmuO4kx2Q2dM2s1nS0H3x9qYdY/7eUVp7oG",
                "created_at": "2026-01-01T00:00:00+00:00",
            }
        if "insert into password_reset_tokens" in query:
            return {"id": 1, "email": params[0], "token": params[1], "expires_at": params[2]}
        if "select id, email, token" in query:
            return {"id": 1, "email": "admin@ecocusco.pe", "token": params[0], "expires_at": "2099-01-01T00:00:00+00:00"}
        if "delete from password_reset_tokens" in query:
            return {"id": 1}
        if "update users set password_hash" in query:
            return {"id": 1}
        return None

    monkeypatch.setattr("app.main.execute_one", fake_execute)

    client = TestClient(app)
    forgot_response = client.post("/api/auth/forgot-password", json={"email": "admin@ecocusco.pe"})
    assert forgot_response.status_code == 200
    token = forgot_response.json()["token"]
    assert token

    reset_response = client.post("/api/auth/reset-password", json={"token": token, "password": "newPassword123"})
    assert reset_response.status_code == 200

    assert any("insert into password_reset_tokens" in query for query, _ in calls)
    assert any("delete from password_reset_tokens" in query for query, _ in calls)


def test_admin_crud_endpoints_for_trucks_zones_schedules_and_maintenance():
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": "admin@ecocusco.pe", "password": "admin123"})
    assert login.status_code == 200
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    zone_response = client.post("/api/zones", json={"name": "Zona CRUD", "latitude": -13.52, "longitude": -71.97, "criticality": "Media"}, headers=headers)
    assert zone_response.status_code == 200
    zone = zone_response.json()
    assert zone["name"] == "Zona CRUD"

    truck_response = client.post("/api/trucks", json={"code": "C-CRUD", "driver": "Juan Perez", "status": "En ruta", "zone_id": zone["id"], "latitude": -13.52, "longitude": -71.97}, headers=headers)
    assert truck_response.status_code == 200
    truck = truck_response.json()
    assert truck["code"] == "C-CRUD"

    schedule_response = client.post("/api/schedules", json={"zone_id": zone["id"], "day": "Domingo", "time": "09:00", "waste": "Reciclable"}, headers=headers)
    assert schedule_response.status_code == 200
    schedule = schedule_response.json()
    assert schedule["zone_id"] == zone["id"]

    maintenance_response = client.post("/api/maintenance", json={"truck_id": truck["id"], "description": "Cambio de aceite", "status": "Pendiente"}, headers=headers)
    assert maintenance_response.status_code == 200
    maintenance = maintenance_response.json()
    assert maintenance["truck_id"] == truck["id"]

    patch_zone = client.patch(f"/api/zones/{zone['id']}", json={"criticality": "Alta"}, headers=headers)
    assert patch_zone.status_code == 200
    assert patch_zone.json()["criticality"] == "Alta"

    patch_truck = client.patch(f"/api/trucks/{truck['id']}", json={"status": "Mantenimiento"}, headers=headers)
    assert patch_truck.status_code == 200
    assert patch_truck.json()["status"] == "Mantenimiento"

    patch_schedule = client.patch(f"/api/schedules/{schedule['id']}", json={"day": "Lunes"}, headers=headers)
    assert patch_schedule.status_code == 200
    assert patch_schedule.json()["day"] == "Lunes"

    patch_maintenance = client.patch(f"/api/maintenance/{maintenance['id']}", json={"status": "Completado"}, headers=headers)
    assert patch_maintenance.status_code == 200
    assert patch_maintenance.json()["status"] == "Completado"

    delete_response = client.delete(f"/api/maintenance/{maintenance['id']}", headers=headers)
    assert delete_response.status_code == 200
    delete_schedule = client.delete(f"/api/schedules/{schedule['id']}", headers=headers)
    assert delete_schedule.status_code == 200
    delete_truck = client.delete(f"/api/trucks/{truck['id']}", headers=headers)
    assert delete_truck.status_code == 200
    delete_zone = client.delete(f"/api/zones/{zone['id']}", headers=headers)
    assert delete_zone.status_code == 200
