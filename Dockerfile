FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias
COPY backend-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar codigo del backend
COPY backend-python/ .

# Puerto expuesto por Railway via $PORT
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
