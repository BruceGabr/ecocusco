"""Operaciones masivas sobre los catálogos del panel de administración.

Borrar veinte registros uno a uno eran veinte peticiones y veinte
confirmaciones. Aquí se agrupan en una sola llamada.

No se escribe SQL propio: cada recurso delega en la función de borrado que ya
tiene su repositorio, así que el modo memoria y el modo PostgreSQL siguen
comportándose igual sin duplicar la lógica de caída a memoria.
"""

from __future__ import annotations

from typing import Any, Callable

from fastapi import HTTPException

from app.repositories.maintenance import delete_maintenance
from app.repositories.schedules import delete_schedule
from app.repositories.trucks import delete_truck
from app.repositories.users import delete_user
from app.repositories.zones import delete_zone

#: Única acción admitida hoy. Se valida por nombre para que añadir otra
#: (archivar, reasignar) sea explícito y no un efecto colateral.
BULK_ACTION_DELETE = "delete"

#: Recursos que aceptan borrado masivo. La clave es la que envía el frontend.
DELETERS: dict[str, Callable[[int], None]] = {
    "users": delete_user,
    "zones": delete_zone,
    "schedules": delete_schedule,
    "trucks": delete_truck,
    "maintenance": delete_maintenance,
}


def bulk_delete(resource: str, ids: list[int]) -> dict[str, Any]:
    """Borra varios registros del mismo recurso.

    Devuelve qué ids se borraron y cuáles fallaron en vez de abortar en el
    primero: si un registro ya no existe, el resto de la selección debe
    eliminarse igual.
    """
    delete = DELETERS.get(resource)
    if delete is None:
        raise HTTPException(status_code=400, detail=f"Recurso no soportado: {resource}")

    deleted: list[int] = []
    failed: list[int] = []
    for item_id in ids:
        try:
            delete(int(item_id))
            deleted.append(int(item_id))
        except Exception:
            failed.append(int(item_id))

    return {
        "resource": resource,
        "deleted": deleted,
        "failed": failed,
        "count": len(deleted),
    }
