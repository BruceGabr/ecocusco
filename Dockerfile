# Imagen del backend FastAPI. Render construye desde este archivo, con el
# contexto en la raíz del repositorio (ver .dockerignore).
FROM python:3.11-slim

# - PYTHONDONTWRITEBYTECODE: no genera .pyc dentro del contenedor.
# - PYTHONUNBUFFERED: los logs llegan a Render en el momento, no por bloques.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Las dependencias se copian solas y antes del código: mientras
# requirements.txt no cambie, Docker reutiliza la capa de instalación y el
# despliegue no vuelve a compilar todo.
COPY backend-python/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend-python/ ./

# La aplicación no necesita privilegios de root para servir HTTP.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Render inyecta $PORT. Se usa `sh -c` porque la forma exec no expande
# variables de entorno, y el módulo debe seguir siendo `app.main:app`.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
