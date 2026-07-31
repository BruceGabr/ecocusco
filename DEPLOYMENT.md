# Despliegue publico

Esta guia deja el proyecto accesible desde internet para compartirlo por WhatsApp.

## 1. Subir el codigo a GitHub

Confirma que tus cambios estan en GitHub antes de importar el proyecto:

```powershell
git add .
git commit -m "Prepare public deployment"
git push origin version-1-proyecto
```

## 2. Backend en Render

1. Entra a https://dashboard.render.com/.
2. Crea un nuevo Blueprint.
3. Conecta el repositorio `Sistema-de-Recoleccion-de-Residuos-Solidos`.
4. Render detectara `render.yaml` y creara dos servicios:
   - `sir-cusco-api`
   - `sir-cusco-geo`
5. Espera a que ambos servicios queden en estado `Live`.
6. Copia las URLs publicas. Deben parecerse a:
   - `https://sir-cusco-api.onrender.com`
   - `https://sir-cusco-geo.onrender.com`

Verifica:

```text
https://sir-cusco-api.onrender.com/api/health
https://sir-cusco-geo.onrender.com/health
```

## 3. Frontend en Vercel

1. Entra a https://vercel.com/new.
2. Importa el mismo repositorio.
3. Vercel usara `vercel.json`.
4. Antes de desplegar, agrega estas variables de entorno:

```text
VITE_API_URL=https://sir-cusco-api.onrender.com/api
VITE_GEO_URL=https://sir-cusco-geo.onrender.com
```

Usa las URLs reales que Render te dio.

5. Despliega el proyecto.
6. Comparte por WhatsApp la URL final de Vercel, por ejemplo:

```text
https://sir-cusco.vercel.app
```

## Notas

- Render en plan gratis puede dormir los servicios tras inactividad; la primera carga puede tardar.
- El backend funciona en modo demo/memoria si no configuras PostgreSQL.
- Si luego agregas dominio propio, actualiza `CORS_ORIGINS` en Render con la URL final del frontend.
