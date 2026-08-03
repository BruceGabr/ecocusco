"""Almacén en memoria para el modo demostración.

Permite levantar la API sin PostgreSQL, con el catálogo de ejemplo de Cusco.
Los datos viven en el proceso: se pierden al reiniciar.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.constants import Role
from app.security import hash_password
from app.services.metrics import build_analytics


#: Credenciales del administrador de demostración. Solo se usan sin base de datos.
DEMO_ADMIN_EMAIL = "admin@ecocusco.pe"
DEMO_ADMIN_PASSWORD = "admin123"


class MemoryStore:
    def __init__(self) -> None:
        self.zones = [
            {"id": 1, "name": "Centro Historico", "latitude": -13.5166, "longitude": -71.9789, "criticality": "Alta"},
            {"id": 2, "name": "Wanchaq", "latitude": -13.5256, "longitude": -71.9558, "criticality": "Alta"},
            {"id": 3, "name": "San Sebastian", "latitude": -13.5309, "longitude": -71.9386, "criticality": "Media"},
            {"id": 4, "name": "San Jeronimo", "latitude": -13.5439, "longitude": -71.8889, "criticality": "Media"},
            {"id": 5, "name": "Santiago", "latitude": -13.5350, "longitude": -71.9847, "criticality": "Alta"},
        ]
        self.schedules = [
            {"id": 1, "zone_id": 1, "zone": "Centro Historico", "day": "Lunes, miercoles y viernes", "time": "06:30 - 08:30", "waste": "Organico y reciclable"},
            {"id": 2, "zone_id": 2, "zone": "Wanchaq", "day": "Martes, jueves y sabado", "time": "07:00 - 09:00", "waste": "No reciclable y reciclable"},
            {"id": 3, "zone_id": 3, "zone": "San Sebastian", "day": "Lunes, jueves y sabado", "time": "05:30 - 07:30", "waste": "Organico"},
            {"id": 4, "zone_id": 4, "zone": "San Jeronimo", "day": "Miercoles y sabado", "time": "08:00 - 10:00", "waste": "Mixto segregado"},
            {"id": 5, "zone_id": 5, "zone": "Santiago", "day": "Martes y viernes", "time": "06:00 - 08:00", "waste": "Reciclable"},
        ]
        self.trucks = [
            {"id": 1, "code": "C-01", "driver": "Luis Huaman", "status": "En ruta", "zone_id": 1, "zone": "Centro Historico", "latitude": -13.5166, "longitude": -71.9789},
            {"id": 2, "code": "C-02", "driver": "Rosa Ccahuana", "status": "En ruta", "zone_id": 2, "zone": "Wanchaq", "latitude": -13.5256, "longitude": -71.9558},
            {"id": 3, "code": "C-03", "driver": "Mario Quispe", "status": "Mantenimiento", "zone_id": 3, "zone": "San Sebastian", "latitude": -13.5309, "longitude": -71.9386},
        ]
        self.routes = [
            {"id": 1, "truck": "C-02", "zone": "Wanchaq", "progress": 62, "eta": "12 min", "delay": "Sin retraso", "latitude": -13.5256, "longitude": -71.9558},
            {"id": 2, "truck": "C-01", "zone": "Centro Historico", "progress": 86, "eta": "5 min", "delay": "Sin retraso", "latitude": -13.5166, "longitude": -71.9789},
            {"id": 3, "truck": "C-04", "zone": "Santiago", "progress": 31, "eta": "28 min", "delay": "Retraso moderado", "latitude": -13.5350, "longitude": -71.9847},
        ]
        self.containers = [
            {"id": 1, "zone_id": 1, "name": "Contenedor Centro", "fill_level": 88, "status": "Lleno", "updated_at": datetime.now(timezone.utc).isoformat()},
            {"id": 2, "zone_id": 2, "name": "Contenedor Wanchaq", "fill_level": 64, "status": "Operativo", "updated_at": datetime.now(timezone.utc).isoformat()},
        ]
        self.reports = [
            {"id": 1, "citizen": "Ana Quispe", "zone": "Wanchaq", "type": "Acumulacion de basura", "detail": "Contenedor lleno cerca al mercado.", "status": "En revision"},
            {"id": 2, "citizen": "Jose Huaman", "zone": "Santiago", "type": "Retraso", "detail": "No paso el camion en el horario indicado.", "status": "Pendiente"},
        ]
        self.collections = [
            {"id": 1, "zone": "Centro Historico", "truck": "C-01", "kg": 420, "status": "Confirmada", "date": "2026-06-10"},
            {"id": 2, "zone": "Wanchaq", "truck": "C-02", "kg": 360, "status": "Confirmada", "date": "2026-06-10"},
            {"id": 3, "zone": "Santiago", "truck": "C-04", "kg": 210, "status": "Parcial", "date": "2026-06-09"},
        ]
        self.maintenance = [
            {"id": 1, "truck_id": 3, "description": "Revisión general de frenos", "status": "Pendiente", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        self.notifications = [
            {"id": 1, "user_id": 1, "title": "Ruta ajustada", "message": "Se priorizará la zona de Santiago por retrasos", "type": "info", "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        self.users: list[dict[str, Any]] = [
            {
                "id": 1,
                "name": "Administrador EcoCusco",
                "email": DEMO_ADMIN_EMAIL,
                "role": Role.ADMIN.value,
                "zone": "Centro Historico",
                "password_hash": hash_password(DEMO_ADMIN_PASSWORD),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ]
        self.password_resets: dict[str, dict[str, Any]] = {}

    def analytics(self) -> dict[str, Any]:
        # Delega en la misma función que usa el modo PostgreSQL: antes había dos
        # copias del cálculo que podían divergir (y ambas devolvían el 87 fijo).
        return build_analytics(
            zones=self.zones,
            trucks=self.trucks,
            reports=self.reports,
            collections=self.collections,
            routes=self.routes,
        )


#: Instancia compartida por toda la aplicación en modo demostración.
memory = MemoryStore()


def memory_payload() -> dict[str, Any]:
    return {
        "zones": memory.zones,
        "schedules": memory.schedules,
        "trucks": memory.trucks,
        "routes": memory.routes,
        "reports": memory.reports,
        "collections": memory.collections,
        "analytics": memory.analytics(),
    }
