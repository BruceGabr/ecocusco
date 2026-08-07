"""Vocabulario del dominio.

Los roles, estados y umbrales estaban repetidos como literales por todo
`main.py`, donde un typo abría o cerraba permisos en silencio.
"""

from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """Roles del sistema.

    Hubo un cuarto rol, `operador`, pensado para el personal del municipio.
    Se retiró porque en la práctica hacía exactamente lo mismo que `admin`:
    dos nombres para el mismo conjunto de permisos solo generaban dudas sobre
    a quién dar de alta como qué.
    """

    CIUDADANO = "ciudadano"
    ADMIN = "admin"
    CONDUCTOR = "conductor"


#: Rol asignado a quien se registra por el formulario público.
PUBLIC_REGISTRATION_ROLE = Role.CIUDADANO.value

#: Quiénes pueden gestionar la operación (resolver reportes, registrar eventos).
OPERATIONAL_ROLES = {Role.ADMIN.value}

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

#: Radio en metros dentro del cual se avisa de un camión o una zona cercana.
PROXIMITY_RADIUS_M = 500
#: Por debajo de esta distancia el aviso sube de tono a "muy cercano".
PROXIMITY_VERY_NEAR_M = 200
#: Límites admitidos para el radio que puede pedir el cliente.
PROXIMITY_RADIUS_MIN_M = 10
PROXIMITY_RADIUS_MAX_M = 5000

# --- Aviso al móvil del ciudadano ------------------------------------------
#
# El requisito es avisar "dos cuadras antes". En el damero del Cusco una cuadra
# ronda los 80 m, así que dos son unos 160. Se mide contra la última posición
# conocida del ciudadano, no contra el centro de su zona: "dos cuadras" solo
# significa algo respecto de dónde está la persona.
PUSH_ALERT_RADIUS_M = 160

#: Distancia a partir de la cual se considera que el camión ya se alejó y el
#: aviso puede volver a emitirse. Con histéresis: si el umbral de salida fuera
#: el mismo que el de entrada, una lectura oscilando alrededor de 160 m
#: dispararía una notificación tras otra.
PUSH_ALERT_RESET_M = 400

#: Antigüedad máxima de la ubicación de un ciudadano para tenerla en cuenta.
#: Una posición de hace horas ya no dice dónde está.
USER_LOCATION_MAX_AGE_MINUTES = 120


def normalize_role(role: str) -> str:
    """Devuelve un rol válido; cualquier valor desconocido cae a ciudadano."""
    role_value = (role or PUBLIC_REGISTRATION_ROLE).strip().lower()
    valid = {item.value for item in Role}
    return role_value if role_value in valid else PUBLIC_REGISTRATION_ROLE
