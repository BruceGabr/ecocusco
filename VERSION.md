# Sistema de Recolección de Residuos Sólidos - Versión 2.0.0

## Versión 2.0.0 - Lista para despliegue

Esta es la **versión 2.0.0** del Sistema Inteligente de Recolección de Residuos Sólidos para la Gestión Ambiental Urbana en la ciudad del Cusco.

### Características de esta versión
- Configuración de despliegue lista para producción (`render.yaml`, `railway.toml`, `vercel.json`).
- Variables de entorno documentadas y preparadas: `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`, `CORS_ORIGIN_REGEX`, `VITE_API_URL`, `VITE_GEO_URL`.
- Accesibilidad mejorada en el panel administrativo: contraste WCAG AA, skip-link, focus-visible, touch targets de 44px y prevención de scroll horizontal.
- Exportación a PDF para reportes y métricas desde la interfaz.
- Validación completa de backup/restore de PostgreSQL local con scripts PowerShell.
- Build del frontend verificado y pruebas automatizadas (`11 passed` frontend, `16 passed` backend).

### Rama de producción
- Rama: `v2.0.0-deploy-config`
- Repositorio: `Alejandro225425/Sistema-de-Recoleccion-de-Residuos-Solidos`

### Próximos pasos
- Ejecutar despliegue real en Render/Vercel o Railway/Vercel.
- Configurar `JWT_SECRET` y `DATABASE_URL` seguros en producción.
- Ajustar `CORS_ORIGINS` al dominio final del frontend.

## Versión 1.0.0

### Características de esta versión
- Estructura base del proyecto
- Frontend con React/TypeScript y Vite
- Backend con Python/FastAPI
- Servicio auxiliar de geolocalización en TypeScript
- Documentación inicial

### Próximos pasos
- Implementar funcionalidades completas
- Integrar base de datos PostgreSQL
- Desplegar en producción

## Estado actual
- Versión de demostración estable con frontend compilable y backend probado.
- Endpoint operativo `/api/operations/update` validado y funcionando en modo memoria y con persistencia PostgreSQL cuando `DATABASE_URL` está configurado.
- Backend Python verificado con `16 passed` en la suite de pruebas.
- Frontend React validado con pruebas e2e reales contra FastAPI y microservicio TypeScript compilado con éxito.