"""Qué parte de los datos puede ver cada rol.

`/api/bootstrap` devolvía el listado completo de usuarios con sus correos,
todos los reportes ciudadanos y las notificaciones de todo el mundo.
"""

from __future__ import annotations

from typing import Any

from app.constants import ADMIN_ROLES, PUBLIC_REGISTRATION_ROLE, Role, normalize_role
from app.repositories.bootstrap import bootstrap


def visible_reports_for(user: dict[str, Any], reports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Un ciudadano solo ve sus propios reportes; el resto de roles los ve todos.

    Nota: el filtro compara por NOMBRE porque `reports.citizen` guarda el nombre
    y no el id del usuario. Dos ciudadanos homónimos ven los reportes del otro.
    El arreglo de fondo (FK a users) está en la Fase 5 del plan.
    """
    if normalize_role(str(user.get("role", PUBLIC_REGISTRATION_ROLE))) != Role.CIUDADANO.value:
        return reports
    own_name = str(user.get("name", "")).strip().lower()
    return [report for report in reports if str(report.get("citizen", "")).strip().lower() == own_name]


def visible_notifications_for(user: dict[str, Any], notifications: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Notificaciones propias más las de difusión (sin destinatario).

    Antes se devolvían todas a todo el mundo, así que cualquier usuario leía los
    avisos dirigidos a los demás.
    """
    user_id = user.get("id")
    return [
        item
        for item in notifications
        if item.get("user_id") is None or item.get("user_id") == user_id
    ]


def bootstrap_for(user: dict[str, Any]) -> dict[str, Any]:
    """Carga inicial recortada a lo que el usuario tiene derecho a ver.

    `/api/bootstrap` era anónimo y devolvía el listado completo de usuarios con
    sus correos, todos los reportes ciudadanos y todas las notificaciones.
    """
    data = bootstrap()
    data["reports"] = visible_reports_for(user, data.get("reports", []))
    data["notifications"] = visible_notifications_for(user, data.get("notifications", []))
    if normalize_role(str(user.get("role", PUBLIC_REGISTRATION_ROLE))) not in ADMIN_ROLES:
        data["users"] = []
    return data
