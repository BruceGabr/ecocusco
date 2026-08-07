"""Pruebas del seguimiento en vivo y del aviso al móvil del ciudadano.

Lo que hay que sostener:

- Solo un conductor abre sesiones de ruta, y solo con su propio camión.
- Nadie emite posiciones en una sesión ajena.
- El aviso sale a dos cuadras, una sola vez, y vuelve a habilitarse cuando el
  camión se aleja de verdad.
- El ciudadano ve los camiones circulando; el resto de roles no puede fisgar
  recorridos que no le corresponden.

El envío push se sustituye por un doble: las pruebas no deben salir a la red.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.constants import PUSH_ALERT_RADIUS_M, PUSH_ALERT_RESET_M
from app.main import app
from app.memory_store import memory
from app.repositories.tracking import SESSION_ACTIVE, SESSION_FINISHED
from app.services import tracking as tracking_service


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_tracking_state():
    """Cada prueba arranca sin sesiones ni avisos de las anteriores."""
    memory.route_sessions.clear()
    memory.truck_positions.clear()
    memory.push_tokens.clear()
    memory.user_locations.clear()
    memory.proximity_notices.clear()
    yield
    memory.route_sessions.clear()
    memory.truck_positions.clear()
    memory.push_tokens.clear()
    memory.user_locations.clear()
    memory.proximity_notices.clear()


@pytest.fixture
def sent_push(monkeypatch):
    """Captura los mensajes en lugar de enviarlos al servicio de Expo."""
    captured: list[dict] = []

    def fake_send(messages):
        captured.extend(messages)
        return [{"status": "ok"} for _ in messages]

    monkeypatch.setattr(tracking_service, "send_push", fake_send)
    return captured


def _token(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _admin(client):
    return _token(client, "admin@ecocusco.pe", "admin123")


def _account(client, email, role, zone="Wanchaq", name=None):
    response = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {_admin(client)}"},
        json={
            "name": name or f"Usuario {role} {email}",
            "email": email,
            "password": "Password123",
            "role": role,
            "zone": zone,
        },
    )
    assert response.status_code in (200, 409), response.text
    return _token(client, email, "Password123")


def _driver(client, email="track.luis@ecocusco.pe"):
    """Conductor con el nombre del conductor de C-01, para que herede su camión."""
    return _account(client, email, "conductor", zone="Centro Historico", name="Luis Huaman")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# Centro Histórico, punto de partida del camión C-01.
BASE_LAT, BASE_LON = -13.5166, -71.9789

# Aproximadamente 100 m al norte: dentro de las dos cuadras.
NEAR_LAT, NEAR_LON = -13.5157, -71.9789

# Aproximadamente 1 km: fuera de cualquier umbral.
FAR_LAT, FAR_LON = -13.5256, -71.9789


# --- Apertura de sesión -----------------------------------------------------


def test_iniciar_ruta_exige_rol_conductor(client):
    token = _account(client, "track.ciudadano@ecocusco.pe", "ciudadano")
    response = client.post("/api/tracking/sessions", headers=_auth(token), json={})
    assert response.status_code == 403


def test_iniciar_ruta_sin_sesion_es_401(client):
    assert client.post("/api/tracking/sessions", json={}).status_code == 401


def test_el_conductor_inicia_ruta_con_su_camion(client):
    token = _driver(client)
    response = client.post(
        "/api/tracking/sessions",
        headers=_auth(token),
        json={"latitude": BASE_LAT, "longitude": BASE_LON},
    )
    assert response.status_code == 200, response.text
    session = response.json()
    assert session["status"] == SESSION_ACTIVE
    assert session["truck"] == "C-01"
    # El punto inicial se guarda ya, para que el ciudadano lo vea desde el
    # primer segundo.
    assert session["last_position"]["latitude"] == pytest.approx(BASE_LAT)


def test_el_camion_queda_marcado_en_ruta(client):
    token = _driver(client, "track.enruta@ecocusco.pe")
    client.post("/api/tracking/sessions", headers=_auth(token), json={})
    trucks = client.get("/api/trucks").json()
    c01 = next(truck for truck in trucks if truck["code"] == "C-01")
    assert c01["status"] == "En ruta"


def test_iniciar_dos_veces_devuelve_la_misma_sesion(client):
    """El conductor puede cerrar la app y volver: no debe partirse el recorrido."""
    token = _driver(client, "track.doble@ecocusco.pe")
    first = client.post("/api/tracking/sessions", headers=_auth(token), json={}).json()
    second = client.post("/api/tracking/sessions", headers=_auth(token), json={}).json()
    assert first["id"] == second["id"]


def test_no_se_puede_iniciar_con_el_camion_de_otro(client):
    token = _driver(client, "track.ajeno@ecocusco.pe")
    trucks = client.get("/api/trucks").json()
    otro = next(truck for truck in trucks if truck["code"] != "C-01")
    response = client.post(
        "/api/tracking/sessions",
        headers=_auth(token),
        json={"truck_id": otro["id"]},
    )
    assert response.status_code == 403


def test_conductor_sin_camion_asignado_recibe_un_mensaje_util(client):
    token = _account(client, "track.sincamion@ecocusco.pe", "conductor", name="Conductor Sin Camion")
    response = client.post("/api/tracking/sessions", headers=_auth(token), json={})
    assert response.status_code == 409
    assert "camión asignado" in response.json()["detail"]


def test_sessions_active_devuelve_la_sesion_abierta(client):
    token = _driver(client, "track.activa@ecocusco.pe")
    assert client.get("/api/tracking/sessions/active", headers=_auth(token)).json() is None
    created = client.post("/api/tracking/sessions", headers=_auth(token), json={}).json()
    restored = client.get("/api/tracking/sessions/active", headers=_auth(token)).json()
    assert restored["id"] == created["id"]


# --- Emisión de posiciones --------------------------------------------------


def test_emitir_posicion_en_sesion_ajena_es_403(client):
    dueno = _driver(client, "track.dueno@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(dueno), json={}).json()

    intruso = _account(client, "track.intruso@ecocusco.pe", "conductor", name="Otro Conductor")
    response = client.post(
        f"/api/tracking/sessions/{session['id']}/positions",
        headers=_auth(intruso),
        json={"latitude": BASE_LAT, "longitude": BASE_LON},
    )
    assert response.status_code == 403


def test_no_se_emiten_posiciones_en_una_sesion_finalizada(client):
    token = _driver(client, "track.cerrada@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(token), json={}).json()
    client.post(f"/api/tracking/sessions/{session['id']}/finish", headers=_auth(token))
    response = client.post(
        f"/api/tracking/sessions/{session['id']}/positions",
        headers=_auth(token),
        json={"latitude": BASE_LAT, "longitude": BASE_LON},
    )
    assert response.status_code == 409


def test_la_posicion_del_camion_se_sincroniza_con_su_ficha(client):
    token = _driver(client, "track.sync@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(token), json={}).json()
    client.post(
        f"/api/tracking/sessions/{session['id']}/positions",
        headers=_auth(token),
        json={"latitude": NEAR_LAT, "longitude": NEAR_LON},
    )
    trucks = client.get("/api/trucks").json()
    c01 = next(truck for truck in trucks if truck["code"] == "C-01")
    assert float(c01["latitude"]) == pytest.approx(NEAR_LAT, abs=1e-4)


def test_finalizar_ruta_cierra_la_sesion_y_libera_el_camion(client):
    token = _driver(client, "track.fin@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(token), json={}).json()
    finished = client.post(f"/api/tracking/sessions/{session['id']}/finish", headers=_auth(token)).json()
    assert finished["status"] == SESSION_FINISHED
    trucks = client.get("/api/trucks").json()
    c01 = next(truck for truck in trucks if truck["code"] == "C-01")
    assert c01["status"] != "En ruta"


# --- Aviso de proximidad ----------------------------------------------------


def _citizen_ready(client, email, latitude, longitude):
    """Ciudadano con token push registrado y ubicación conocida."""
    token = _account(client, email, "ciudadano")
    client.post("/api/tracking/push-token", headers=_auth(token), json={
        "token": f"ExponentPushToken[{email}]", "platform": "android",
    })
    client.post("/api/tracking/me/location", headers=_auth(token), json={
        "latitude": latitude, "longitude": longitude,
    })
    return token


def test_el_ciudadano_cercano_recibe_aviso(client, sent_push):
    _citizen_ready(client, "prox.cerca@ecocusco.pe", NEAR_LAT, NEAR_LON)
    driver = _driver(client, "track.avisa@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(driver), json={}).json()

    client.post(
        f"/api/tracking/sessions/{session['id']}/positions",
        headers=_auth(driver),
        json={"latitude": NEAR_LAT, "longitude": NEAR_LON},
    )

    assert len(sent_push) == 1
    assert "cerca" in sent_push[0]["title"].lower()
    assert sent_push[0]["data"]["type"] == "proximity"
    assert sent_push[0]["data"]["truck"] == "C-01"


def test_el_ciudadano_lejano_no_recibe_aviso(client, sent_push):
    _citizen_ready(client, "prox.lejos@ecocusco.pe", FAR_LAT, FAR_LON)
    driver = _driver(client, "track.nolejos@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(driver), json={}).json()

    client.post(
        f"/api/tracking/sessions/{session['id']}/positions",
        headers=_auth(driver),
        json={"latitude": BASE_LAT, "longitude": BASE_LON},
    )
    assert sent_push == []


def test_el_aviso_no_se_repite_en_cada_posicion(client, sent_push):
    """Sin esto el móvil recibiría una notificación cada pocos segundos."""
    _citizen_ready(client, "prox.unavez@ecocusco.pe", NEAR_LAT, NEAR_LON)
    driver = _driver(client, "track.unavez@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(driver), json={}).json()

    for _ in range(4):
        client.post(
            f"/api/tracking/sessions/{session['id']}/positions",
            headers=_auth(driver),
            json={"latitude": NEAR_LAT, "longitude": NEAR_LON},
        )

    assert len(sent_push) == 1


def test_el_aviso_vuelve_a_habilitarse_tras_alejarse(client, sent_push):
    """Segunda pasada por la misma calle: es una novedad, no un rebote."""
    _citizen_ready(client, "prox.segunda@ecocusco.pe", NEAR_LAT, NEAR_LON)
    driver = _driver(client, "track.segunda@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(driver), json={}).json()
    url = f"/api/tracking/sessions/{session['id']}/positions"

    client.post(url, headers=_auth(driver), json={"latitude": NEAR_LAT, "longitude": NEAR_LON})
    assert len(sent_push) == 1

    # Se aleja más allá del umbral de reinicio.
    client.post(url, headers=_auth(driver), json={"latitude": FAR_LAT, "longitude": FAR_LON})
    # Y vuelve.
    client.post(url, headers=_auth(driver), json={"latitude": NEAR_LAT, "longitude": NEAR_LON})

    assert len(sent_push) == 2


def test_el_umbral_de_reinicio_es_mayor_que_el_de_aviso():
    """La histéresis es lo que evita la ráfaga de notificaciones."""
    assert PUSH_ALERT_RESET_M > PUSH_ALERT_RADIUS_M


def test_solo_se_avisa_a_ciudadanos(client, sent_push):
    """Administradores y conductores no reciben el aviso de sacar la basura."""
    admin_user = _account(client, "prox.admin2@ecocusco.pe", "admin")
    client.post("/api/tracking/push-token", headers=_auth(admin_user), json={
        "token": "ExponentPushToken[admin2]", "platform": "android",
    })
    client.post("/api/tracking/me/location", headers=_auth(admin_user), json={
        "latitude": NEAR_LAT, "longitude": NEAR_LON,
    })

    driver = _driver(client, "track.solociud@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(driver), json={}).json()
    client.post(
        f"/api/tracking/sessions/{session['id']}/positions",
        headers=_auth(driver),
        json={"latitude": NEAR_LAT, "longitude": NEAR_LON},
    )
    assert sent_push == []


def test_sin_token_push_no_se_envia_nada_pero_no_falla(client, sent_push):
    token = _account(client, "prox.sintoken@ecocusco.pe", "ciudadano")
    client.post("/api/tracking/me/location", headers=_auth(token), json={
        "latitude": NEAR_LAT, "longitude": NEAR_LON,
    })
    driver = _driver(client, "track.sintoken@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(driver), json={}).json()
    response = client.post(
        f"/api/tracking/sessions/{session['id']}/positions",
        headers=_auth(driver),
        json={"latitude": NEAR_LAT, "longitude": NEAR_LON},
    )
    assert response.status_code == 200
    assert sent_push == []


def test_al_cerrar_sesion_se_retira_el_token(client):
    token = _account(client, "prox.logout@ecocusco.pe", "ciudadano")
    push = {"token": "ExponentPushToken[logout]", "platform": "android"}
    client.post("/api/tracking/push-token", headers=_auth(token), json=push)
    assert any(item["token"] == push["token"] for item in memory.push_tokens)
    client.request("DELETE", "/api/tracking/push-token", headers=_auth(token), json=push)
    assert not any(item["token"] == push["token"] for item in memory.push_tokens)


# --- Consulta en vivo y monitoreo -------------------------------------------


def test_el_ciudadano_ve_los_camiones_circulando(client):
    citizen = _citizen_ready(client, "live.ciudadano@ecocusco.pe", NEAR_LAT, NEAR_LON)
    driver = _driver(client, "track.live@ecocusco.pe")
    session = client.post(
        "/api/tracking/sessions", headers=_auth(driver),
        json={"latitude": NEAR_LAT, "longitude": NEAR_LON},
    ).json()

    payload = client.get("/api/tracking/live", headers=_auth(citizen)).json()
    assert payload["alert_radius_m"] == PUSH_ALERT_RADIUS_M
    codes = [truck["truck"] for truck in payload["trucks"]]
    assert "C-01" in codes
    # Con la ubicación conocida se adjunta la distancia, ya ordenada.
    assert payload["trucks"][0]["distance_m"] < 50

    client.post(f"/api/tracking/sessions/{session['id']}/finish", headers=_auth(driver))
    assert client.get("/api/tracking/live", headers=_auth(citizen)).json()["trucks"] == []


def test_un_ciudadano_no_puede_listar_el_historial_de_sesiones(client):
    token = _account(client, "monitor.ciudadano@ecocusco.pe", "ciudadano")
    assert client.get("/api/tracking/sessions", headers=_auth(token)).status_code == 403


def test_el_conductor_solo_ve_sus_propias_sesiones(client):
    uno = _driver(client, "track.mias@ecocusco.pe")
    client.post("/api/tracking/sessions", headers=_auth(uno), json={})
    sesiones = client.get("/api/tracking/sessions", headers=_auth(uno)).json()
    assert sesiones
    assert all(sesion["driver"] == "Luis Huaman" for sesion in sesiones)


def test_el_administrador_ve_el_recorrido_completo(client):
    driver = _driver(client, "track.recorrido@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(driver), json={}).json()
    url = f"/api/tracking/sessions/{session['id']}/positions"
    for offset in range(3):
        client.post(url, headers=_auth(driver), json={
            "latitude": BASE_LAT + offset * 0.001, "longitude": BASE_LON,
        })

    track = client.get(
        f"/api/tracking/sessions/{session['id']}/track",
        headers=_auth(_admin(client)),
    ).json()
    assert len(track["points"]) == 3
    # La distancia recorrida se acumula al registrar cada punto.
    assert track["session"]["distance_m"] > 0


def test_un_ciudadano_no_puede_ver_el_recorrido_de_un_conductor(client):
    driver = _driver(client, "track.privado@ecocusco.pe")
    session = client.post("/api/tracking/sessions", headers=_auth(driver), json={}).json()
    citizen = _account(client, "track.fisgon@ecocusco.pe", "ciudadano")
    response = client.get(
        f"/api/tracking/sessions/{session['id']}/track",
        headers=_auth(citizen),
    )
    assert response.status_code == 403
