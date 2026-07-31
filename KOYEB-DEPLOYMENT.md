# Despliegue con Koyeb + Vercel

Koyeb se usara solo para el backend FastAPI. Para mantener el plan gratis, el backend Python tambien responde las rutas del servicio Geo.

## 1. Crear servicio backend en Koyeb

1. Entra a https://app.koyeb.com/.
2. Inicia sesion con GitHub.
3. Crea un nuevo Web Service.
4. Selecciona GitHub como origen.
5. Elige el repositorio:

```text
Alejandro225425/Sistema-de-Recoleccion-de-Residuos-Solidos
```

6. Elige la rama:

```text
version-1-proyecto
```

7. En Builder o Build settings activa Work directory y escribe:

```text
backend-python
```

8. Usa estos comandos:

```text
Build command:
pip install -r requirements.txt
```

```text
Run command:
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

9. En Environment variables agrega:

```text
CORS_ORIGIN_REGEX=https://.*\.vercel\.app
```

10. En Instance selecciona la opcion gratuita si aparece:

```text
free
```

11. Despliega el servicio.

Cuando termine, Koyeb te dara una URL similar a:

```text
https://sir-cusco-api-tuusuario.koyeb.app
```

Verifica estas rutas:

```text
https://sir-cusco-api-tuusuario.koyeb.app/api/health
https://sir-cusco-api-tuusuario.koyeb.app/alerts
```

## 2. Crear frontend en Vercel

1. Entra a https://vercel.com/new.
2. Importa el mismo repositorio.
3. Elige la rama:

```text
version-1-proyecto
```

4. Vercel usara `vercel.json`.
5. Antes de desplegar, agrega estas variables de entorno usando tu URL real de Koyeb:

```text
VITE_API_URL=https://sir-cusco-api-tuusuario.koyeb.app/api
VITE_GEO_URL=https://sir-cusco-api-tuusuario.koyeb.app
```

6. Dale clic a Deploy.

## 3. Link para WhatsApp

Al terminar, Vercel te dara una URL como:

```text
https://sistema-de-recoleccion-de-residuos-solidos.vercel.app
```

Ese es el link que debes compartir por WhatsApp.

## Nota sobre costos

Koyeb indica que el plan gratis incluye un web service `free`, pero tambien indica que puede pedir tarjeta para validacion de cuenta. Si te pide tarjeta y no quieres ingresarla, usa Cloudflare Tunnel como alternativa temporal.
