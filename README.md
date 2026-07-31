# EcoCusco - Gestion Ambiental Urbana

Sistema inteligente para la recoleccion de residuos solidos segregados en la ciudad del Cusco. El proyecto integra un frontend React, una API principal en FastAPI y un microservicio TypeScript para alertas/geolocalizacion.

## Version actual

- **Version:** `2.0.0-deploy-config`
- **Rama:** `v2.0.0-deploy-config`
- **Repositorio:** `Alejandro225425/Sistema-de-Recoleccion-de-Residuos-Solidos`
- **Estado:** Configuracion de despliegue lista. Pendiente ejecutar despliegue en produccion.

## Estado

- Plataforma funcional en modo demo y con autenticación real.
- Interfaz responsive para computadora, tablet y celular.
- API preparada para trabajar con PostgreSQL mediante `DATABASE_URL` y con modo memoria si no hay base de datos.
- Mapa operativo con Leaflet/OpenStreetMap.
- Bloque de seguridad implementado: registro, login seguro, JWT, roles, recuperación de contraseña y administración de usuarios por rol.
- Gestión operativa integrada con CRUD completo de zonas, horarios, camiones y mantenimiento expuesto en la API y en el panel administrativo del frontend.
- Filtros administrativos avanzados, incluyendo búsqueda por conductor en el listado de camiones y dentro de los reportes en administración.
- Módulo operativo con alertas automáticas, monitoreo de contenedores, mantenimiento y notificaciones.
- Registro de recolecciones por conductor y confirmación de recolección por ciudadano: endpoints API y formularios en la UI para registro y verificación de recolectas.
- Gestión de incidentes activa para operadores y administradores desde la vista de reportes.
- Gestión de incidentes activa para operadores y administradores, con resolución de reportes desde la vista de reportes.
- Módulo de priorización de zonas críticas y optimización de rutas para apoyar decisiones operativas.
- Plan de intervención automático para guiar la acción operativa hacia la zona y ruta más urgentes.
- Tablero de despacho integrado en el dashboard para secuencias horarias y simulación de intervención en tiempo real.
- Conexión del tablero operativo a datos reales del backend mediante `/api/operations/monitor`.
- Endpoint operativo `POST /api/operations/update` para registrar eventos de ruta y contenedor y refrescar el monitor en vivo.
- Corregido el flujo de actualización de contenedores para que el backend devuelva el nivel de llenado almacenado y genere notificaciones operativas.
- Dependencias de pruebas actualizadas: `backend-python/requirements.txt` incluye `httpx2` para que `fastapi.testclient` funcione correctamente.
- Seguridad reforzada con un valor por defecto de `JWT_SECRET` más robusto y recomendación de usar una variable de entorno segura en producción.
- Validación completa: build del frontend verificado localmente con `npm run build`, pruebas de backend con `16 passed` y pruebas de frontend con `11 passed` en la suite de integración real del panel administrativo.
- Accesibilidad mejorada en el panel administrativo: contraste WCAG AA, navegación por teclado con skip-link y focus-visible, touch targets mínimos de 44px y prevención de scroll horizontal en móvil.
- Configuración de despliegue lista para producción: `render.yaml`, `railway.toml`, `vercel.json` y variables de entorno documentadas. Ruta recomendada: Render + Vercel (Web Services manuales gratuitos sin tarjeta de crédito). Solo falta ejecutar el despliegue siguiendo el checklist de `docs/DESPLIEGUE.md`.

## Progreso implementado hasta ahora

### 1. Seguridad y gestión de usuarios
- Registro real con contraseña protegida con bcrypt.
- Login con verificación de credenciales y emisión de JWT.
- Protección de endpoints por rol: `ciudadano`, `operador`, `admin` y `conductor`.
- Recuperación de contraseña con flujo completo (solicitud de token y restablecimiento desde la interfaz) y persistencia de tokens con soporte para PostgreSQL.
- Panel de administración de usuarios con listado de usuarios, creación de cuentas y cambio de roles desde el frontend, protegido para administradores.
- Panel de administración operativa con formularios de creación, edición, eliminación y listado para zonas, horarios, camiones y mantenimiento, con filtros y ayudas contextuales para mejorar la experiencia, incluyendo búsqueda por conductor y filtros de reporte por estado y zona.
- Base de datos ampliada para usuarios, reseteos, mantenimiento, contenedores y notificaciones.
- Documentación de respaldo y restauración de PostgreSQL para facilitar el despliegue y la recuperación operativa.

### 2. Operaciones y monitoreo urbano
- Panel operativo con alertas automáticas por rutas retrasadas y contenedores casi llenos.
- Seguimiento de mantenimiento de camiones y estado de equipos.
- Visualización de notificaciones, reportes ciudadanos y métricas operativas.
- Integración del frontend con el backend para mostrar información en tiempo real del estado del sistema.

### 3. Priorización inteligente de zonas
- Se implementó un modelo de scoring para priorizar zonas críticas según:
  - número de reportes abiertos,
  - nivel de llenado de contenedores,
  - criticidad de la zona,
  - urgencia operativa asociada a rutas.
- Se añadió una lógica simple de optimización de rutas que ordena las rutas más urgentes para asignación operativa.

### 4. Experiencia de usuario
- Interfaz React con navegación por paneles: dashboard, horarios, reportes, rutas, administración y estadísticas.
- Modo claro/oscuro y diseño responsivo.
- Exportación de listados a CSV desde vistas con tablas o listados relevantes.
- Expansion del panel de estadísticas con métricas operativas, estado de reportes y resumen de recolectas.

### 5. Despacho operativo y simulación
- Tablero de despacho integrado en el dashboard para mostrar órdenes de intervención y camiones asignados.
- Secuencia de prioridades por hora, basada en zonas y rutas priorizadas.
- Simulación simple de intervención en tiempo real con estados que cambian automáticamente y permiten visualizar la acción operativa.
- Conexión en vivo del dashboard con el endpoint `/api/operations/monitor` para usar datos reales de prioridades, asignaciones, alertas y plan de intervención.
- Sincronización del tablero de despacho con asignaciones reales de camiones y telemetría de rutas desde el monitor.
- Simulación operativa dinámica de rutas y contenedores en el backend para generar telemetría con progreso y niveles de llenado.
- Métricas de desempeño agregadas al monitor: rutas retrasadas, progreso promedio, porcentaje de cumplimiento y llenado de contenedores.

### 6. Verificación y validación
- Pruebas automatizadas del backend para seguridad, operaciones y priorización de rutas.
- Compilación correcta del frontend React y del microservicio TypeScript.
- Ejecución local verificada del backend, el servicio geo/alertas y la interfaz web.
- Pruebas end-to-end de API para validar el flujo completo de actualización de operaciones.

## Pruebas end-to-end de API
El backend ahora incluye pruebas de flujo en `backend-python/tests/test_operational_logic.py` que validan:
- Autenticación JWT para el usuario administrador.
- Actualización de rutas y contenedores mediante `POST /api/operations/update`.
- Refresco inmediato del monitor operativo con `GET /api/operations/monitor`.
- Persistencia de los cambios reflejada también en `/api/routes` y `/api/bootstrap`.

Para ejecutar las pruebas:

```powershell
cd backend-python
.\.venv\Scripts\python.exe -m pytest -q
```

## Pruebas de UI del frontend
El frontend ahora incluye pruebas de integración que validan:
- Renderizado del formulario de eventos operativos en `frontend/src/Operations.test.tsx`.
- Cambio de tipo a `container_update` y `route_update`.
- Envío correcto del payload de actualización de contenedor.
- Envío correcto del payload de actualización de ruta.
- Flujo UI → backend simulado usando el manejador `onOperationUpdate`.
- Integración completa de la aplicación en `frontend/src/App.test.tsx`, ejecutando el frontend contra un backend FastAPI local real y validando login, carga de datos de `/api/bootstrap`, carga del monitor y envío de `POST /api/operations/update` para `route_update` y `container_update`.

Para ejecutar las pruebas de frontend:

```powershell
cd frontend
npx vitest run
```

## Build de producción del frontend
Después de validar las pruebas, la aplicación puede compilarse en modo producción:

```powershell
cd frontend
npm run build
```

El build actual se verificó con éxito y genera los archivos en `frontend/dist`.

## Validación de backend
El backend se validó con `pytest` y se confirmaron todas las pruebas del API:

```powershell
cd backend-python
.\.venv\Scripts\python.exe -m pytest -q
```

## Funcionalidades pendientes
- Continuar con mejoras de experiencia avanzada en la administración, como filtros adicionales por estado, búsquedas por conductor y validaciones dinámicas por entidad.
- Gestión de incidencias desde la vista de operador.
- Ampliar analytics y reportes en la interfaz.
- Notificación de cambio de horario y alertas de proximidad en el servicio geo.
- ~~Validar backup/restore de PostgreSQL usando los scripts incluidos~~ Completado el 2026-07-30.
- ~~Validación de accesibilidad y experiencia móvil~~ Completado el 2026-07-30.
- Despliegue en producción con variables de entorno seguras para `JWT_SECRET` y `DATABASE_URL` (configuración de plataformas lista; pendiente ejecutar despliegue y ajustar CORS).

## Arquitectura

```text
backend-python/
  app/main.py              API REST principal con FastAPI
  requirements.txt         Dependencias Python

backend-typescript/
  src/server.ts            Servicio auxiliar de alertas y ETA

frontend/
  src/main.tsx             Aplicacion React
  src/styles.css           Estilos responsive EcoCusco
  vite.config.ts           Proxy local hacia API y servicio geo

database/
  schema.sql               Esquema PostgreSQL principal
  seed.sql                 Datos iniciales
  docker-compose.yml       PostgreSQL local opcional

scripts/
  start-all.ps1            Inicio de los tres servicios
```

## Requisitos

- Python 3.9 o superior
- Node.js 18 o superior
- npm 9 o superior
- PowerShell en Windows
- Docker Desktop opcional, solo si se usara PostgreSQL en contenedor

Puertos usados por defecto:

| Servicio | Puerto | URL |
| --- | ---: | --- |
| Frontend Vite | 5173 | `http://localhost:5173` |
| API FastAPI | 8000 | `http://localhost:8000` |
| Geo/Alertas TS | 3100 | `http://localhost:3100` |

## Instalacion

Desde la raiz del proyecto:

```powershell
npm --prefix frontend install
npm --prefix backend-typescript install
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend-python\requirements.txt
```

## Ejecucion

Opcion rapida:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
```

Validacion de la instalación y pruebas de todo el proyecto:

```powershell
npm run check:all
```

## Health check
El backend incluye un endpoint de salud en `/api/health` para verificar que el servicio esté disponible:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Devuelve un JSON con los campos `status`, `database`, `version` y `mode`.

Opcion manual, en tres terminales:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir backend-python --host 0.0.0.0 --port 8000
```

```powershell
npm --prefix backend-typescript run dev
```

```powershell
npm --prefix frontend run dev
```

Luego abre `http://localhost:5173`.

## Modo Demo

El sistema funciona sin PostgreSQL. Si no existe `DATABASE_URL` o la base de datos no esta disponible, FastAPI responde con datos en memoria para poder probar login, horarios, rutas, reportes, mapa y estadisticas.

Para iniciar sesión en modo demo:

- Usuario administrador: `admin@ecocusco.pe` / `admin123`
- También puedes registrarte con un nuevo correo y contraseña desde la pantalla de autenticación.

## Seguridad implementada

El bloque inicial de seguridad quedó habilitado con:

- Registro real con contraseña protegida con bcrypt.
- Login con verificación de credenciales y JWT.
- Protección de endpoints por rol (`ciudadano`, `operador`, `admin`, `conductor`).
- Recuperación de contraseña con token temporal.
- Esquema ampliado para usuarios, reset de contraseñas, mantenimiento, contenedores y notificaciones.

## PostgreSQL Opcional

Si necesitas persistencia real:

```powershell
psql -U postgres -c "CREATE DATABASE sir_cusco;"
psql -U postgres -d sir_cusco -f database\schema.sql
psql -U postgres -d sir_cusco -f database\seed.sql
```

Configura la variable:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sir_cusco"
```

Reinicia el backend despues de configurar la variable.

## PostgreSQL con Docker

El proyecto incluye `database/docker-compose.yml` para levantar PostgreSQL local sin instalarlo manualmente.

Primero verifica que Docker este instalado:

```powershell
docker --version
docker compose version
```

Luego confirma que Docker Desktop este encendido:

```powershell
docker info
```

Si el comando muestra una seccion `Server`, Docker esta funcionando. Si aparece un error con `dockerDesktopLinuxEngine`, abre Docker Desktop y espera a que termine de iniciar.

Para iniciar PostgreSQL:

```powershell
cd database
docker compose up -d
```

El contenedor crea automaticamente la base `sir_cusco` y carga `schema.sql` y `seed.sql` en el primer arranque. Los datos quedan guardados en el volumen Docker `sir_cusco_data`.

Verifica que el contenedor este activo:

```powershell
docker ps
```

Debe aparecer un contenedor llamado `sir_cusco_postgres`.

Configura FastAPI para usar la base de datos. Ejecuta esto en la misma terminal donde levantaras el backend:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sir_cusco"
```

Si estas dentro de `database`, vuelve a la raiz del proyecto antes de iniciar FastAPI:

```powershell
cd ..
python -m uvicorn app.main:app --reload --app-dir backend-python --host 0.0.0.0 --port 8000
```

Si no tienes el entorno virtual activado, usa la ruta explicita desde la raiz:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir backend-python --host 0.0.0.0 --port 8000
```

Para comprobar que la API usa PostgreSQL, abre:

```text
http://localhost:8000/api/health
```

La respuesta debe indicar:

```json
{
  "database": "postgresql",
  "mode": "production"
}
```

### Backup y restauración de PostgreSQL

Si usas PostgreSQL local, es recomendable generar respaldos regulares.

> Antes de ejecutar backup/restore, asegúrate de que PostgreSQL esté en ejecución.
> Si usas Docker, ejecuta:
>
> ```powershell
> cd database
> docker compose up -d
> ```
>
> Si usas PostgreSQL local, confirma que el servicio está en marcha y acepta conexiones en el puerto `5432`.
>
> Para validar el estado de Docker:
>
> ```powershell
> docker ps
> ```
>
> Si `docker ps` falla con "cannot connect to the docker API", inicia Docker Desktop o el servicio de Docker antes de continuar.
>
> Si el contenedor PostgreSQL se detiene al iniciar, revisa los logs con:
>
> ```powershell
> cd database
> docker compose logs --no-color --tail 50
> ```
>
> Un fallo común es un orden incorrecto en `database/seed.sql`; el usuario debe existir antes de crear notificaciones.

#### Respaldar la base de datos

Con PostgreSQL instalado localmente:

```powershell
pg_dump -U postgres -Fc -d sir_cusco -f database\backup\sir_cusco-$(Get-Date -Format yyyyMMddHHmmss).dump
```

Con Docker (desde la raíz del proyecto):

```powershell
docker exec -i sir_cusco_postgres pg_dump -U postgres -Fc -d sir_cusco -f /tmp/sir_cusco.dump
docker cp sir_cusco_postgres:/tmp/sir_cusco.dump database\backup\sir_cusco.dump
```

> Alternativa: usa el script de respaldo incluido:
>
> ```powershell
> .\scripts\db-backup.ps1
> .\scripts\db-backup.ps1 -UseDocker
> ```
>
> El respaldo se guarda en `database/backup/`.
>
> Si PostgreSQL pide contraseña, define `PGPASSWORD` antes de ejecutar el script:
>
> ```powershell
> $env:PGPASSWORD = 'postgres'
> .\scripts\db-backup.ps1
> ```
>
> Para Docker también funciona con `PGPASSWORD`:
>
> ```powershell
> $env:PGPASSWORD = 'postgres'
> .\scripts\db-backup.ps1 -UseDocker
> ```

#### Restaurar desde respaldo

Detén el backend antes de restaurar y asegúrate de que `DATABASE_URL` apunte a la base correcta.

Con PostgreSQL local:

```powershell
psql -U postgres -c "DROP DATABASE IF EXISTS sir_cusco;"
psql -U postgres -c "CREATE DATABASE sir_cusco;"
pg_restore -U postgres -d sir_cusco database\backup\sir_cusco.dump
```

Con Docker:

```powershell
docker cp database\backup\sir_cusco.dump sir_cusco_postgres:/tmp/sir_cusco.dump
docker exec -i sir_cusco_postgres pg_restore --clean --if-exists -U postgres -d sir_cusco /tmp/sir_cusco.dump
```

> Alternativa: usa el script de restauración incluido:
>
> ```powershell
> .\scripts\db-restore.ps1 -File database\backup\sir_cusco.dump -UseDocker
> ```
>
> En PowerShell, define la contraseña así:
>
> ```powershell
> $env:PGPASSWORD = 'postgres'
> .\scripts\db-restore.ps1 -File database\backup\sir_cusco.dump -UseDocker
> ```

Si necesitas recuperar el esquema y los datos iniciales desde los archivos del proyecto:

```powershell
psql -U postgres -d sir_cusco -f database\schema.sql
psql -U postgres -d sir_cusco -f database\seed.sql
```

#### Scripts de backup/restore

El proyecto incluye scripts de PowerShell para simplificar el respaldo y la restauración.

```powershell
.\scripts\db-backup.ps1
.\scripts\db-backup.ps1 -UseDocker
.\scripts\db-restore.ps1 -File database\backup\sir_cusco.dump
.\scripts\db-restore.ps1 -File database\backup\sir_cusco.dump -UseDocker
```

Nota: `0.0.0.0` se usa para que FastAPI escuche conexiones, pero en el navegador se debe abrir `localhost` o `127.0.0.1`.

Para volver al modo demo en memoria:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

Luego reinicia FastAPI.

## Endpoints Principales

API FastAPI:

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/health` | Estado de la API y modo de base de datos |
| GET | `/api/bootstrap` | Datos iniciales para el frontend |
| POST | `/api/auth/login` | Login/registro demo por rol |
| GET | `/api/zones` | Zonas de recoleccion |
| GET | `/api/schedules` | Horarios |
| GET | `/api/trucks` | Camiones |
| GET | `/api/routes` | Rutas activas |
| GET | `/api/reports` | Reportes ciudadanos |
| POST | `/api/reports` | Crear reporte |
| PATCH | `/api/reports/{id}/resolve` | Resolver reporte |
| GET | `/api/collections` | Historial de recolecciones |
| GET | `/api/analytics/summary` | Resumen estadistico |
| GET | `/api/alerts` | Alertas automáticas por ruta y contenedores |
| GET | `/api/operations/monitor` | Estado operativo con mantenimiento, contenedores, notificaciones, rutas priorizadas y plan de despacho |
| POST | `/api/operations/update` | Registrar eventos operativos (ruta/contenedor) y refrescar datos del monitor |

Servicio Geo/Alertas:

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/health` | Estado del servicio |
| GET | `/truck-locations` | Ubicaciones simuladas |
| GET | `/alerts` | Alertas de ETA |
| GET | `/eta?truck=C-01` | ETA por camion |

## Funcionalidades

- Autenticación real con múltiples roles.
- Consulta de horarios por zona.
- Registro y seguimiento de incidencias ciudadanas.
- Resolución de incidencias desde administración y operaciones.
- Mapa operativo con zonas, camiones y rutas.
- Panel de métricas y estadísticas.
- Guía de clasificación de residuos.
- Exportación CSV en vistas con listados.
- Tema claro/oscuro.
- Diseño responsive para escritorio y celular.
- Priorización automática de zonas críticas y sugerencia de rutas.
- Evento operativo vivo para actualizar rutas y contenedores desde la interfaz de operaciones.

## Verificacion

```powershell
npm --prefix frontend run build
npm --prefix backend-typescript run build
.\.venv\Scripts\python.exe -m py_compile backend-python\app\main.py
```

Tambien puedes ejecutar:

```powershell
python verify_system.py
```

## Pruebas Manuales Recomendadas

1. Abrir `http://localhost:5173`.
2. Iniciar sesion con un correo valido.
3. Revisar el panel principal y confirmar que el mapa carga.
4. Ir a Horarios y probar busqueda/filtros.
5. Ir a Reportes, registrar una incidencia y confirmar que aparece en seguimiento.
6. Ir a Administracion y marcar una incidencia como resuelta.
7. Probar la vista en ancho movil, por ejemplo 390 px, y confirmar que no haya scroll horizontal.

## Troubleshooting

| Problema | Solucion |
| --- | --- |
| `ModuleNotFoundError: uvicorn` | Instala dependencias con `.\.venv\Scripts\python.exe -m pip install -r backend-python\requirements.txt` |
| Puerto 8000 ocupado | Deten el proceso anterior o cambia `--port 8001` |
| Puerto 5173 ocupado | Vite suele elegir otro puerto; revisa la terminal |
| El mapa no carga | Verifica conexion a internet para tiles de OpenStreetMap |
| No conecta con API | Revisa `http://localhost:8000/api/health` y el proxy en `frontend/vite.config.ts` |
| PostgreSQL falla | El sistema cae a modo demo en memoria; revisa `DATABASE_URL` |
| `dockerDesktopLinuxEngine` no existe | Docker Desktop esta instalado pero apagado; abre Docker Desktop y ejecuta `docker info` otra vez |
| `.\.venv\Scripts\python.exe` no se reconoce desde `database` | Vuelve a la raiz con `cd ..` o usa `python` si el entorno virtual esta activado |
| `ERR_ADDRESS_INVALID` en `http://0.0.0.0:8000/` | Abre `http://localhost:8000/api/health`; `0.0.0.0` no se usa como URL del navegador |

## Estado operativo actual

El proyecto ya se encuentra en ejecución local con los servicios disponibles en:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000/api/health`
- Geo/Alertas: `http://localhost:3100/health`

En este momento la aplicación está lista para probar la autenticación, los reportes, el monitoreo operativo y la priorización de zonas críticas.

## Documentacion Conservada

- `docs/entrega-2.md`: documento academico base de la entrega.
- `docs/diagrama-casos-uso.puml` y `docs/diagrama-clases.puml`: diagramas UML editables.
- `database/schema.sql` y `database/seed.sql`: referencia tecnica de la base de datos PostgreSQL.

La documentacion duplicada de resumen, guias rapidas y previews fue consolidada aqui para mantener el proyecto mas limpio.
