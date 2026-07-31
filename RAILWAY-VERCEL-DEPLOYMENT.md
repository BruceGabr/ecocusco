# Despliegue en Producción: Railway + Vercel

## Arquitectura

```
Usuario
  ↓
Vercel (Frontend React/Vite)
  https://sir-cusco.vercel.app
  ↓  VITE_API_URL / VITE_GEO_URL
Railway (Backend FastAPI Python)
  https://sir-cusco-backend-production.up.railway.app
```

## URLs en producción

| Servicio | URL |
|---------|-----|
| Frontend (Vercel) | https://sir-cusco.vercel.app |
| Backend API (Railway) | https://sir-cusco-backend-production.up.railway.app |
| Health check | https://sir-cusco-backend-production.up.railway.app/api/health |
| Alertas | https://sir-cusco-backend-production.up.railway.app/api/alerts |

---

## Archivos de configuración agregados

### `Dockerfile` (raiz del repo)

Construye el backend FastAPI desde la subcarpeta `backend-python/`.
Se usa porque Railway con Nixpacks tenía conflictos al detectar
`package.json` (Node.js) y `requirements.txt` (Python) al mismo tiempo.

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend-python/ .
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

### `railway.toml` (raiz del repo)

Indica a Railway que use el Dockerfile como builder y configura
el health check del servicio.

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 60
restartPolicyType = "on_failure"
```

### `backend-python/railway.toml`

Configuracion alternativa para despliegue directo desde la subcarpeta
(si Railway se configura con Root Directory = backend-python).

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/api/health"
healthcheckTimeout = 60
restartPolicyType = "on_failure"
```

### `vercel.json` (raiz del repo)

Indica a Vercel como construir el frontend desde la subcarpeta `frontend/`.

```json
{
  "installCommand": "npm --prefix frontend install",
  "buildCommand": "npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite"
}
```

### `.vercelignore` (raiz del repo)

Impide que Vercel detecte el backend Python y lo intente desplegar
junto al frontend (lo que causaba un error 401/404 al enrutar `/`
al servicio FastAPI en vez de al frontend).

```
backend-python/
backend-typescript/
database/
scripts/
docs/
.venv/
*.py
*.sql
render.yaml
railway.toml
Dockerfile
verify_system.py
```

---

## Proceso de despliegue paso a paso

### 1. Backend en Railway

**Herramienta:** Railway CLI (`@railway/cli`)

```powershell
# Instalar CLI
npm install -g @railway/cli

# Autenticarse (abre navegador con codigo de dispositivo)
railway login --browserless

# Vincular al proyecto existente "remarkable-vision" (vacio)
railway link --project "remarkable-vision"

# Crear servicio desde el repositorio de GitHub
railway add `
  --repo "Alejandro225425/Sistema-de-Recoleccion-de-Residuos-Solidos" `
  --branch "version-1-proyecto" `
  --service "sir-cusco-backend" `
  --variables "CORS_ORIGIN_REGEX=https://.*\.vercel\.app" `
  --json

# Generar dominio publico
railway domain --service "sir-cusco-backend" --json
```

**Problemas encontrados y soluciones:**

| Problema | Causa | Solución |
|---------|-------|---------|
| `Free plan resource provision limit exceeded` | Cuenta tenia 2 proyectos ocupando el limite | Se uso proyecto existente vacio (`remarkable-vision`) |
| `pip: command not found` | Nixpacks instala Python sin pip en PATH | Se cambio a Dockerfile con `python:3.11-slim` |
| `externally-managed-environment` | Nixpacks bloquea pip en entorno Nix | Se elimino `nixpacks.toml` y se uso Dockerfile |

**Resultado:** `Status: SUCCESS`

---

### 2. Frontend en Vercel

**Herramienta:** Vercel CLI (`vercel`)

```powershell
# Instalar CLI
npm install -g vercel

# Autenticarse (codigo de dispositivo)
vercel login

# Guardar variables de entorno en el proyecto (build-time)
# IMPORTANTE: usar "vercel env add", NO el flag --env del deploy
echo "https://sir-cusco-backend-production.up.railway.app/api" | vercel env add VITE_API_URL production
echo "https://sir-cusco-backend-production.up.railway.app" | vercel env add VITE_GEO_URL production

# Desplegar a produccion
vercel --prod --yes
```

**Problemas encontrados y soluciones:**

| Problema | Causa | Solución |
|---------|-------|---------|
| `Project name too long` | Nombre del directorio local tiene 100+ caracteres con tildes | Se uso `--name "sir-cusco"` |
| Frontend muestra error de conexion con FastAPI | Variables `VITE_*` pasadas con `--env` al deploy son runtime, no build-time; Vite las necesita en tiempo de compilacion | Se usó `vercel env add` para guardarlas persistentemente y se redeploy |
| Vercel detecta FastAPI y enruta `/` al backend | CLI de Vercel detecta `backend-python/` y agrega `experimentalServices` al `vercel.json` automaticamente | Se creo `.vercelignore` excluyendo `backend-python/` y archivos Python |
| URL devuelve 401 | El servicio FastAPI estaba enrutado en `/` gracias a `experimentalServices` | Se elimino la seccion del `vercel.json` y se agrego `.vercelignore` |

**Resultado:** `readyState: READY` — https://sir-cusco.vercel.app

---

## Variables de entorno

### Railway (backend)

| Variable | Valor | Descripcion |
|---------|-------|-------------|
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` | Permite peticiones desde cualquier subdominio de Vercel |
| `PORT` | *(Railway la inyecta automaticamente)* | Puerto en que escucha uvicorn |

### Vercel (frontend — build-time)

| Variable | Valor | Descripcion |
|---------|-------|-------------|
| `VITE_API_URL` | `https://sir-cusco-backend-production.up.railway.app/api` | Base URL de la API REST |
| `VITE_GEO_URL` | `https://sir-cusco-backend-production.up.railway.app` | Base URL del servicio geo/alertas |

---

## Modo de operacion del backend

El backend corre en **modo demo** (sin base de datos PostgreSQL).
Todos los datos (zonas, camiones, rutas, reportes) vienen de
`MemoryStore` en `backend-python/app/main.py`.

El endpoint `/api/health` retorna:
```json
{
  "status": "ok",
  "database": "memory",
  "version": "1.0.0",
  "mode": "demo"
}
```

Para activar PostgreSQL, agregar en Railway la variable:
```
DATABASE_URL=postgresql://usuario:password@host:5432/sir_cusco
```
Railway puede crear una base de datos PostgreSQL integrada
desde el dashboard del proyecto.

---

## Duracion estimada del servicio gratuito

| Servicio | Plan | Duracion |
|---------|------|---------|
| Vercel | Hobby (gratis) | Permanente |
| Railway | Starter ($5 credito/mes) | ~3-4 semanas |

Cuando el credito de Railway se acabe, el backend se suspende
y el frontend mostrara el error de conexion.

**Alternativa gratuita permanente:** migrar el backend a Render.com
(el proyecto ya tiene `render.yaml` listo). El servicio en Render
se "duerme" tras 15 min de inactividad y tarda ~30 seg en la primera
peticion, pero nunca se suspende por credito.

---

## Como redesplegar

```powershell
# Subir cambios al repo
git add .
git commit -m "descripcion del cambio"
git push origin version-1-proyecto

# Railway: redeploy automatico al detectar nuevo commit en GitHub
# Vercel: redeploy manual si es necesario
vercel --prod --yes
```
