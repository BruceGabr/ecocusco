# 📦 Documentación de Despliegue
## Sistema Inteligente de Recolección de Residuos Sólidos — Cusco

> **Rama de producción:** `v2.0.0-deploy-config`
> **Versión:** `2.0.0`
> **Repositorio:** [`Alejandro225425/Sistema-de-Recoleccion-de-Residuos-Solidos`](https://github.com/Alejandro225425/Sistema-de-Recoleccion-de-Residuos-Solidos)
> **Última actualización:** 2026-07-30

---

## Índice

1. [Arquitectura del sistema](#1-arquitectura-del-sistema)
2. [Opción A — Cloudflare Tunnel (local, temporal)](#2-opción-a--cloudflare-tunnel-local-temporal)
3. [Opción B — Render + Vercel (cloud, permanente)](#3-opción-b--render--vercel-cloud-permanente)
4. [Opción C — Railway + Vercel (cloud, alternativa)](#4-opción-c--railway--vercel-cloud-alternativa)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Verificación de salud](#6-verificación-de-salud)
7. [Flujo de actualización](#7-flujo-de-actualización)
8. [Historial de despliegues](#8-historial-de-despliegues)
9. [Problemas conocidos y soluciones](#9-problemas-conocidos-y-soluciones)
10. [Notas y limitaciones](#10-notas-y-limitaciones)

---

## 1. Arquitectura del sistema

El sistema está compuesto por **tres servicios independientes**:

```
┌──────────────────────────────────────────────────────┐
│                   INTERNET / USUARIO                 │
└──────────────────────┬───────────────────────────────┘
                       │
         ┌─────────────▼──────────────┐
         │     FRONTEND (React/Vite)  │
         │   Vercel / localhost:5173  │
         └──────┬──────────┬──────────┘
                │          │
   ┌────────────▼──┐   ┌───▼───────────────────┐
   │  API Python   │   │  Servicio Geo (TS)    │
   │  FastAPI      │   │  Express/TypeScript   │
   │  puerto 8000  │   │  puerto 3001 / 3100   │
   └───────────────┘   └───────────────────────┘
```

| Servicio       | Tecnología              | Puerto local | Plataforma cloud recomendada |
|---------------|------------------------|-------------|------------------------------|
| Frontend       | React + TypeScript + Vite | 5173     | Vercel                       |
| Backend Python | FastAPI (Python / uvicorn)| 8000     | Render / Railway             |
| Backend Geo    | Express (TypeScript)      | 3001–3100| Render                       |

---

## 2. Opción A — Cloudflare Tunnel (local, temporal)

Esta opción expone los servicios locales a internet **sin abrir puertos del router ni crear cuentas**.
Las URLs **cambian** cada vez que se reinicia `cloudflared`.

### Requisitos previos

- `cloudflared.exe` descargado en `scripts\cloudflared.exe` (incluido en el repositorio).
- Los tres servicios corriendo localmente.
- PowerShell con política de ejecución habilitada:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
  ```

### Iniciar todos los servicios y túneles (script automático)

```powershell
powershell -ExecutionPolicy Bypass -File "scripts\deploy-cloudflare.ps1"
```

El script levanta los tres servicios y abre tres túneles. Las URLs quedan guardadas en `CLOUDFLARE-URLS.txt`.

### Iniciar manualmente (alternativa)

```powershell
# Terminal 1 — Backend Python
cd backend-python
..\.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Backend Geo (TypeScript)
cd backend-typescript
npm run dev

# Terminal 3 — Frontend
cd frontend
npm run dev

# Terminal 4 — Túnel Frontend
scripts\cloudflared.exe tunnel --url http://localhost:5173

# Terminal 5 — Túnel API Python
scripts\cloudflared.exe tunnel --url http://localhost:8000

# Terminal 6 — Túnel Geo TS
scripts\cloudflared.exe tunnel --url http://localhost:3001
```

### URLs obtenidas en la sesión del 2026-06-18

```
FRONTEND:   https://concern-waters-criticism-shared.trycloudflare.com
API Python: https://experiencing-styles-emails-nutritional.trycloudflare.com
            /docs      → Swagger UI
            /api/health → health check
Geo TS:     https://except-associates-stops-rays.trycloudflare.com
            /api/truck-locations
```

> ⚠️ URLs **temporales**. Cambian al reiniciar `cloudflared` y solo funcionan mientras el equipo esté encendido.

---

## 3. Opción B — Render + Vercel (cloud, permanente, recomendada)

Render permite crear **Web Services manuales** gratuitos sin tarjeta de crédito. No uses Blueprint (es de pago); sigue estos pasos manuales.

### 3.1 PostgreSQL en Render (opcional pero recomendado)

1. Entra a https://dashboard.render.com/ → **New** → **PostgreSQL**.
2. Nombre: `sir-cusco-db`.
3. Plan: **Free**.
4. Crea la base de datos.
5. Anota la **Internal Database URL**, por ejemplo:
   ```
   postgresql://sir_cusco_user:password@host:5432/sir_cusco_db
   ```
6. Render ofrece 90 MB de almacenamiento y 10 conexiones en plan gratuito.

### 3.2 Backend Python en Render (Web Service)

1. Entra a https://dashboard.render.com/ → **New** → **Web Service**.
2. Conecta el repositorio `Alejandro225425/Sistema-de-Recoleccion-de-Residuos-Solidos`.
3. Rama: `v2.0.0-deploy-config`.
4. Nombre: `sir-cusco-api`.
5. Runtime: **Python 3**.
6. Plan: **Free**.
7. Build Command:
   ```bash
   pip install -r backend-python/requirements.txt
   ```
8. Start Command:
   ```bash
   uvicorn app.main:app --app-dir backend-python --host 0.0.0.0 --port $PORT
   ```
9. En **Environment**, agrega:
   - `JWT_SECRET`: genera un string robusto único (mínimo 32 caracteres aleatorios).
   - `DATABASE_URL`: pega la Internal Database URL del paso 3.1 si creaste PostgreSQL.
   - `CORS_ORIGIN_REGEX`: `https://.*\.vercel\.app`
   - `CORS_ORIGINS`: `http://localhost:5173,http://127.0.0.1:5173`
10. Crea el servicio y espera a que quede **Live**.
11. Anota la URL pública:
    ```
    https://sir-cusco-api.onrender.com
    ```

**Verificar:**
```
GET https://sir-cusco-api.onrender.com/api/health
```

### 3.3 Backend Geo en Render (Web Service)

1. Entra a https://dashboard.render.com/ → **New** → **Web Service**.
2. Conecta el mismo repositorio.
3. Rama: `v2.0.0-deploy-config`.
4. Nombre: `sir-cusco-geo`.
5. Runtime: **Node.js**.
6. Plan: **Free**.
7. Build Command:
   ```bash
   cd backend-typescript && npm install && npm run build
   ```
8. Start Command:
   ```bash
   cd backend-typescript && npm start
   ```
9. Crea el servicio y espera a que quede **Live**.
10. Anota la URL pública:
    ```
    https://sir-cusco-geo.onrender.com
    ```

**Verificar:**
```
GET https://sir-cusco-geo.onrender.com/health
```

### 3.4 Frontend en Vercel

1. Entra a https://vercel.com/new → importa el mismo repositorio.
2. Rama: `v2.0.0-deploy-config`.
3. Vercel usa `vercel.json` automáticamente (ya configurado).
4. Agregar variables de entorno **antes de desplegar**:
   ```
   VITE_API_URL = https://sir-cusco-api.onrender.com/api
   VITE_GEO_URL = https://sir-cusco-geo.onrender.com
   ```
5. Clic en **Deploy**.
6. Anota la URL final de Vercel, por ejemplo:
   ```
   https://sistema-de-recoleccion-de-residuos-solidos.vercel.app
   ```

### 3.5 Ajustar CORS en Render

1. Ve a `sir-cusco-api` → **Environment**.
2. Actualiza `CORS_ORIGINS` con la URL final de Vercel:
   ```
   https://sistema-de-recoleccion-de-residuos-solidos.vercel.app
   ```
3. Guarda cambios y espera el redeploy automático.

---

---

## 4. Opción C — Railway + Vercel (cloud, alternativa)

Railway se usa si Koyeb pide tarjeta de crédito. El backend Python ya tiene `railway.toml` configurado.

### 4.1 Backend en Railway

1. Ir a https://railway.app/ → **New Project → Deploy from GitHub**.
2. Seleccionar el repositorio y la rama `version-1-proyecto`.
3. Railway detecta `backend-python/railway.toml` automáticamente.
4. Configurar variable de entorno:
   ```
   CORS_ORIGIN_REGEX = https://.*\.vercel\.app
   ```
5. Desplegar → Railway genera una URL tipo:
   ```
   https://sir-cusco-api.up.railway.app
   ```

### 4.2 Frontend en Vercel

Mismos pasos que en la Opción B, usando las URLs de Railway:
```
VITE_API_URL = https://sir-cusco-api.up.railway.app/api
VITE_GEO_URL = https://sir-cusco-api.up.railway.app
```

> **Nota:** `backend-python/railway.toml` y `backend-python/railway.json` ya están en el repositorio (pusheados el 2026-06-18).

---

## 5. Variables de entorno

### Backend Python

| Variable            | Descripción                                   | Valor en producción                   |
|--------------------|-----------------------------------------------|---------------------------------------|
| `CORS_ORIGINS`      | Lista de URLs permitidas (separadas por `,`)  | `http://localhost:5173`               |
| `CORS_ORIGIN_REGEX` | Regex para permitir dominios de Vercel        | `https://.*\.vercel\.app`             |
| `DATABASE_URL`      | URL de PostgreSQL (opcional)                  | `postgresql://user:pass@host/db`      |
| `JWT_SECRET`        | Secreto para firmar tokens JWT (obligatorio en producción) | Genera un string robusto único |

### Frontend (`frontend/.env` o variables en Vercel)

| Variable       | Descripción                      | Valor de ejemplo                               |
|---------------|----------------------------------|------------------------------------------------|
| `VITE_API_URL` | URL base de la API Python        | `https://sir-cusco-api.onrender.com/api`       |
| `VITE_GEO_URL` | URL del servicio Geo             | `https://sir-cusco-geo.onrender.com`           |

### 5.1 Backup y restauración de PostgreSQL

Si usas PostgreSQL local o Docker para persistencia, respalda la base antes de hacer cambios críticos.

> Antes de ejecutar backup/restore, asegúrate de que PostgreSQL esté en ejecución.
> Si usas Docker, ejecuta:
>
> ```powershell
> cd database
> docker compose up -d
> ```
>
> Verifica el estado con:
>
> ```powershell
> docker ps
> ```
>
> Si usas PostgreSQL local, confirma que el servicio está activo y escuchando en el puerto `5432`.
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
> Un fallo común es que `database/seed.sql` inserte notificaciones antes de crear el usuario referenciado.

#### Respaldar la base de datos

Con PostgreSQL instalado localmente:

```powershell
pg_dump -U postgres -Fc -d sir_cusco -f database\backup\sir_cusco-$(Get-Date -Format yyyyMMddHHmmss).dump
```

Con Docker:

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
> En PowerShell, si PostgreSQL solicita contraseña, define la variable de entorno así:
>
> ```powershell
> $env:PGPASSWORD = 'postgres'
> .\scripts\db-backup.ps1 -UseDocker
> ```

#### Restaurar desde respaldo

Detén el backend antes de restaurar y confirma que `DATABASE_URL` apunte a `sir_cusco`.

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

Si necesitas restaurar el esquema y datos iniciales del proyecto:

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
---

## 6. Verificación de salud

Después de cualquier despliegue, verificar estos endpoints:

```
# API Python
GET /api/health           → { "status": "ok" }
GET /docs                 → Swagger UI interactivo
GET /alerts               → Lista de alertas

# Servicio Geo (TypeScript)
GET /api/truck-locations  → Posiciones GPS de camiones en tiempo real
```

## 6.1 Pruebas de despliegue

- Validar el frontend con `npx vitest run`: `11 passed`.
- Validar el backend Python con `pytest -q`: `16 passed`.
- Ejecutar `npm run build` para confirmar el build de producción del frontend.
- Confirmar envíos operativos y CRUD administrativos a través de la UI del panel de administración.

# Frontend
Abrir la URL en el navegador → Dashboard del sistema

---

## 7. Flujo de actualización

```powershell
git add .
git commit -m "descripcion del cambio"
git push origin version-1-proyecto
```

| Plataforma          | Comportamiento ante un push        |
|--------------------|------------------------------------|
| **Vercel**          | Redespliega automáticamente       |
| **Render**          | Redespliega automáticamente       |
| **Railway**         | Redespliega automáticamente       |
| **Cloudflare Tunnel** | Requiere reiniciar el script manualmente |

---

## 8. Historial de despliegues

### 2026-07-30 — Sesión 4: Configuración de despliegue lista para v2.0.0

- **Rama:** `v2.0.0-deploy-config`
- **Versión:** `2.0.0`
- **Archivos actualizados:**
  - `render.yaml` — se añadió `JWT_SECRET` como variable de entorno (`sync: false`) para el servicio `sir-cusco-api`.
  - `backend-python/.env.example` — se incluyó `JWT_SECRET` para referencia de producción.
  - `backend-python/.env` — se añadió `JWT_SECRET` con valor de desarrollo.
  - `docs/DESPLIEGUE.md` — se actualizó la tabla de variables de entorno y el historial de despliegues.
  - `CHANGELOG.md` — se registró el hito.
  - `README.md` — se actualizó la versión y el estado de despliegue.
  - `VERSION.md` — se registró la versión 2.0.0.
- **Estado:** ✅ Configuración de despliegue lista. Pendiente ejecutar despliegue manual en Render/Vercel o Railway/Vercel y configurar `JWT_SECRET` y `DATABASE_URL` seguros en producción.

### 2026-07-30 — Sesión 5: Checklist de despliegue real en producción

Esta sesión documenta el paso a paso para completar el despliegue de la rama `v2.0.0-deploy-config`.

#### Plataforma A: Render + Vercel (recomendada)

**Backend Python (Render):**
1. Ir a https://dashboard.render.com/ → **New Blueprint**.
2. Conectar el repositorio `Alejandro225425/Sistema-de-Recoleccion-de-Residuos-Solidos`.
3. Rama: `v2.0.0-deploy-config`.
4. Render detecta `render.yaml` y crea:
   - `sir-cusco-api` — Python/FastAPI (root: `backend-python`)
   - `sir-cusco-geo` — Node.js/TypeScript (root: `backend-typescript`)
5. En `sir-cusco-api` → **Environment**, configurar:
   - `JWT_SECRET`: generar un string robusto único (mínimo 32 caracteres, aleatorio).
   - `DATABASE_URL`: URL de PostgreSQL si se desea persistencia (opcional para modo demo).
   - `CORS_ORIGINS`: agregar la URL final de Vercel cuando esté lista.
   - `CORS_ORIGIN_REGEX`: `https://.*\.vercel\.app`
6. Esperar estado **Live** en ambos servicios.
7. Anotar las URLs públicas:
   ```
   https://sir-cusco-api.onrender.com
   https://sir-cusco-geo.onrender.com
   ```

**Frontend (Vercel):**
1. Ir a https://vercel.com/new → importar el mismo repositorio.
2. Rama: `v2.0.0-deploy-config`.
3. Vercel usa `vercel.json` automáticamente.
4. Agregar variables de entorno **antes de desplegar**:
   ```
   VITE_API_URL = https://sir-cusco-api.onrender.com/api
   VITE_GEO_URL = https://sir-cusco-geo.onrender.com
   ```
5. Clic en **Deploy**.
6. Anotar URL final de Vercel:
   ```
   https://sir-cusco.vercel.app
   ```

**Post-despliegue:**
1. Actualizar `CORS_ORIGINS` en Render con la URL final de Vercel.
2. Verificar `/api/health` → debe devolver `"mode": "production"` si `DATABASE_URL` está configurada.
3. Verificar login, reportes, panel administrativo y mapa en la URL de Vercel.

#### Plataforma B: Railway + Vercel (alternativa)

**Backend Python (Railway):**
1. Ir a https://railway.app/ → **New Project → Deploy from GitHub**.
2. Seleccionar el repositorio y la rama `v2.0.0-deploy-config`.
3. Railway detecta `backend-python/railway.toml` automáticamente.
4. Configurar variables de entorno:
   - `JWT_SECRET`: string robusto único.
   - `DATABASE_URL`: opcional.
   - `CORS_ORIGIN_REGEX`: `https://.*\.vercel\.app`
5. Desplegar → Railway genera URL tipo:
   ```
   https://sir-cusco-api.up.railway.app
   ```

**Frontend (Vercel):**
1. Mismos pasos que en Plataforma A, usando URLs de Railway:
   ```
   VITE_API_URL = https://sir-cusco-api.up.railway.app/api
   VITE_GEO_URL = https://sir-cusco-api.up.railway.app
   ```

#### Checklist de verificación post-despliegue

- [ ] `/api/health` devuelve `"status": "ok"` y `"mode": "production"` (si `DATABASE_URL` está configurada).
- [ ] Login con `admin@ecocusco.pe` / `admin123` funciona correctamente.
- [ ] Frontend carga el dashboard, mapa y paneles sin errores.
- [ ] Reportes se pueden crear y listar.
- [ ] Panel administrativo carga zonas, horarios, camiones y mantenimiento.
- [ ] Filtros de búsqueda por conductor y por estado funcionan.
- [ ] Exportación a CSV y PDF funciona desde reportes y analytics.
- [ ] CORS permite el dominio de Vercel (no hay errores en consola del navegador).

---

## 9. Problemas conocidos y soluciones

| Problema | Causa | Solución aplicada |
|---------|-------|-------------------|
| `cloudflared` no encontrado en PATH | Instalado con `winget` pero sesión de PowerShell no refrescada | Descargar `.exe` directamente a `scripts\` |
| `npm` bloqueado por PowerShell | Política de ejecución restrictiva | `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| Puerto 5173/5174 ocupado | Procesos anteriores de Vite activos | Vite auto-seleccionó puerto 5175 |
| Vite bloquea host externo | `allowedHosts` no configurado | Añadir `allowedHosts: true` en `vite.config.ts` |
| Script falla con ruta con espacios | El nombre de la carpeta del proyecto contiene espacios y tildes | Script v2: copiar `cloudflared.exe` a `%TEMP%` y usar scripts helper en carpeta sin espacios |
| Koyeb pide tarjeta de crédito | Verificación de cuenta en plan gratuito | Alternativas: Render (sin tarjeta) o Railway |

---

## 9.1 Troubleshooting Render

### Error: `Exited with status 1 while building your code`

Este error ocurre cuando el build falla en Render. Causas y soluciones:

**Causa 1: Runtime de Python incorrecto**
- **Síntoma:** El build falla inmediatamente con error de Python.
- **Solución:** En el Web Service manual, configura **Runtime** como `Python 3.11` (no `Python` genérico). Render necesita una versión específica.

**Causa 2: Root Directory o comandos mal escritos**
- **Síntoma:** Render no encuentra `requirements.txt` o `app/main.py`.
- **Solución:** Asegúrate de que **Root Directory** esté vacío (por defecto) o sea `.` (raíz del repo). Los comandos deben ser exactamente:
  - Build Command: `pip install -r backend-python/requirements.txt`
  - Start Command: `uvicorn app.main:app --app-dir backend-python --host 0.0.0.0 --port $PORT`

**Causa 3: Variables de entorno faltantes**
- **Síntoma:** El build pasa pero el servicio no inicia.
- **Solución:** Verifica que `JWT_SECRET` esté configurado. Sin esta variable, el backend puede fallar al iniciar.

**Causa 4: Plan Free sin recursos**
- **Síntoma:** Build lento o timeout.
- **Solución:** Render Free tiene límites. Si el build tarda más de 15 minutos, prueba a usar una región más cercana o reduce dependencias.

### Logs para diagnosticar

1. Ve al servicio en Render → **Logs**
2. Filtra por **Build logs**
3. Busca líneas que empiecen con `ERROR` o `Failed`
4. Si ves `ModuleNotFoundError`, faltan dependencias
5. Si ves `FileNotFoundError`, revisa las rutas de archivos

### Solución rápida: recrear el Web Service

Si el error persiste:
1. Elimina el servicio de Render
2. Crea uno nuevo siguiendo exactamente los pasos de la sección 3.2
3. Asegúrate de copiar los comandos **exactamente** como están escritos arriba

---

## 10. Notas y limitaciones

### Cloudflare Tunnel
- Completamente **gratuito y sin registro** (modo Quick Tunnel con `trycloudflare.com`).
- URLs aleatorias y temporales — **cambian** cada vez que se reinicia `cloudflared`.
- Requiere que el equipo local **esté encendido y con conexión** permanente.
- Ideal para demostraciones rápidas o compartir por WhatsApp temporalmente.

### Render (plan gratuito)
- Los servicios se **duermen** tras 15 min de inactividad.
- La primera petición tras el sueño tarda **30–60 segundos**.
- Para mantenerlos activos: usar https://uptimerobot.com/ con ping cada 5 min.

### Railway (plan gratuito)
- Incluye $5 de crédito mensual — suficiente para uso ligero.
- Sin límite de sueño (siempre activo dentro del crédito).

### Koyeb (plan gratuito)
- Puede requerir **tarjeta de crédito** para validación.
- Si no se quiere ingresar tarjeta, usar **Render** o **Railway**.

### Base de datos
- El backend opera en **modo demo / memoria** si `DATABASE_URL` no está configurada.
- Para persistencia real: usar [Supabase](https://supabase.com/), [Neon](https://neon.tech/) o [Railway PostgreSQL](https://railway.app/).

### CORS
- Al agregar un dominio propio, actualizar `CORS_ORIGINS` en la plataforma del backend con la URL definitiva del frontend.
