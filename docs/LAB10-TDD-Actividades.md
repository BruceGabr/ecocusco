# Laboratorio 10: Implementacion de pruebas unitarias y TDD

**Curso:** Ingenieria de Software
**Proyecto:** EcoCusco - Sistema de Recoleccion de Residuos Solidos
**Backend:** FastAPI (Python)
**Herramienta de pruebas:** Pytest

---

## 1. Objetivo

Aplicar pruebas unitarias y fundamentos de TDD para validar funcionalidades basicas del sistema EcoCusco: inicio de sesion, registro de usuarios y consulta de horarios de recoleccion.

---

## 2. Fundamento teorico

### Testing
Las pruebas unitarias validan el comportamiento de componentes individuales del sistema de forma aislada. En este laboratorio se probaron los endpoints de la API REST utilizando `TestClient` de FastAPI.

### TDD (Test Driven Development)
Ciclo de desarrollo guiado por pruebas:

1. **Red (Crear prueba):** Se escribe una prueba que define el comportamiento esperado.
2. **Green (Implementar):** Se escribe el codigo minimo necesario para que la prueba pase.
3. **Refactor (Refactorizar):** Se mejora el codigo sin cambiar su comportamiento.

En este laboratorio, las pruebas se escribieron contra un backend ya implementado, validando que el sistema cumple con los requisitos esperados.

### Casos de prueba
Cada caso de prueba define:
- **Entrada:** Datos enviados al endpoint (JSON, parametros)
- **Salida esperada:** Codigo de estado HTTP y estructura de la respuesta
- **Assert:** Verificacion que determina si la prueba pasa o falla

### Assert
Instruccion que evalua una condicion booleana. Si es `True` la prueba continua; si es `False` la prueba falla inmediatamente.

---

## 3. Herramientas

| Herramienta | Version | Proposito |
|------------|---------|-----------|
| Python | 3.14.0 | Lenguaje de programacion |
| FastAPI | 0.141.1 | Framework web para la API |
| Uvicorn | 0.52.0 | Servidor ASGI |
| Pytest | 9.1.1 | Framework de pruebas unitarias |
| TestClient | - | Cliente HTTP para pruebas de FastAPI |
| PowerShell | - | Terminal de comandos |

---

## 4. Actividades

### 4.1 Introduccion a TDD

El ciclo TDD se aplico de la siguiente manera en el proyecto:

1. **Crear prueba:** Se escribio el archivo `backend-python/tests/test_lab10_activities.py` con 9 casos de prueba que definen el comportamiento esperado de login, registro y consulta de horarios.
2. **Fallar:** En un escenario TDD puro, las pruebas fallarian porque el codigo aun no existe. En este caso, el backend ya estaba implementado, por lo que las pruebas validaron el cumplimiento de los requisitos.
3. **Implementar:** El codigo de los endpoints ya estaba implementado en `backend-python/app/main.py`:
   - `POST /api/auth/login` (linea 1070)
   - `POST /api/auth/register` (linea 1060)
   - `GET /api/schedules` (linea 1169)
4. **Refactorizar:** Se agregaron casos borde adicionales (email invalido, campos faltantes, credenciales incorrectas) para cubrir mas escenarios.

### 4.2 Pruebas creadas

Archivo: `backend-python/tests/test_lab10_activities.py`

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from fastapi.testclient import TestClient


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


def test_login_invalid_credentials():
    client = TestClient(app)
    response = client.post("/api/auth/login", json={
        "email": "admin@ecocusco.pe",
        "password": "wrongpassword",
    })
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


def test_login_invalid_email_format():
    client = TestClient(app)
    response = client.post("/api/auth/login", json={
        "email": "not-an-email",
        "password": "admin123",
    })
    assert response.status_code == 422


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


def test_register_duplicate_email():
    client = TestClient(app)
    response = client.post("/api/auth/register", json={
        "name": "Admin Duplicate",
        "email": "admin@ecocusco.pe",
        "password": "admin123",
    })
    assert response.status_code == 409
    assert "registrado" in response.json()["detail"].lower()


def test_register_missing_fields():
    client = TestClient(app)
    response = client.post("/api/auth/register", json={
        "name": "No Password",
        "email": "nopass@test.pe",
    })
    assert response.status_code == 422


def test_get_schedules_returns_list():
    client = TestClient(app)
    response = client.get("/api/schedules")
    assert response.status_code == 200
    schedules = response.json()
    assert isinstance(schedules, list)
    assert len(schedules) > 0


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


def test_get_schedules_filter_by_zone():
    client = TestClient(app)
    response = client.get("/api/schedules")
    schedules = response.json()
    centro = [s for s in schedules if s.get("zone_name") == "Centro Historico" or s.get("zone_id") == 1]
    assert len(centro) > 0
```

### 4.3 Tabla de casos de prueba

| # | Test | Descripcion | Entrada | Salida esperada | Resultado |
|---|------|-------------|---------|-----------------|-----------|
| 1 | `test_login_valid_credentials` | Login con credenciales correctas | `email: admin@ecocusco.pe, password: admin123` | HTTP 200, token JWT, rol admin | Passed |
| 2 | `test_login_invalid_credentials` | Login con contrasena incorrecta | `email: admin@ecocusco.pe, password: wrongpassword` | HTTP 401, mensaje de error | Passed |
| 3 | `test_login_invalid_email_format` | Login con formato de email invalido | `email: not-an-email, password: admin123` | HTTP 422 (error de validacion) | Passed |
| 4 | `test_register_new_user` | Registro de usuario nuevo | `name: Lab10 User, email: lab10@test.pe, password: testpass123, role: ciudadano, zone: Wanchaq` | HTTP 200, token JWT, usuario creado | Passed |
| 5 | `test_register_duplicate_email` | Registro con email ya existente | `name: Admin Duplicate, email: admin@ecocusco.pe, password: admin123` | HTTP 409, email ya registrado | Passed |
| 6 | `test_register_missing_fields` | Registro con campos obligatorios faltantes | `name: No Password, email: nopass@test.pe` (sin password) | HTTP 422 (error de validacion) | Passed |
| 7 | `test_get_schedules_returns_list` | Consultar lista de horarios | GET `/api/schedules` | HTTP 200, lista no vacia de horarios | Passed |
| 8 | `test_get_schedules_structure` | Verificar estructura de datos de horarios | GET `/api/schedules` | Cada horario tiene: id, zone_id, day, time, waste | Passed |
| 9 | `test_get_schedules_filter_by_zone` | Filtrar horarios por zona | GET `/api/schedules` | La zona "Centro Historico" tiene horarios asignados | Passed |

### 4.4 Ejecucion de pruebas

#### Resultado de las pruebas del Lab 10

```
======================================== test session starts ========================================
platform win32 -- Python 3.14.0, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\USER\Sistema-de-Recoleccion-de-Residuos-Solidos
collected 9 items

backend-python/tests/test_lab10_activities.py::test_login_valid_credentials PASSED [ 11%]
backend-python/tests/test_lab10_activities.py::test_login_invalid_credentials PASSED [ 22%]
backend-python/tests/test_lab10_activities.py::test_login_invalid_email_format PASSED [ 33%]
backend-python/tests/test_lab10_activities.py::test_register_new_user PASSED [ 44%]
backend-python/tests/test_lab10_activities.py::test_register_duplicate_email PASSED [ 55%]
backend-python/tests/test_lab10_activities.py::test_register_missing_fields PASSED [ 66%]
backend-python/tests/test_lab10_activities.py::test_get_schedules_returns_list PASSED [ 77%]
backend-python/tests/test_lab10_activities.py::test_get_schedules_structure PASSED [ 88%]
backend-python/tests/test_lab10_activities.py::test_get_schedules_filter_by_zone PASSED [100%]

======================================== 9 passed in 1.50s =========================================
```

#### Resultado de toda la suite de pruebas del proyecto (25 pruebas)

```
======================================== test session starts ========================================
platform win32 -- Python 3.14.0, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\USER\Sistema-de-Recoleccion-de-Residuos-Solidos
collected 25 items

backend-python/tests/test_lab10_activities.py::test_login_valid_credentials PASSED [  4%]
backend-python/tests/test_lab10_activities.py::test_login_invalid_credentials PASSED [  8%]
backend-python/tests/test_lab10_activities.py::test_login_invalid_email_format PASSED [ 12%]
backend-python/tests/test_lab10_activities.py::test_register_new_user PASSED [ 16%]
backend-python/tests/test_lab10_activities.py::test_register_duplicate_email PASSED [ 20%]
backend-python/tests/test_lab10_activities.py::test_register_missing_fields PASSED [ 24%]
backend-python/tests/test_lab10_activities.py::test_get_schedules_returns_list PASSED [ 28%]
backend-python/tests/test_lab10_activities.py::test_get_schedules_structure PASSED [ 32%]
backend-python/tests/test_lab10_activities.py::test_get_schedules_filter_by_zone PASSED [ 36%]
backend-python/tests/test_operational_logic.py::test_health_endpoint_reports_ok PASSED [ 40%]
backend-python/tests/test_operational_logic.py::test_build_alerts_detects_full_containers_and_delays PASSED [ 44%]
backend-python/tests/test_operational_logic.py::test_simulate_truck_positions_changes_coordinates PASSED [ 48%]
backend-python/tests/test_operational_logic.py::test_update_operation_route_event_requires_auth_and_updates_monitor PASSED [ 52%]
backend-python/tests/test_operational_logic.py::test_update_operation_container_event_requires_auth_and_updates_monitor PASSED [ 56%]
backend-python/tests/test_operational_logic.py::test_e2e_route_update_persists_to_routes_and_monitor PASSED [ 60%]
backend-python/tests/test_operational_logic.py::test_e2e_container_update_persists_to_containers_and_monitor PASSED [ 64%]
backend-python/tests/test_operational_logic.py::test_password_reset_flow_uses_database_tokens PASSED [ 68%]
backend-python/tests/test_operational_logic.py::test_admin_crud_endpoints_for_trucks_zones_schedules_and_maintenance PASSED [ 72%]
backend-python/tests/test_routing_logic.py::test_prioritize_zones_ranks_critical_areas PASSED [ 76%]
backend-python/tests/test_routing_logic.py::test_optimize_routes_orders_by_priority_and_delay PASSED [ 80%]
backend-python/tests/test_routing_logic.py::test_build_intervention_plan_creates_actionable_steps PASSED [ 84%]
backend-python/tests/test_routing_logic.py::test_build_performance_metrics_computes_operational_status PASSED [ 88%]
backend-python/tests/test_routing_logic.py::test_simulate_route_progress_advances_routes PASSED [ 92%]
backend-python/tests/test_routing_logic.py::test_simulate_container_fill_increases_fill_level PASSED [ 96%]
backend-python/tests/test_security.py::test_password_hashing_and_verification PASSED [100%]

======================================== 25 passed in 3.44s =========================================
```

### 4.5 Interpretacion de resultados

- **Passed (25/25):** Todas las pruebas pasaron correctamente. Esto indica que:
  - El endpoint de login valida credenciales correctas (200) e incorrectas (401)
  - El endpoint de login rechaza formatos de email invalidos (422)
  - El endpoint de registro crea usuarios nuevos correctamente (200)
  - El endpoint de registro rechaza emails duplicados (409)
  - El endpoint de registro valida campos obligatorios (422)
  - El endpoint de horarios devuelve datos estructurados correctamente (200)
- **Failed (0/25):** Ninguna prueba fallo. El sistema cumple con todos los requisitos validados.

---

## 5. Trabajo extra: Pruebas adicionales

Ademas de los 3 casos base solicitados (login, registro, horarios), se agregaron las siguientes pruebas para cubrir casos borde y mejorar la cobertura:

| Prueba extra | Descripcion |
|-------------|-------------|
| `test_login_invalid_email_format` | Verifica que el endpoint rechace emails con formato incorrecto devolviendo HTTP 422 |
| `test_register_missing_fields` | Verifica que el endpoint rechace registros sin campos obligatorios devolviendo HTTP 422 |
| `test_get_schedules_structure` | Verifica que cada horario tenga la estructura de datos correcta (id, zone_id, day, time, waste) |
| `test_get_schedules_filter_by_zone` | Verifica que la zona "Centro Historico" tenga horarios asignados en el sistema |

Estas pruebas adicionales demuestran una cobertura mas completa de los escenarios de uso del sistema.

---

## 6. Guia de capturas para el informe

A continuacion se detallan las capturas que debes tomar y los comandos exactos para generarlas:

### Captura 1: Health check del backend
**Donde:** Terminal PowerShell (cualquiera)
**Comando:**
```powershell
Invoke-RestMethod http://localhost:8000/api/health | ConvertTo-Json
```
**Resultado esperado:**
```json
{
    "status": "ok",
    "database": "memory",
    "version": "1.0.0",
    "mode": "demo"
}
```

### Captura 2: Ejecucion de las 9 pruebas del Lab 10
**Donde:** Terminal PowerShell en la raiz del proyecto (`C:\Users\USER\Sistema-de-Recoleccion-de-Residuos-Solidos`)
**Comando:**
```powershell
.\.venv\Scripts\python.exe -m pytest backend-python\tests\test_lab10_activities.py -v
```
**Resultado esperado:** 9 pruebas en verde con "PASSED"

### Captura 3: Ejecucion de toda la suite (25 pruebas)
**Donde:** Terminal PowerShell en la raiz del proyecto
**Comando:**
```powershell
.\.venv\Scripts\python.exe -m pytest backend-python\tests -v
```
**Resultado esperado:** 25 pruebas en verde con "PASSED"

### Captura 4: Listado del archivo de pruebas
**Donde:** Terminal PowerShell en la raiz del proyecto
**Comando:**
```powershell
Get-Content backend-python\tests\test_lab10_activities.py
```
**Resultado esperado:** El contenido completo del archivo de pruebas

### Captura 5: Login exitoso desde la API (opcional,via navegador)
**Donde:** Navegador web
**URL:** `http://localhost:8000/docs`
**Accion:** Abrir Swagger UI, desplegar el endpoint `POST /api/auth/login`, hacer clic en "Try it out", ingresar:
```json
{
  "email": "admin@ecocusco.pe",
  "password": "admin123"
}
```
Hacer clic en "Execute" y capturar la respuesta HTTP 200 con el token JWT.

---

## 7. Conclusiones

1. Se implementaron 9 pruebas unitarias que validan las funcionalidades basicas del sistema EcoCusco: inicio de sesion, registro de usuarios y consulta de horarios.
2. El sistema maneja correctamente tanto casos de exito como casos de error (credenciales invalidas, emails duplicados, campos faltantes).
3. El ciclo TDD (Red-Green-Refactor) permitio estructurar las pruebas de manera ordenada, definiendo primero el comportamiento esperado y luego verificando que el codigo lo cumple.
4. Pytest, combinado con FastAPI TestClient, demostro ser una herramienta eficaz para automatizar pruebas de endpoints REST.
5. La suite completa del proyecto alcanza 25 pruebas unitarias, todas pasando exitosamente, lo que demuestra la madurez y confiabilidad del sistema.

---

## Anexo: Comando para verificar que el backend esta activo

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Si el backend no esta corriendo, iniciarlo con:
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir backend-python --host 0.0.0.0 --port 8000
```
