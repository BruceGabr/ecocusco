# Auditoría contra el PDF del proyecto + Plan de limpieza

Documento de trabajo. Contrasta el enunciado *"Proyecto semestral AG-C01 2026-1"* (IF614) con
el estado real del repositorio `BruceGabr/ecocusco`, y define un plan de saneamiento seguro
para un despliegue ya activo (backend + PostgreSQL en Render, frontend en Vercel).

Fecha de la auditoría: 2026-08-03.

---

## Parte 0 — Hallazgos críticos (romper primero esto)

Estos no son "mejoras": son cosas rotas o peligrosas hoy en producción.

| # | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| C1 | `create_collection_record` y `confirm_collection_by_citizen` están **indentadas dentro de `delete_maintenance`**. No existen a nivel de módulo. | `backend-python/app/main.py:954` y `:984` | `POST /api/collections` y `POST /api/collections/{id}/confirm` revientan con `NameError` → HTTP 500. El registro de recolección por conductor y la confirmación ciudadana **no funcionan** aunque la UI los ofrece. |
| C2 | La vista `Operations` se importa pero nunca se renderiza. `'operations'` no existe en `View` ni en `viewLabels`. | `main.tsx:31` vs `constants.ts:5-13`, `types.ts:2-9` | Módulo operativo completo (≈174 líneas + tests) es código muerto e inaccesible. |
| C3 | La contraseña de login viaja por `window.__password` (variable global del navegador). | `AuthView.tsx:69`, `main.tsx:108-110` | Cualquier script de terceros en la página lee la contraseña en claro. Además es un antipatrón que salta a la vista en la exposición. |
| C4 | `compliance: 87` está **hardcodeado** en las dos rutas de analítica. | `main.py:219` y `main.py:383` | "Cumplimiento de rutas" (Módulo 6 del PDF) es un número inventado, no una métrica. |
| C5 | `scripts/cloudflared.exe` (54 MB) versionado en git. | `git ls-files scripts/` | Repo pesado, clonado lento, y "código fuente debidamente organizado" (entregable del PDF) queda comprometido. |
| C6 | Los `try/except Exception` que envuelven cada acceso a BD hacen **fallback silencioso a memoria**. | `main.py:590-1030` (patrón repetido ~20 veces) | Si Postgres falla en Render, la app sigue "funcionando" contra datos en RAM y nadie se entera; los datos escritos se pierden en el siguiente reinicio. Es el bug más difícil de detectar de todos. |
| C8 | **La carga inicial se ejecuta una sola vez, antes del login, y nunca se reintenta.** `useEffect(() => { loadData()... }, [])` con dependencias vacías. | `main.tsx:63` (commit `9092620`, el desplegado) | **Este es el "se borró mi base de datos" de producción.** Render en plan gratuito duerme el servicio tras ~15 min. Al abrir la app, `/bootstrap` falla o tarda demasiado ⇒ `data` se queda en `emptyBootstrap` (listas vacías, analíticas en 0). El usuario inicia sesión —que sí funciona, porque para entonces Render ya despertó— pero **`loadData()` no vuelve a ejecutarse jamás**: la app queda vacía hasta recargar con F5. Corregido al pasar la dependencia `[session?.email]`. |
| C7 | `README.md` / `VERSION.md` afirman que existe `vercel.json`. No existe. `render.yaml` declara el servicio `sir-cusco-api`, pero el despliegue real es `ecocusco-api.onrender.com`. | `frontend/.env.local`, `render.yaml:3` | La documentación no describe el sistema desplegado. Ver Parte 3: implica que los servicios de Render se crearon a mano, no por blueprint. |

---

## Parte 0-bis — Auditoría del modelo de datos (`database/schema.sql`)

Veredicto: **el esquema está a medio normalizar y usa texto libre donde debería usar tipos y
relaciones.** Es la causa raíz de varios bugs del código y bloquea directamente tres módulos del
PDF. Lo que se conserva y lo que hay que rehacer:

### Lo que está bien (conservar)

- `zones`, `trucks`, `maintenance_records`, `containers`: claves, `unique` en `zones.name` y
  `trucks.code`, y FKs correctas.
- `CHECK (progress between 0 and 100)` y `CHECK (fill_level between 0 and 100)`: buena práctica,
  aplicada donde toca.
- Separación de `password_reset_tokens` en su propia tabla.

### Defectos de diseño (corregir)

| # | Defecto | Dónde | Consecuencia real |
|---|---|---|---|
| D1 | **`reports.citizen` guarda el NOMBRE del ciudadano, no un `user_id`** | `schema.sql:47` | El filtro "mis reportes" compara nombres en minúsculas (`main.py:1445`). **Dos usuarios homónimos ven los reportes del otro**, y si alguien cambia su nombre pierde su historial. Es una fuga de datos personales, relevante para la Ley 29733 del informe. |
| D2 | **`users.zone` y `reports.zone` son VARCHAR, no FK a `zones`** | `schema.sql:15,46` | Renombrar una zona deja usuarios y reportes apuntando a un nombre inexistente. La integridad referencial existe en 4 tablas y falta justo en estas. |
| D3 | **`schedules.day` es texto libre**: `'Lunes, miercoles y viernes'` | `schema.sql:24` | Imposible responder "¿qué zonas se recogen hoy?" sin parsear castellano. **Bloquea las notificaciones de horario y de cercanía (Módulos 4 y 5).** Debe ser tabla `schedule_days(schedule_id, weekday SMALLINT)`. |
| D4 | **`schedules.time` es texto libre**: `'06:30 - 08:30'` | `schema.sql:25` | Dos horas en un string. Debe ser `start_time TIME` + `end_time TIME`. |
| D5 | **`routes.eta` es VARCHAR** `'12 min'`, parseado con `split()[0]` | `schema.sql:40`, `main.py:311` | Dato numérico guardado como prosa. Debe ser `eta_minutes INTEGER`. |
| D6 | **`routes.delay` es texto libre**, con lógica de negocio por `substring` | `schema.sql:41`, `main.py:319-325` | `route_is_delayed()` hace `"retraso" in texto`. Un typo o un cambio de copy rompe el cálculo de alertas. Debe ser `delay_minutes INTEGER` (o enum). |
| D7 | **`routes` no tiene fecha ni estado** | `schema.sql:36-44` | **No se puede calcular "cumplimiento de rutas" (Módulo 6)**: no hay ruta programada vs. completada ni periodo. Por eso el 87 está hardcodeado. Faltan `scheduled_date`, `status`, `started_at`, `completed_at`. |
| D8 | **`routes` mezcla definición y telemetría** (`progress`, `latitude`, `longitude`) | `schema.sql:36-44` | Sin histórico de posiciones no hay **trazabilidad**, que el PDF exige explícitamente. Separar en `route_positions` con `recorded_at`. |
| D9 | **No existe `waste_types`** | — | **Módulo 2 del PDF sin respaldo en datos.** Los tipos viven hardcodeados en `Waste.tsx` y duplicados en `constants.ts`. |
| D10 | **`collections` no discrimina tipo de residuo** | `schema.sql:57-65` | Solo `kg` total ⇒ **imposible "residuos recolectados por zona y tipo" (Módulo 6)**. Falta `waste_type_id`; y `kg INTEGER` debería ser `NUMERIC(10,2)`. |
| D11 | **La confirmación ciudadana se mete dentro de `status`** como `'Confirmada por ciudadano'` | `main.py:987` | Estado y autoría mezclados en un string. Debe ser `confirmed_by BIGINT REFERENCES users(id)` + `confirmed_at`. |
| D12 | **Ningún `CHECK` en `users.role` ni en los `status`** | todo el esquema | `normalize_role()` solo protege la ruta Python. Cualquier `INSERT` por SQL corrompe los datos. |
| D13 | **Cero índices** más allá de las PK/unique | todo el esquema | Postgres **no indexa las FK automáticamente**. Faltan índices en `reports.status`, `collections.date`, `notifications.user_id`, `routes.truck_id`, y todas las FK. |
| D14 | **`timestamp` sin zona horaria** | 6 tablas | El código escribe `datetime.now(timezone.utc)` y Postgres descarta la zona. Debe ser `timestamptz`. |
| D15 | **`password_reset_tokens.token` en claro** | `schema.sql:67-73` | Quien lea la tabla puede secuestrar cualquier cuenta. Debe guardarse hasheado, y hace falta purga de expirados. |
| D16 | **`containers` sin lat/lon ni capacidad** | `schema.sql:85-92` | Sin coordenadas no hay alerta de proximidad (Módulo 5) ni ubicación en el mapa. |
| D17 | **`seed.sql` fija el hash del admin en el repositorio** | `seed.sql:57` | Credencial por defecto (`admin123`) pública en GitHub. Debe sembrarse desde variable de entorno en el primer arranque. |
| D18 | **No hay sistema de migraciones** | — | `create table if not exists` no permite evolucionar el esquema. **La BD de Render ya tiene datos**, así que todo lo anterior debe aplicarse con `ALTER TABLE` incremental, nunca con `DROP/CREATE`. |

### Conclusión sobre la BD

El esquema soporta el CRUD actual, pero **no puede sostener los Módulos 2, 5 y 6 del PDF** tal
como está. El patrón de fondo se repite: *dato estructurado guardado como prosa en español*
(`day`, `time`, `eta`, `delay`, `status`, `waste`), que después el Python parsea con `split()` y
`in`. Eso es exactamente el hardcodeo que hay que eliminar.

Se aborda en la **Fase 5**, con migraciones incrementales numeradas y en este orden: primero
`waste_types` e índices (aditivo, sin riesgo), después las FK nuevas con backfill, y al final
la separación de telemetría.

---

## Parte 1 — Checklist: funcionalidad exigida por el PDF

Leyenda: `[x]` hecho · `[~]` parcial · `[ ]` falta

### Módulo 1 — Gestión de usuarios y zonas

- [x] Registro de ciudadanos — `POST /api/auth/register`, `AuthView.tsx`
- [x] Gestión de zonas de recolección — CRUD completo, `ZonePanel.tsx`
- [x] Asignación de usuarios a zonas — campo `zone` en `users`, editable en `UserPanel.tsx`
- [~] Roles: existen 4 (`ciudadano`/`operador`/`admin`/`conductor`) pero **cualquiera puede auto-registrarse como `admin`** desde el formulario público. Debe restringirse: registro público → siempre `ciudadano`; el resto solo los crea un admin.

### Módulo 2 — Gestión de residuos  ← **el más débil**

- [ ] **Registro de tipos de residuos**: no existe tabla `waste_types` ni CRUD. Los 5 tipos están escritos a mano en `frontend/src/views/Waste.tsx` y duplicados en `constants.ts:WASTE_TYPES`.
- [~] **Clasificación (orgánico / reciclable / no reciclable)**: existe `backend-python/app/waste.py` con `classify_waste()` y sus tests… pero **ningún endpoint lo expone y el frontend no lo consume**. Es lógica huérfana.
- [ ] No hay registro de residuos *recolectados por tipo*: la tabla `collections` solo guarda `kg` total, sin discriminar orgánico/reciclable/no reciclable. Esto bloquea también el Módulo 6.

### Módulo 3 — Monitoreo de rutas

- [x] Visualización de rutas de camiones — `MapView.tsx` con Leaflet/OSM
- [~] Seguimiento "en tiempo real" — es *polling* cada 10 s (`useMonitor.ts`) sobre posiciones **simuladas** (`simulate_truck_positions` suma un delta fijo de +0.0015°). Funciona como demo; hay que declararlo honestamente como simulación en el informe (§4.5) o justificarlo.
- [ ] No hay histórico de recorrido (trazabilidad), que el PDF menciona explícitamente en la descripción del problema.

### Módulo 4 — Aplicación móvil

- [x] Consulta de horarios — `Schedules.tsx` con filtros y paginación
- [x] Reporte de incidencias — `Reports.tsx` + `POST /api/reports`
- [ ] **Notificaciones de cercanía** — no existe cálculo de proximidad camión↔zona del usuario
- [ ] **No hay app móvil.** Es una SPA responsive. Opciones: (a) convertirla en **PWA** (manifest + service worker + instalable) y renombrar el módulo a "acceso móvil"; (b) declarar en el alcance §1.3 que el móvil se cubre con diseño responsive. La opción (a) es barata (~1 sprint corto) y cierra el requisito de verdad.

### Módulo 5 — Sistema de alertas

- [ ] **Notificación cuando el camión esté próximo** — `build_alerts()` solo mira progreso y llenado de contenedores; nunca calcula distancia a la zona del ciudadano ni notifica a un usuario concreto.
- [x] Alertas de retraso — `build_alerts()` + `route_is_delayed()`
- [~] Las notificaciones se guardan con `user_id` pero se listan **todas para todos** (`bootstrap()` hace `select ... from notifications order by id desc` sin filtrar). Un ciudadano ve las notificaciones de los demás.

### Módulo 6 — Reportes y analítica

- [ ] **Residuos recolectados por zona** — `Analytics.tsx` muestra `total_kg` global; no hay desglose por zona ni por tipo de residuo.
- [ ] **Cumplimiento de rutas** — hardcodeado en 87 (C4). Debe calcularse: rutas completadas / rutas programadas en el periodo.
- [ ] **Participación ciudadana** — métrica inexistente. Fácil de derivar: nº de ciudadanos registrados con ≥1 reporte, reportes por zona, confirmaciones de recolección.
- [ ] No hay filtro temporal (por día / semana / mes) en ninguna métrica.
- [x] Exportación CSV y PDF — `utils/export.ts`

### Requisitos transversales del PDF

- [x] Sistema desplegado en la web (Entrega 3) — Render + Vercel
- [x] Autenticación JWT + bcrypt + control por rol
- [~] Tests: 6 archivos backend + 3 frontend, pero `requirements-dev.txt` **no incluye `httpx`**, que `fastapi.testclient` necesita → la suite no arranca en una máquina limpia.
- [ ] No hay CI (GitHub Actions). "Código ejecutado, de ser posible" en el entregable.

---

## Parte 2 — Checklist: entregables documentales del PDF (§9)

Esto pesa tanto como el código en la rúbrica AG-C01 y hoy está mucho más flojo.

### I. Datos generales
- [~] 1.1–1.7 — esbozados en `docs/entrega-2.md`, faltan 1.6 (roles Scrum) y 1.7 (público objetivo) desarrollados.

### II. Método Scrum aplicado
- [ ] **2.1 Product Backlog priorizado** con requisitos funcionales y **no funcionales** — no existe como artefacto.
- [ ] **Historias de usuario con criterios de aceptación** que incorporen **impacto social, ambiental o económico** ← esto es literalmente el indicador AG-C01.1. Sin esto no se puede puntuar alto.
- [ ] 2.2 Sprints (número, duración, entregables por sprint) — no documentado.
- [ ] 2.3 Herramientas de colaboración (Jira/Trello/Notion + capturas) — el PDF pide capturas en Anexos.

### III. Desarrollo por sprint
- [ ] 3.1–3.4 por cada sprint (objetivo, planning, resultados, capturas)
- [~] 3.5 Diagramas UML: existen **casos de uso** y **clases** (`docs/*.puml`). **Faltan: secuencia, actividades, componentes.**
- [ ] 3.6 Daily Scrums (evidencia)
- [ ] 3.7 Sprint Review con **feedback recibido** ← indicador AG-C01.3
- [ ] 3.8 Sprint Retrospective

### IV. Diseño y arquitectura
- [~] 4.1 Diagrama de arquitectura — hay un `mermaid` mínimo en `entrega-2.md`; conviene uno formal por capas.
- [ ] **4.2 Diagrama entidad-relación** — no existe (sí está `schema.sql`, que no es lo mismo).
- [ ] 4.3 UML general consolidado
- [ ] 4.4 Patrones de diseño aplicados — *hay* patrones en el código (Repository incipiente, DTO con Pydantic, Dependency Injection de FastAPI, Strategy en `Content`), pero nadie los ha nombrado ni justificado.
- [ ] 4.5 Escalabilidad y mantenimiento

### V. Resultados y conclusiones
- [ ] 5.1 Resultados vs. objetivos + **trazabilidad problema → funcionalidad → impacto local/global** ← AG-C01.1
- [ ] 5.2 **Riesgos éticos, legales y sociales identificados y mitigados** ← AG-C01.2. Sugerencias concretas para tu caso:
  - **Ley N° 29733** (Protección de Datos Personales, Perú) y su reglamento: registras nombre, correo y **zona de residencia** de ciudadanos. Necesitas base legal, aviso de privacidad y minimización de datos.
  - **D. Leg. N° 1278** — Ley de Gestión Integral de Residuos Sólidos, y **Ley N° 27314** (derogada, citarla solo como antecedente).
  - **Ordenanzas de la Municipalidad Provincial del Cusco** sobre segregación en la fuente (programa de segregación domiciliaria).
  - Riesgo de **geolocalización de conductores** (vigilancia laboral) → consentimiento, finalidad limitada, retención acotada.
  - **Brecha digital**: un sistema solo-app excluye a población sin smartphone en zonas periféricas → mitigación (canal alterno, difusión municipal).
  - **Sesgo del algoritmo de priorización**: `prioritize_zones()` puntúa por nº de reportes → las zonas que más reportan (típicamente las de mayor capital social) acaparan el servicio. Riesgo de inequidad territorial **real y presente en tu código**. Documentarlo y mitigarlo es oro puro para AG-C01.2.
- [ ] **Definition of Done con criterios éticos y legales explícitos** ← lo pide textualmente §7 AG-C01.2
- [ ] **Checklist de cumplimiento normativo** con % ← §7 AG-C01.2
- [ ] 5.3 Conclusiones · 5.4 Recomendaciones

### VI. Manual de usuario
- [ ] 6.1–6.5 completos con capturas — no existe.

### VII. Anexos
- [ ] **Elicitación: entrevistas a stakeholders** ← AG-C01.1 lo exige como elemento requerido. Hoy no hay ninguna.
- [ ] Cronograma real vs. planeado
- [ ] Capturas de la herramienta Scrum
- [x] Repositorio GitHub

> Resumen honesto: **el código está en ~70%; la documentación exigida por la rúbrica, en ~15%.** La rúbrica AG-C01 mide análisis de impacto, responsabilidad ética/legal y comunicación — no mide cuántos endpoints tienes. El mayor retorno por hora invertida está en la Parte 2, no en la Parte 1.

---

## Parte 3 — Restricciones del despliegue actual (leer antes de mover nada)

Estado confirmado (backend por **Docker**, según el usuario):

- **Backend + PostgreSQL:** Render, construyendo con el **`Dockerfile` de la raíz**. La URL real es
  `https://ecocusco-api.onrender.com` (`frontend/.env.local`), mientras que `render.yaml` declara
  otro servicio (`sir-cusco-api`) y otro runtime (`python` con `pip install`).
  → **`render.yaml` está muerto**: el servicio se creó a mano en el dashboard con runtime Docker.
- **El `Dockerfile` SÍ se usa y no se borra.** Es además una buena noticia: al estar versionado,
  las rutas del build son código, no configuración de dashboard. Pero fija dos contratos:
  ```dockerfile
  COPY backend-python/requirements.txt .   # ← el contexto de build es la RAÍZ del repo
  COPY backend-python/ .
  CMD uvicorn app.main:app ...             # ← el módulo debe seguir siendo app.main:app
  ```
  Renombrar `backend-python/` obliga a editar el Dockerfile (posible), pero mover el entry point
  `app.main:app` rompe el `CMD`. **La Fase 3 respeta ambos contratos.**
- **No hay `.dockerignore`** → el contexto de build enviado a Render incluye todo el repo:
  `scripts/cloudflared.exe` (54 MB), `frontend/`, `node_modules/`, `.git/`. Cada despliegue del
  backend sube y descarta decenas de MB inútiles. Añadir `.dockerignore` acelera los builds y es
  un arreglo de riesgo cero.
- El comentario `# Puerto expuesto por Railway via $PORT` es residuo de la etapa Railway.
- **Frontend:** Vercel, sin `vercel.json` en el repo. → El *Root Directory* (`frontend`) y las *Environment Variables* también están configurados en el dashboard de Vercel.
- **`CORS_ORIGIN_REGEX`** en Render restringe a `^https://ecocusco(-[a-z0-9-]+)?\.vercel\.app$`. Si cambias el nombre del proyecto en Vercel, el frontend deja de poder llamar a la API.

**Las tres reglas de oro de este refactor:**

1. **No renombres `frontend/` ni `backend-python/` sin actualizar antes el Root Directory en los dashboards.** Es el único cambio que puede tumbar producción de golpe.
2. **Verifica primero** en Render si el servicio está enlazado a un Blueprint o es manual (Dashboard → servicio → *Settings* → si hay sección "Blueprint" es blueprint; si no, es manual).
3. Trabaja en una rama (`refactor/estructura`), despliega a un *Preview Deployment* de Vercel, y solo mergea a `main` cuando el preview funcione contra la API de producción.

---

## Parte 4 — Plan de limpieza y reestructuración

Siete fases, ordenadas de **riesgo cero → riesgo alto**. Cada una es un commit (o PR) independiente y verificable. Puedes parar en cualquier fase y el sistema sigue en pie.

### Fase 0 — Red de seguridad (30 min, riesgo nulo)

```bash
git checkout -b refactor/estructura
```

- [ ] Anotar en un archivo local (no versionado) la configuración **actual** de ambos dashboards: Root Directory, Build/Start Command, y todas las variables de entorno de Render y Vercel. Es tu punto de restauración.
- [ ] Backup de la base de datos de Render: `pg_dump` de la URL externa → `database/backup/` (ya está en `.gitignore`).
- [ ] Confirmar que `main` está limpio y desplegado antes de empezar.

### Fase 1 — Borrar lastre (riesgo nulo, no toca código ejecutable)

Eliminar del repositorio:

| Archivo | Motivo |
|---|---|
| `scripts/cloudflared.exe` | 54 MB de binario; era para túneles temporales ya muertos |
| `scripts/deploy-cloudflare.ps1` | Flujo Cloudflare abandonado |
| `CLOUDFLARE-URLS.txt` | URLs de túneles del 2026-06-18, ya inexistentes |
| `KOYEB-DEPLOYMENT.md` | Plataforma nunca usada |
| `RAILWAY-VERCEL-DEPLOYMENT.md`, `railway.toml`, `backend-python/railway.toml` | Railway descartado en favor de Render |

> **`Dockerfile`: NO se borra.** Es lo que Render usa para construir el backend. En su lugar se
> mejora: añadir `.dockerignore`, quitar el comentario que menciona Railway, ejecutar como
> usuario no-root y usar la forma exec en el `CMD`.
| `docs/~$B10-TDD-Actividades.md` | Archivo temporal de Word |
| `verify_system.py` | Script suelto en la raíz; su función la cubren los tests |
| `VERSION.md` | Contradice al `README.md` y al `CHANGELOG.md` (tres fuentes de verdad para lo mismo) |

Además, en `package.json`:
- [ ] Quitar la dependencia autorreferencial `"sir-cusco": "file:.."` de `frontend/package.json` **y** de `backend-typescript/package.json`. El paquete raíz se instala a sí mismo dentro de sus hijos; no aporta nada y confunde a Vercel.
- [ ] Quitar `react-icons` de `frontend/package.json`: **no se importa en ningún archivo** (`lucide-react` es el que se usa realmente, en `Icon.tsx`).
- [ ] Mover `passlib` de `requirements.txt` a `requirements-dev.txt`: solo lo usa `tests/test_security.py`; la app usa `bcrypt` directamente. Instalarlo en producción es peso muerto.
- [ ] **Añadir `httpx` a `requirements-dev.txt`** — sin él `fastapi.testclient` no funciona y la suite no corre en limpio.

> **Nota sobre el .exe:** borrarlo del árbol de trabajo no lo saca del historial de git (el `.git` seguiría pesando ~18 MB). Reescribir el historial con `git filter-repo` es posible pero **rompe los clones existentes y cualquier PR abierto**. Con un proyecto de curso y despliegues enlazados a `main`, mi recomendación es **no reescribir el historial**: borra el archivo, añádelo a `.gitignore`, y sigue adelante. 18 MB no molestan a nadie.

Verificación de la fase: `npm run build` en `frontend/`, `npm --prefix backend-typescript run build`, y `pytest -q` en `backend-python/`. Push → confirmar que el preview de Vercel levanta.

### Fase 2 — Arreglar lo que está roto (riesgo bajo, alto valor)

- [ ] **C1** — Desindentar `create_collection_record` y `confirm_collection_by_citizen` a nivel de módulo (`main.py:954`, `:984`). Añadir un test que llame a `POST /api/collections` para que no vuelva a pasar desapercibido.
- [ ] **C3** — Eliminar `window.__password`. `AuthView` debe pasar la contraseña como argumento: `onLogin({ email, password })`, con la firma tipada en `types.ts`.
- [ ] **C2** — Decidir sobre `Operations`: o se añade `'operations'` a `View`/`viewLabels` y se enruta en `Content` (recomendado: el módulo tiene contenido real y responde a los Módulos 3 y 5 del PDF), o se borra junto a su test. Lo que no puede quedar es importada-y-muerta.
- [ ] **Registro de rol**: forzar `role = "ciudadano"` en `POST /api/auth/register` ignorando lo que mande el cliente. Los roles privilegiados solo desde `POST /api/users` (ya protegido por `require_role({"admin"})`).
- [ ] **Notificaciones por usuario**: filtrar por `user_id` (o `user_id IS NULL` para difusión) en el `select` de `bootstrap()`.
- [ ] **C4** — Calcular `compliance` de verdad, o renombrar el campo a `compliance_estimate` y documentar la fórmula. `build_performance_metrics()` ya tiene una estimación razonable; unificar con ella y borrar el 87 literal de los dos sitios.

### Fase 3 — Reestructurar el backend (riesgo medio, **sin tocar rutas de despliegue**)

`backend-python/app/main.py` tiene **1510 líneas** con modelos, acceso a datos, lógica de negocio y endpoints mezclados. Es el problema estructural más gordo del proyecto y lo que peor se ve en una exposición.

Partirlo **dentro de `app/`**, sin mover la carpeta `backend-python/`, para que `uvicorn app.main:app` siga siendo válido y Render no requiera ningún cambio:

```
backend-python/
├── app/
│   ├── main.py            # solo: crea FastAPI, CORS, incluye routers  (~50 líneas)
│   ├── config.py          # settings, JWT_SECRET, cors_origins, DATABASE_URL
│   ├── database.py        # fetch_all, execute_one, database_mode, normalize_dates
│   ├── security.py        # hash/verify password, create/decode token, require_role
│   ├── schemas/           # todos los BaseModel de Pydantic (hoy líneas 21-152)
│   │   ├── auth.py
│   │   ├── operations.py
│   │   └── catalog.py
│   ├── repositories/      # ← patrón Repository, nombrable en §4.4 del informe
│   │   ├── users.py
│   │   ├── zones.py
│   │   ├── schedules.py
│   │   ├── trucks.py
│   │   ├── collections.py
│   │   └── reports.py
│   ├── services/          # lógica de dominio pura y testeable
│   │   ├── routing.py     # prioritize_zones, optimize_routes, build_intervention_plan
│   │   ├── alerts.py      # build_alerts, route_is_delayed
│   │   ├── metrics.py     # build_performance_metrics, analytics
│   │   ├── simulation.py  # simulate_* (aislado y claramente etiquetado como simulación)
│   │   └── waste.py       # ← rescatar el waste.py huérfano y exponerlo por API
│   ├── routers/
│   │   ├── auth.py  zones.py  schedules.py  trucks.py
│   │   ├── reports.py  collections.py  operations.py  analytics.py
│   └── memory_store.py    # el modo demo, aislado
└── tests/                 # reorganizados por módulo, no por "lab10"
```

Reglas del refactor:
- **Mover, no reescribir.** Cada función viaja tal cual; los tests existentes son la red.
- Correr `pytest -q` después de cada archivo movido, no al final.
- **La ruta de import `app.main:app` no cambia** → Render no se entera. Este es el punto clave.
- Al terminar, sustituir el patrón `try: <sql> except Exception: <memoria>` (hallazgo C6) por un interruptor explícito: `if settings.use_database:` … `else:` …, con log de arranque diciendo en qué modo está. El fallback silencioso desaparece.

### Fase 4 — Reestructurar el frontend (riesgo medio-bajo)

Sin mover `frontend/` (Root Directory de Vercel), reorganizar `src/`:

```
frontend/src/
├── main.tsx               # solo el mount de React (hoy tiene 359 líneas con toda la App)
├── App.tsx                # el shell: sidebar, header, routing de vistas
├── api/                   # client.ts + un módulo por recurso (auth, zones, reports…)
├── features/              # ← por dominio, no por tipo de archivo
│   ├── auth/  dashboard/  schedules/  reports/
│   ├── waste/  routes/  operations/  analytics/  admin/
├── components/ui/         # Button, Modal, Select, DataTable, Toast, Pagination…
├── hooks/  ·  utils/  ·  types/  ·  styles/
└── __tests__/             # los 3 tests que hoy cuelgan sueltos en src/
```

- [ ] Partir `styles.css` (**2502 líneas**) por dominio: `base.css`, `layout.css`, `components.css`, `views.css`, importados desde un `index.css`.
- [ ] Mover `App.test.tsx`, `Operations.test.tsx`, `Reports.test.tsx` fuera de `src/` raíz.
- [ ] Unificar comillas y formato: hoy conviven `"` y `'` (`Icon.tsx` y `constants.ts` fueron reformateados con Prettier; el resto no). Añadir Prettier + ESLint con config compartida y correrlo una vez sobre todo.
- [ ] Eliminar el `zone`/`role` que `AuthView` envía en el login (el backend los ignora y confunde al leer el código).

### Fase 5 — Completar los huecos funcionales del PDF (riesgo bajo, es código nuevo)

Priorizado por peso en la rúbrica ÷ esfuerzo:

1. [ ] **Tipos de residuo como entidad**: tabla `waste_types`, CRUD admin, y `collections.waste_type_id` + `kg` por tipo. Desbloquea el Módulo 2 **y** el Módulo 6 de golpe. — *el de mayor retorno*
2. [ ] **Analítica real** (Módulo 6): kg por zona, kg por tipo, cumplimiento calculado, participación ciudadana, filtro por rango de fechas.
3. [ ] **Alerta de proximidad** (Módulo 5): endpoint que, dada la zona del usuario, calcule distancia haversine al camión asignado y emita notificación bajo un umbral. Cierra el hueco más visible del PDF.
4. [ ] **Exponer `classify_waste()`** por API y consumirlo desde `Waste.tsx` (deja de ser lógica huérfana y la vista deja de estar hardcodeada).
5. [ ] **PWA** (Módulo 4): `manifest.json` + service worker + icono. Convierte "es responsive" en "es instalable en el móvil", que es lo que el PDF pide.
6. [ ] **CI en GitHub Actions**: `pytest` + `tsc` + `vitest` en cada push. Evidencia directa de "código ejecutado" para el entregable.

### Fase 6 — Documentación (riesgo nulo, máximo peso en la rúbrica)

- [ ] Un solo `README.md` veraz: qué es, arquitectura, cómo correrlo, cómo desplegarlo. Borrar las afirmaciones falsas (`vercel.json`, números de tests desactualizados, la rama `v2.0.0-deploy-config` que no es este repo).
- [ ] Consolidar `DEPLOYMENT.md` + `docs/DESPLIEGUE.md` (24 KB, se solapan) en **un** `docs/DESPLIEGUE.md` que describa el despliegue **real**: Render manual + Vercel, con los nombres de servicio verdaderos.
- [ ] Reconciliar `render.yaml` con la realidad: renombrar los servicios a `ecocusco-api` / `ecocusco-geo`, o borrarlo si no se usa como blueprint. Un blueprint que miente es peor que ninguno.
- [ ] Crear `docs/informe/` con la estructura de §9 del PDF (capítulos I–VII) y `docs/diagramas/` con los `.puml` + los tres que faltan.
- [ ] Escribir los artefactos de la Parte 2: Product Backlog priorizado, historias con criterios de aceptación de impacto, DoD con criterios éticos/legales, checklist normativo, y las entrevistas de elicitación.
- [ ] `CLAUDE.md` en la raíz con las convenciones del proyecto, para que las sesiones futuras no reintroduzcan el desorden.

---

## Orden sugerido de ejecución

| Sesión | Fases | Resultado |
|---|---|---|
| 1 | 0 + 1 + 2 | Repo limpio y **sin funcionalidades rotas**. Producción intacta. |
| 2 | 3 | Backend mantenible y con patrones nombrables en el informe. |
| 3 | 4 | Frontend ordenado por dominio. |
| 4 | 5 | Módulos 2, 5 y 6 del PDF completos. |
| 5 | 6 | Documentación al nivel que exige la rúbrica AG-C01. |

Cada sesión: rama propia → preview de Vercel verde → merge a `main` → verificar `https://ecocusco-api.onrender.com/api/health` y la URL de Vercel.

## Lo que NO se debe hacer

- ❌ Renombrar `frontend/` o `backend-python/` (rompe los Root Directory de los dashboards).
- ❌ Cambiar `app.main:app` como punto de entrada (rompe el Start Command de Render).
- ❌ Renombrar el proyecto en Vercel (rompe `CORS_ORIGIN_REGEX` en Render).
- ❌ Reescribir el historial de git para purgar el `.exe` (rompe clones y no compensa).
- ❌ Tocar `schema.sql` sin migración: la BD de Render **ya tiene datos**. Los cambios de la Fase 5 necesitan `ALTER TABLE` incremental, no un `DROP/CREATE`.
