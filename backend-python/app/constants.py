"""Vocabulario del dominio.

Los roles, estados y umbrales estaban repetidos como literales por todo
`main.py`, donde un typo abría o cerraba permisos en silencio.
"""

from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """Roles del sistema."""

    CIUDADANO = "ciudadano"
    OPERADOR = "operador"
    ADMIN = "admin"
    CONDUCTOR = "conductor"


#: Rol asignado a quien se registra por el formulario público.
PUBLIC_REGISTRATION_ROLE = Role.CIUDADANO.value

#: Quiénes pueden gestionar la operación (resolver reportes, registrar eventos).
OPERATIONAL_ROLES = {Role.OPERADOR.value, Role.ADMIN.value}

#: Quiénes administran catálogos y usuarios.
ADMIN_ROLES = {Role.ADMIN.value}

# Estados del dominio.
TRUCK_STATUS_ON_ROUTE = "En ruta"
REPORT_STATUS_PENDING = "Pendiente"
REPORT_STATUS_RESOLVED = "Resuelto"
COLLECTION_STATUS_CONFIRMED = "Confirmada"
COLLECTION_STATUS_CONFIRMED_BY_CITIZEN = "Confirmada por ciudadano"
CONTAINER_STATUS_OK = "Operativo"
CONTAINER_STATUS_FULL = "Lleno"

# Umbrales operativos: ajustar cuándo se avisa se hace desde aquí.
CONTAINER_FILL_CRITICAL = 85
CONTAINER_FILL_WARNING = 70
CONTAINER_FILL_CONSIDERED_FULL = 90
ROUTE_PROGRESS_LOW = 40


def normalize_role(role: str) -> str:
    """Devuelve un rol válido; cualquier valor desconocido cae a ciudadano."""
    role_value = (role or PUBLIC_REGISTRATION_ROLE).strip().lower()
    valid = {item.value for item in Role}
    return role_value if role_value in valid else PUBLIC_REGISTRATION_ROLE
