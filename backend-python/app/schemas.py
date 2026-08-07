"""Contratos de entrada de la API.

Validan y normalizan lo que llega en el cuerpo de cada petición antes de que
toque la lógica de negocio.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.constants import (
    PROXIMITY_RADIUS_M,
    PROXIMITY_RADIUS_MAX_M,
    PROXIMITY_RADIUS_MIN_M,
    PUBLIC_REGISTRATION_ROLE,
)

#: Longitudes admitidas para una contraseña.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 120


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    role: str = Field(default=PUBLIC_REGISTRATION_ROLE)
    zone: str = Field(default="Centro Historico", min_length=2, max_length=80)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=4, max_length=200)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)


class ReportCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    citizen: str = Field(min_length=2, max_length=120)
    zone: str = Field(min_length=2, max_length=80)
    type: str = Field(min_length=2, max_length=80)
    detail: str = Field(min_length=8, max_length=600)


class OperationUpdateRequest(BaseModel):
    type: str = Field(min_length=1, max_length=40)
    id: int
    progress: int | None = None
    delay: str | None = None
    fill_level: int | None = None
    status: str | None = None
    note: str | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    role: str | None = None
    zone: str | None = Field(default=None, min_length=2, max_length=80)


class ZoneCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    latitude: float
    longitude: float
    criticality: str = Field(default="Media", min_length=2, max_length=40)


class ZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    latitude: float | None = None
    longitude: float | None = None
    criticality: str | None = Field(default=None, min_length=2, max_length=40)


class ScheduleCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    zone_id: int
    day: str = Field(min_length=2, max_length=120)
    time: str = Field(min_length=2, max_length=80)
    waste: str = Field(min_length=2, max_length=120)


class ScheduleUpdate(BaseModel):
    zone_id: int | None = None
    day: str | None = Field(default=None, min_length=2, max_length=120)
    time: str | None = Field(default=None, min_length=2, max_length=80)
    waste: str | None = Field(default=None, min_length=2, max_length=120)


class TruckCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(min_length=2, max_length=20)
    driver: str = Field(min_length=2, max_length=120)
    status: str = Field(min_length=2, max_length=60)
    zone_id: int
    latitude: float
    longitude: float


class TruckUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=20)
    driver: str | None = Field(default=None, min_length=2, max_length=120)
    status: str | None = Field(default=None, min_length=2, max_length=60)
    zone_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None


class MaintenanceCreate(BaseModel):
    truck_id: int
    description: str = Field(min_length=3, max_length=600)
    status: str = Field(default="Pendiente", min_length=2, max_length=60)


class MaintenanceUpdate(BaseModel):
    truck_id: int | None = None
    description: str | None = Field(default=None, min_length=3, max_length=600)
    status: str | None = Field(default=None, min_length=2, max_length=60)


class CollectionCreate(BaseModel):
    truck_id: int
    zone_id: int
    kg: int = Field(default=0, ge=0)
    status: str = Field(default="Confirmada", min_length=2, max_length=60)


class ProximityCheckRequest(BaseModel):
    """Punto desde el que se consulta qué camiones hay cerca."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(
        default=PROXIMITY_RADIUS_M,
        ge=PROXIMITY_RADIUS_MIN_M,
        le=PROXIMITY_RADIUS_MAX_M,
    )


class RouteSessionStart(BaseModel):
    """Apertura de una sesión de ruta desde la app del conductor.

    `truck_id` es opcional: si no llega, se resuelve el camión asignado al
    conductor por su nombre, que es como los relaciona la ficha del vehículo.
    """

    truck_id: int | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class PositionReport(BaseModel):
    """Un punto del recorrido tal como lo informa el GPS del móvil."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0)
    speed_mps: float | None = Field(default=None, ge=0)


class UserLocationReport(BaseModel):
    """Última posición conocida del ciudadano, para medir la proximidad."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0)


class PushTokenRegister(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    token: str = Field(min_length=10, max_length=200)
    platform: str | None = Field(default=None, max_length=20)


class BulkActionRequest(BaseModel):
    """Acción masiva sobre un catálogo del panel de administración."""

    model_config = ConfigDict(str_strip_whitespace=True)

    resource: str = Field(min_length=1, max_length=40)
    action: str = Field(min_length=1, max_length=20)
    ids: list[int] = Field(min_length=1)
