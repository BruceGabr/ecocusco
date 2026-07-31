# Changelog

## 2026-07-30

### Hitos completados
- Se validó el flujo completo de respaldo y restauración de PostgreSQL local con `scripts/db-backup.ps1` y `scripts/db-restore.ps1`, generando un respaldo de 19 KB y restaurándolo exitosamente en una base de datos temporal para verificar integridad de tablas y datos operativos.
- Se confirmó la existencia de PostgreSQL 17 en el equipo, con `pg_dump`, `pg_restore` y `psql` disponibles en el PATH.
- Se limpió la base temporal de prueba y se actualizó toda la documentación del proyecto con el estado validado.
- Se mejoró la accesibilidad y experiencia móvil del panel administrativo: se ajustó el contraste de `--muted` para cumplir WCAG AA, se añadió un `skip-link` para navegación por teclado, se implementaron estilos `:focus-visible` diferenciados, se garantizaron touch targets mínimos de 44px en filtros y botones, y se corrigió scroll horizontal potencial en listas y el layout de dos columnas de administración.
- Se actualizaron las listas del panel administrativo a elementos semánticos `<ul>/<li>` y se asociaron `id`/`htmlFor` en formularios para mejorar la lectura por lectores de pantalla.
- Se verificó el build del frontend (`npx vite build`) y las pruebas automatizadas (`11 passed` frontend, `16 passed` backend).
- Se preparó la configuración de despliegue en producción: se actualizó `render.yaml` con `JWT_SECRET`, se completó `backend-python/.env.example` y `.env`, se actualizó `docs/DESPLIEGUE.md` con la nueva variable y el historial, y se documentó el estado en `README.md` y `docs/entrega-2.md`.
- Se creó la rama `v2.0.0-deploy-config` con commit `v2.0.0: lista para despliegue en produccion...` y se subió a GitHub.
- Se actualizó `VERSION.md` a versión 2.0.0 y `README.md` con la rama de producción actual.
- Se añadió a `docs/DESPLIEGUE.md` la “Sesión 5: Checklist de despliegue real en producción” con pasos detallados para Render+Vercel (Web Services manuales, sin Blueprint) y Railway+Vercel, incluyendo configuración de variables y verificación post-despliegue.
- Se actualizó `docs/DESPLIEGUE.md` para evitar Blueprint (de pago) y usar Web Services manuales gratuitos en Render.

## 2026-07-28

### Hitos completados
- Se integró el CRUD operativo de zonas, horarios, camiones y mantenimiento en la API FastAPI con endpoints protegidos para administradores.
- Se añadió un bloque de administración operativa en el frontend con formularios de creación, edición, eliminación y listado para zonas, horarios, camiones y mantenimiento.
- Se implementaron filtros administrativos avanzados por estado, búsqueda por conductor de camiones, filtros de mantenimiento por estado y búsqueda por conductor dentro de los reportes en administración.
- Se consolidó la experiencia administrativa con filtros de reporte por conductor, estado y zona.
- Se añadieron validaciones dinámicas y mensajes de ayuda contextual en los formularios de camiones y mantenimiento para reducir errores de ingreso.
- Se completó la integración de pruebas de frontend en `frontend/src/App.test.tsx` para ejecutar la aplicación contra un backend FastAPI real y validar los flujos de autenticación, carga de datos, monitor operativo y actualización de operaciones.
- Se actualizaron `README.md`, `docs/DESPLIEGUE.md` y `docs/entrega-2.md` para documentar la búsqueda por conductor en reportes administrativos y los filtros de reporte por estado y zona.
- Se corrigieron advertencias de React `key` en `frontend/src/components/Admin.tsx` y se verificó la suite de frontend con `npx vitest run` (`11 passed`).
- Se verificaron las pruebas automatizadas de backend con `16 passed` y las pruebas de frontend con `11 passed`, incluidas pruebas de edición, eliminación y filtrado en el panel administrativo, así como la validación de eventos operativos y actualizaciones en tiempo real.
- Se implementó registro de recolecciones por conductor y confirmación de recolección por ciudadano (endpoints y UI).
- Se añadió la vista de “Mis reportes” para usuarios ciudadanos, mostrando únicamente sus propios reportes en la UI.
- Se habilitó la resolución de reportes pendientes para operadores y administradores desde la vista de reportes.
- Se integró exportación de reportes y métricas a CSV desde los paneles de reportes y analytics.
- Se implementó exportación a PDF para reportes y métricas mediante impresión en PDF desde la UI.
- Se amplió el panel de analytics con métricas operativas reales, resumen de reportes y estado de recolección.
- Se añadieron scripts de respaldo y restauración de PostgreSQL (`scripts/db-backup.ps1` y `scripts/db-restore.ps1`) y se documentó el procedimiento en `README.md` y `docs/DESPLIEGUE.md`.
- Se corrigió `database/seed.sql` para insertar usuarios antes de las notificaciones y evitar que el contenedor PostgreSQL se detenga en el arranque.

## 2026-07-18

### Hitos completados
- Integración de autenticación segura en `backend-python/app/main.py` con JWT y roles (`ciudadano`, `operador`, `admin`, `conductor`).
- Implementación de alertas operativas y monitoreo de contenedores, mantenimiento y notificaciones.
- Desarrollo de priorización de zonas críticas y optimización de rutas para el despacho.
- Generación de un plan de intervención automático para dar soporte operativo inmediato.
- Dashboard React en `frontend/src/main.tsx` con vista operativa, alertas y tablero de despacho.
- Conexión del dashboard del frontend con el endpoint real `/api/operations/monitor`.
- Añadido endpoint operativo `POST /api/operations/update` para registrar eventos de ruta y de contenedor y refrescar el monitor en vivo.
- Corregido el retorno de monitor de actualizaciones de contenedor para devolver el nivel de llenado almacenado y evitar simulación adicional en el evento de actualización.
- Añadido `httpx2` a `backend-python/requirements.txt` para asegurar que las pruebas de FastAPI funcionen correctamente.
- Fortalecido el valor por defecto de `JWT_SECRET` y recomendado usar una variable de entorno segura en producción.
- Añadido soporte de datos iniciales PostgreSQL para `containers`, `notifications` y `maintenance_records` en `database/seed.sql`.
- Actualización de `README.md` para documentar el estado actual, la arquitectura y los próximos pasos.
- Integración avanzada del frontend con `monitor.truck_assignments` para reflejar el despacho en vivo y priorizar rutas reales.
- Añadido soporte de simulación operativa en el backend para avance de rutas, actualización de estados de atraso y llenado de contenedores.
- Agregadas pruebas de backend para validación de la simulación de rutas, contenedores y métricas de desempeño.
- Añadidas pruebas end-to-end de API para validar el flujo completo de `POST /api/operations/update`, `GET /api/operations/monitor`, `/api/routes` y `/api/bootstrap`.
- Añadida prueba de UI del frontend en `frontend/src/Operations.test.tsx` para validar la experiencia de eventos operativos en el dashboard.
- Ampliada la cobertura de la prueba UI para validar también la actualización de rutas (`route_update`).
- Añadida segunda prueba de integración de aplicación completa en `frontend/src/App.test.tsx` para validar también la actualización de contenedor (`container_update`) contra el backend FastAPI real.
- Añadida prueba de integración de aplicación completa en `frontend/src/App.test.tsx` para el flujo UI → backend FastAPI real, incluyendo autenticación, monitor y actualización de operación.
- Verificada compilación de producción del frontend con `npm run build`.
- Añadido comando raíz `npm run check:all` para validar frontend y backend juntos.
- Añadido prueba de health endpoint para `/api/health`.
- Confirmado `pytest -q` con 16 pruebas aprobadas y `npx vitest run` con 3 pruebas de frontend exitosas.
- Se completó la interfaz de recuperación de contraseña en el frontend con solicitud y uso de token, además de la persistencia y limpieza de tokens de reset en el backend con soporte para PostgreSQL.
- Se añadió un panel de administración de usuarios en el frontend con creación de cuentas, listado de usuarios y cambio de roles, accesible solo para administradores y conectado a los endpoints protegidos del backend.

### Próximos pasos
- ~~Validar accesibilidad y experiencia móvil en el panel administrativo~~ Completado el 2026-07-30.
- Ejecutar despliegue manual en Render/Vercel o Railway/Vercel usando la rama `v2.0.0-deploy-config` y configurar `JWT_SECRET` y `DATABASE_URL` seguros en producción (checklist detallado en `docs/DESPLIEGUE.md`).
