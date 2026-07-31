# EcoCusco - Gestión Ambiental Urbana

Sistema inteligente para la recolección de residuos sólidos segregados en la ciudad del Cusco. El proyecto integra un frontend React + TypeScript, una API principal en FastAPI y un servicio auxiliar TypeScript para alertas y geolocalización.

## Estado actual

- Interfaz funcional y responsiva para escritorio, tablet y móvil.
- Autenticación real con JWT, roles y administración de usuarios.
- Recuperación de contraseña con token persistente y limpieza segura.
- CRUD administrativo completo para zonas, horarios, camiones y mantenimiento.
- Filtros por estado, búsqueda por conductor y validaciones dinámicas en el panel administrativo.
- Monitoreo operativo con alertas, despacho, priorización de zonas y rutas críticas.
- Eventos operativos en vivo desde `/api/operations/monitor`.
- Endpoint `POST /api/operations/update` para registrar rutas y contenedores.
- Pruebas de frontend contra un backend FastAPI real y pruebas backend con pytest.
- Suite de frontend validada localmente con `npx vitest run`: `11 passed`.
- Documentación de despliegue y modo demo sin PostgreSQL.

## Arquitectura

```text
root/
  frontend/            # React + Vite
  backend-python/      # FastAPI REST API
  backend-typescript/  # Servicio geo/alertas
  database/            # Esquema y datos PostgreSQL
  scripts/             # Arranque y despliegue local
```

## Requisitos

- Node.js 18+ y npm 9+
- Python 3.9+
- PowerShell en Windows
- Docker Desktop opcional (para PostgreSQL local)

## Instalación

Desde la raíz del proyecto:

```powershell
npm --prefix frontend install
npm --prefix backend-typescript install
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend-python\requirements.txt
```

## Ejecución local

### Opción rápida

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
```

### Opción manual

#### Backend Python

```powershell
cd backend-python
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### Servicio Geo/Alertas

```powershell
cd backend-typescript
npm run dev
```

#### Frontend

```powershell
cd frontend
npm run dev
```

Abre `http://localhost:5173`.

## Base de datos

### Modo demo sin PostgreSQL

Si `DATABASE_URL` no está configurada, FastAPI utiliza datos en memoria para que la aplicación siga funcionando.

### Modo PostgreSQL opcional

```powershell
psql -U postgres -c "CREATE DATABASE sir_cusco;"
psql -U postgres -d sir_cusco -f database\schema.sql
psql -U postgres -d sir_cusco -f database\seed.sql
```

Configura la variable de entorno:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sir_cusco"
```

Reinicia el backend.

### PostgreSQL con Docker

```powershell
cd database
docker compose up -d
```

Verifica el contenedor:

```powershell
docker ps
```

## Pruebas

### Backend

```powershell
cd backend-python
.\.venv\Scripts\python.exe -m pytest -q
```

### Frontend

```powershell
cd frontend
npx vitest run
```

### Verificación completa

```powershell
npm run check:all
```

## Endpoints principales

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado general de la API |
| GET | `/api/bootstrap` | Datos iniciales para el frontend |
| POST | `/api/auth/login` | Inicio de sesión |
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/forgot-password` | Solicitar token de recuperación |
| POST | `/api/auth/reset-password` | Restablecer contraseña |
| GET | `/api/zones` | Listado de zonas |
| POST | `/api/zones` | Crear zona |
| PATCH | `/api/zones/{id}` | Actualizar zona |
| DELETE | `/api/zones/{id}` | Eliminar zona |
| GET | `/api/schedules` | Listado de horarios |
| POST | `/api/schedules` | Crear horario |
| PATCH | `/api/schedules/{id}` | Actualizar horario |
| DELETE | `/api/schedules/{id}` | Eliminar horario |
| GET | `/api/trucks` | Listado de camiones |
| POST | `/api/trucks` | Crear camión |
| PATCH | `/api/trucks/{id}` | Actualizar camión |
| DELETE | `/api/trucks/{id}` | Eliminar camión |
| GET | `/api/maintenance` | Historial de mantenimiento |
| POST | `/api/maintenance` | Crear mantenimiento |
| PATCH | `/api/maintenance/{id}` | Actualizar mantenimiento |
| DELETE | `/api/maintenance/{id}` | Eliminar mantenimiento |
| POST | `/api/reports` | Crear reporte ciudadano |
| PATCH | `/api/reports/{id}/resolve` | Marcar reporte resuelto |
| GET | `/api/operations/monitor` | Monitor operativo en vivo |
| POST | `/api/operations/update` | Registrar evento operativo |

## Uso del sistema

1. Inicia sesión o regístrate.
2. Revisa el panel principal y las métricas.
3. Consulta horarios y reportes.
4. Usa Administración para gestionar zonas, horarios, camiones y mantenimiento.
5. Registra eventos operativos para actualizar rutas o contenedores.

## Documentación adicional

- `docs/DESPLIEGUE.md` — Guía de despliegue y opciones cloud.
- `docs/entrega-2.md` — Informe de avance.
- `database/schema.sql` y `database/seed.sql` — Esquema y datos iniciales.
- `frontend/src/App.test.tsx` — Pruebas de integración real.

## Créditos

Proyecto desarrollado como MVP funcional para la gestión ambiental urbana en Cusco.
