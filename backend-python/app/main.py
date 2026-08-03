"""Punto de entrada de la API.

Este módulo solo ensambla la aplicación: crea FastAPI, configura CORS y monta
los routers. La lógica vive en `services/` (dominio), `repositories/`
(persistencia) y `routers/` (HTTP).

El nombre `app.main:app` es un contrato con el despliegue: el `CMD` del
Dockerfile arranca `uvicorn app.main:app`, así que no debe moverse.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import APP_TITLE, APP_VERSION, cors_origin_regex, cors_origins
from app.routers import (
    analytics,
    auth,
    collections,
    health,
    operations,
    reports,
    schedules,
    trucks,
    users,
    zones,
)

app = FastAPI(title=APP_TITLE, version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_origin_regex=cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    health.router,
    auth.router,
    users.router,
    zones.router,
    schedules.router,
    trucks.router,
    reports.router,
    collections.router,
    analytics.router,
    operations.router,
):
    app.include_router(router)
