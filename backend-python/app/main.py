from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # pragma: no cover - allows demo mode before installing DB deps
    psycopg = None
    dict_row = None

import bcrypt
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=8, max_length=120)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=120)
    role: str = Field(default="ciudadano")
    zone: str = Field(default="Centro Historico", min_length=2, max_length=80)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=4, max_length=200)
    password: str = Field(min_length=8, max_length=120)


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
                "email": "admin@ecocusco.pe",
                "role": "admin",
                "zone": "Centro Historico",
                "password_hash": hash_password("admin123"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ]
        self.password_resets: dict[str, dict[str, Any]] = {}

    def analytics(self) -> dict[str, Any]:
        return {
            "zones": len(self.zones),
            "active_trucks": len([truck for truck in self.trucks if truck["status"] == "En ruta"]),
            "open_reports": len([report for report in self.reports if report["status"] != "Resuelto"]),
            "confirmed_collections": len([collection for collection in self.collections if collection["status"] == "Confirmada"]),
            "total_kg": sum(collection["kg"] for collection in self.collections),
            "compliance": 87,
        }


def cors_origins() -> list[str]:
    return [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]


app = FastAPI(title="SIR Cusco API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


memory = MemoryStore()


_DEV_JWT_SECRET = "dev-secret-change-me-change-this-to-a-strong-secret-123456"


def _resolve_jwt_secret() -> str:
    """Resuelve la clave de firma JWT.

    El valor por defecto está publicado en el repositorio: si un despliegue lo
    usara, cualquiera podría firmar tokens de administrador. Por eso solo se
    admite en desarrollo local, y se considera "desplegado" cuando hay
    DATABASE_URL o APP_ENV distinto de development.
    """
    secret = os.getenv("JWT_SECRET", "").strip()
    if secret:
        return secret

    app_env = os.getenv("APP_ENV", "development").strip().lower()
    is_deployed = bool(os.getenv("DATABASE_URL", "").strip()) or app_env not in ("development", "dev", "local", "test")
    if is_deployed:
        raise RuntimeError(
            "JWT_SECRET no está definido. Define una clave secreta fuerte en las "
            "variables de entorno antes de desplegar (el valor por defecto es público)."
        )

    print(
        "ADVERTENCIA: usando JWT_SECRET de desarrollo. No despliegues sin definir "
        "la variable de entorno JWT_SECRET.",
        flush=True,
    )
    return _DEV_JWT_SECRET


JWT_SECRET = _resolve_jwt_secret()
JWT_ALGORITHM = "HS256"


def database_url() -> Optional[str]:
    return os.getenv("DATABASE_URL")


def database_mode() -> str:
    if database_url() and psycopg is not None:
        try:
            with psycopg.connect(database_url(), connect_timeout=2) as conn:
                with conn.cursor() as cur:
                    cur.execute("select 1")
            return "postgresql"
        except Exception:
            return "memory (postgresql no disponible)"
    if database_url() and psycopg is None:
        return "memory (psycopg no instalado)"
    return "memory"


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


def eta_minutes(route: dict[str, Any]) -> int:
    eta = str(route.get("eta", "0 min")).split()[0]
    try:
        return int(eta)
    except ValueError:
        return 0


def route_is_delayed(route: dict[str, Any]) -> bool:
    delay_text = str(route.get("delay", "")).strip().lower()
    if not delay_text:
        return False
    if "sin retraso" in delay_text:
        return False
    return "retraso" in delay_text or "tarde" in delay_text


def geo_trucks() -> list[dict[str, Any]]:
    routes = bootstrap()["routes"]
    return [
        {
            "code": route["truck"],
            "zone": route["zone"],
            "latitude": route["latitude"],
            "longitude": route["longitude"],
            "progress": route["progress"],
            "etaMinutes": eta_minutes(route),
        }
        for route in routes
    ]


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    if not database_url() or psycopg is None:
        raise RuntimeError("PostgreSQL no disponible")
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return list(cur.fetchall())


def execute_one(query: str, params: tuple[Any, ...]) -> dict[str, Any]:
    if not database_url() or psycopg is None:
        raise RuntimeError("PostgreSQL no disponible")
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
            conn.commit()
            if row is None:
                raise HTTPException(status_code=404, detail="Registro no encontrado")
            return dict(row)


def normalize_dates(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for row in rows:
        for key, value in list(row.items()):
            if isinstance(value, (date, datetime)):
                row[key] = value.isoformat()
    return rows


def analytics_from(rows: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    collections = rows["collections"]
    reports = rows["reports"]
    trucks = rows["trucks"]
    return {
        "zones": len(rows["zones"]),
        "active_trucks": len([truck for truck in trucks if truck["status"] == "En ruta"]),
        "open_reports": len([report for report in reports if report["status"] != "Resuelto"]),
        "confirmed_collections": len([collection for collection in collections if collection["status"] == "Confirmada"]),
        "total_kg": sum(collection["kg"] for collection in collections),
        "compliance": 87,
    }


def normalize_role(role: str) -> str:
    role_value = (role or "ciudadano").strip().lower()
    return role_value if role_value in {"ciudadano", "operador", "admin", "conductor"} else "ciudadano"


def build_alerts(routes: list[dict[str, Any]], containers: list[dict[str, Any]] | None = None) -> list[str]:
    alerts: list[str] = []
    for route in routes:
        if route_is_delayed(route):
            alerts.append(f"{route['truck']} presenta retraso en {route['zone']}.")
        elif int(route.get("progress", 0)) < 40:
            alerts.append(f"{route['truck']} presenta posible retraso en {route['zone']} debido a bajo avance.")
    for container in containers or []:
        fill_level = int(container.get("fill_level", 0))
        if fill_level >= 85:
            alerts.append(f"Contenedor {container['name']} está casi lleno ({fill_level}%).")
        elif fill_level >= 70:
            alerts.append(f"Contenedor {container['name']} requiere revisión ({fill_level}%).")
    return alerts


def prioritize_zones(zones: list[dict[str, Any]], reports: list[dict[str, Any]], containers: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    containers = containers or []
    container_priority = {int(item.get("zone_id")): int(item.get("fill_level", 0)) for item in containers if item.get("zone_id") is not None}
    report_priority = {}
    for report in reports:
        zone_name = str(report.get("zone", "")).strip()
        if zone_name:
            report_priority[zone_name] = report_priority.get(zone_name, 0) + 1
    scored = []
    for zone in zones:
        zone_name = str(zone.get("name", ""))
        score = 0
        if str(zone.get("criticality", "")).lower() == "alta":
            score += 3
        elif str(zone.get("criticality", "")).lower() == "media":
            score += 1
        score += report_priority.get(zone_name, 0) * 2
        zone_id = zone.get("id")
        if zone_id in container_priority:
            score += min(3, container_priority[zone_id] // 30)
        scored.append({**zone, "priority_score": score})
    return sorted(scored, key=lambda item: item["priority_score"], reverse=True)


def optimize_routes(routes: list[dict[str, Any]], priority_zones: list[str] | None = None) -> list[dict[str, Any]]:
    priority_zones = priority_zones or []
    priority_set = {zone.lower() for zone in priority_zones}

    def route_priority(route: dict[str, Any]) -> tuple[int, int, int]:
        zone_name = str(route.get("zone", "")).lower()
        score = 0
        if zone_name in priority_set:
            score += 100
        if route_is_delayed(route):
            score += 50
        score += max(0, 100 - int(route.get("progress", 0)))
        return score, int(route.get("progress", 0)), int(route.get("id", 0))

    return sorted(routes, key=route_priority, reverse=True)


def suggest_truck_assignments(trucks: list[dict[str, Any]], optimized_routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    active_trucks = [truck for truck in trucks if str(truck.get("status", "")).lower() == "en ruta"]
    assignments = []
    for index, route in enumerate(optimized_routes[: len(active_trucks)]):
        truck = active_trucks[index] if index < len(active_trucks) else None
        priority_label = "Alta" if route_is_delayed(route) or int(route.get("progress", 0)) < 40 else "Media"
        assignments.append({
            "route_id": route.get("id"),
            "truck_code": truck.get("code") if truck else route.get("truck"),
            "zone": route.get("zone"),
            "priority": priority_label,
            "eta": route.get("eta"),
            "action": f"Atender {route.get('zone')} con prioridad {priority_label.lower()}",
        })
    return assignments


def build_intervention_plan(prioritized_zones: list[dict[str, Any]], optimized_routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    primary_zone = prioritized_zones[0] if prioritized_zones else None
    primary_route = optimized_routes[0] if optimized_routes else None
    if primary_zone:
        steps.append({
            "title": "Intervención prioritaria",
            "detail": f"Dirigir el equipo a {primary_zone['name']} porque tiene puntaje {primary_zone['priority_score']} y criticidad {primary_zone['criticality']}",
            "priority": "alta" if str(primary_zone.get("criticality", "")).lower() == "alta" else "media",
            "zone": primary_zone.get("name"),
        })
    if primary_route:
        steps.append({
            "title": "Asignación de ruta",
            "detail": f"{primary_route.get('truck')} debe atender {primary_route.get('zone')} con ETA {primary_route.get('eta')}",
            "priority": "alta" if "retraso" in str(primary_route.get("delay", "")).lower() or int(primary_route.get("progress", 0)) < 40 else "media",
            "route": primary_route.get("truck"),
        })
    if not steps:
        steps.append({
            "title": "Sin acciones pendientes",
            "detail": "No hay una intervención prioritaria en este momento.",
            "priority": "media",
            "zone": None,
        })
    return steps


def build_performance_metrics(routes: list[dict[str, Any]], reports: list[dict[str, Any]], containers: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    containers = containers or []
    total_routes = len(routes)
    delayed_routes = len([route for route in routes if route_is_delayed(route)])
    low_progress_routes = len([route for route in routes if int(route.get("progress", 0)) < 40])
    average_progress = round(sum(int(route.get("progress", 0)) for route in routes) / max(1, total_routes)) if total_routes else 0
    average_fill = round(sum(int(container.get("fill_level", 0)) for container in containers) / max(1, len(containers))) if containers else 0
    open_reports = len([report for report in reports if str(report.get("status", "")).lower() != "resuelto"])
    compliance_estimate = max(0, 100 - delayed_routes * 10 - low_progress_routes * 5)
    return {
        "total_routes": total_routes,
        "delayed_routes": delayed_routes,
        "low_progress_routes": low_progress_routes,
        "average_progress": average_progress,
        "open_reports": open_reports,
        "average_container_fill": average_fill,
        "compliance_estimate": compliance_estimate,
    }


def simulate_route_progress(routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    simulated: list[dict[str, Any]] = []
    for route in routes:
        progress = min(100, int(route.get("progress", 0)) + 10)
        if progress >= 100:
            delay = "Completado"
        elif progress > 70:
            delay = "Sin retraso"
        elif progress > 40:
            delay = "Retraso leve"
        else:
            delay = "Retraso moderado"
        simulated.append({
            **route,
            "progress": progress,
            "delay": delay,
        })
    return simulated


def simulate_container_fill(containers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    simulated: list[dict[str, Any]] = []
    for container in containers:
        fill_level = min(100, int(container.get("fill_level", 0)) + 5)
        status = "Lleno" if fill_level >= 90 else "Operativo"
        simulated.append({
            **container,
            "fill_level": fill_level,
            "status": status,
        })
    return simulated


def simulate_truck_positions(routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    simulated: list[dict[str, Any]] = []
    for route in routes:
        latitude = float(route.get("latitude", 0.0)) + 0.0015
        longitude = float(route.get("longitude", 0.0)) + 0.0012
        simulated.append({
            "code": route.get("truck"),
            "zone": route.get("zone"),
            "latitude": latitude,
            "longitude": longitude,
            "progress": int(route.get("progress", 0)),
            "etaMinutes": eta_minutes(route),
        })
    return simulated


def build_user_payload(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": normalize_role(str(user.get("role", "ciudadano"))),
        "zone": user.get("zone", "Centro Historico"),
        "created_at": user.get("created_at"),
    }


def create_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": normalize_role(str(user.get("role", "ciudadano"))),
        "name": user.get("name"),
        "zone": user.get("zone", "Centro Historico"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def get_user_record_by_email(email: str) -> Optional[dict[str, Any]]:
    try:
        row = execute_one(
            "select id, name, email, role, zone, password_hash, created_at from users where email = %s",
            (email,),
        )
        return row
    except Exception:
        for user in memory.users:
            if user["email"].lower() == email.lower():
                return user
        return None


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    row = get_user_record_by_email(email)
    if row is None:
        return None
    return build_user_payload(row)


def create_user_record(payload: RegisterRequest) -> dict[str, Any]:
    hashed = hash_password(payload.password)
    try:
        row = execute_one(
            "insert into users (name, email, role, zone, password_hash) values (%s, %s, %s, %s, %s) returning id, name, email, role, zone, created_at",
            (payload.name, payload.email, normalize_role(payload.role), payload.zone, hashed),
        )
        user = build_user_payload({**row, "password_hash": hashed})
        return user
    except Exception:
        user = {
            "id": len(memory.users) + 1,
            "name": payload.name,
            "email": payload.email,
            "role": normalize_role(payload.role),
            "zone": payload.zone,
            "password_hash": hashed,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        memory.users.append(user)
        return build_user_payload(user)


def list_users() -> list[dict[str, Any]]:
    try:
        rows = fetch_all("select id, name, email, role, zone, created_at from users order by id")
        return [build_user_payload(row) for row in rows]
    except Exception:
        return [build_user_payload(user) for user in memory.users]


def update_user(user_id: int, payload: UserUpdate) -> dict[str, Any]:
    try:
        if payload.name is not None:
            execute_one("update users set name = %s where id = %s", (payload.name, user_id))
        if payload.email is not None:
            execute_one("update users set email = %s where id = %s", (str(payload.email), user_id))
        if payload.role is not None:
            execute_one("update users set role = %s where id = %s", (normalize_role(payload.role), user_id))
        if payload.zone is not None:
            execute_one("update users set zone = %s where id = %s", (payload.zone, user_id))
        row = execute_one("select id, name, email, role, zone, created_at from users where id = %s", (user_id,))
        return build_user_payload(row)
    except Exception:
        for user in memory.users:
            if user["id"] == user_id:
                if payload.name is not None:
                    user["name"] = payload.name
                if payload.email is not None:
                    user["email"] = str(payload.email)
                if payload.role is not None:
                    user["role"] = normalize_role(payload.role)
                if payload.zone is not None:
                    user["zone"] = payload.zone
                return build_user_payload(user)
        raise HTTPException(status_code=404, detail="Usuario no encontrado")


def delete_user(user_id: int) -> None:
    try:
        execute_one("delete from users where id = %s", (user_id,))
    except Exception:
        memory.users = [user for user in memory.users if user["id"] != user_id]


def get_zone_name(zone_id: int | None) -> str | None:
    if zone_id is None:
        return None
    try:
        row = execute_one("select id, name from zones where id = %s", (zone_id,))
        return row.get("name")
    except Exception:
        for zone in memory.zones:
            if int(zone.get("id", 0)) == zone_id:
                return str(zone.get("name", ""))
        return None


def build_zone_payload(zone: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": zone.get("id"),
        "name": zone.get("name"),
        "latitude": zone.get("latitude"),
        "longitude": zone.get("longitude"),
        "criticality": zone.get("criticality", "Media"),
    }


def create_zone_record(payload: ZoneCreate) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into zones (name, latitude, longitude, criticality) values (%s, %s, %s, %s) returning id, name, latitude, longitude, criticality",
            (payload.name, payload.latitude, payload.longitude, payload.criticality),
        )
        return build_zone_payload(row)
    except Exception:
        zone = {
            "id": max([item["id"] for item in memory.zones], default=0) + 1,
            "name": payload.name,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "criticality": payload.criticality,
        }
        memory.zones.append(zone)
        return build_zone_payload(zone)


def update_zone(zone_id: int, payload: ZoneUpdate) -> dict[str, Any]:
    try:
        if payload.name is not None:
            execute_one("update zones set name = %s where id = %s", (payload.name, zone_id))
        if payload.latitude is not None:
            execute_one("update zones set latitude = %s where id = %s", (payload.latitude, zone_id))
        if payload.longitude is not None:
            execute_one("update zones set longitude = %s where id = %s", (payload.longitude, zone_id))
        if payload.criticality is not None:
            execute_one("update zones set criticality = %s where id = %s", (payload.criticality, zone_id))
        return build_zone_payload(execute_one("select id, name, latitude, longitude, criticality from zones where id = %s", (zone_id,)))
    except Exception:
        for zone in memory.zones:
            if zone["id"] == zone_id:
                if payload.name is not None:
                    zone["name"] = payload.name
                if payload.latitude is not None:
                    zone["latitude"] = payload.latitude
                if payload.longitude is not None:
                    zone["longitude"] = payload.longitude
                if payload.criticality is not None:
                    zone["criticality"] = payload.criticality
                return build_zone_payload(zone)
        raise HTTPException(status_code=404, detail="Zona no encontrada")


def delete_zone(zone_id: int) -> None:
    try:
        execute_one("delete from zones where id = %s", (zone_id,))
    except Exception:
        memory.zones = [zone for zone in memory.zones if zone["id"] != zone_id]


def build_schedule_payload(schedule: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": schedule.get("id"),
        "zone_id": schedule.get("zone_id"),
        "zone": schedule.get("zone") or get_zone_name(schedule.get("zone_id")),
        "day": schedule.get("day"),
        "time": schedule.get("time"),
        "waste": schedule.get("waste"),
    }


def create_schedule_record(payload: ScheduleCreate) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into schedules (zone_id, day, time, waste) values (%s, %s, %s, %s) returning id, zone_id, day, time, waste",
            (payload.zone_id, payload.day, payload.time, payload.waste),
        )
        return build_schedule_payload({**row, "zone": get_zone_name(payload.zone_id)})
    except Exception:
        schedule = {
            "id": max([item["id"] for item in memory.schedules], default=0) + 1,
            "zone_id": payload.zone_id,
            "zone": get_zone_name(payload.zone_id),
            "day": payload.day,
            "time": payload.time,
            "waste": payload.waste,
        }
        memory.schedules.append(schedule)
        return build_schedule_payload(schedule)


def update_schedule(schedule_id: int, payload: ScheduleUpdate) -> dict[str, Any]:
    try:
        if payload.zone_id is not None:
            execute_one("update schedules set zone_id = %s where id = %s", (payload.zone_id, schedule_id))
        if payload.day is not None:
            execute_one("update schedules set day = %s where id = %s", (payload.day, schedule_id))
        if payload.time is not None:
            execute_one("update schedules set time = %s where id = %s", (payload.time, schedule_id))
        if payload.waste is not None:
            execute_one("update schedules set waste = %s where id = %s", (payload.waste, schedule_id))
        row = execute_one("select id, zone_id, day, time, waste from schedules where id = %s", (schedule_id,))
        return build_schedule_payload({**row, "zone": get_zone_name(row.get("zone_id"))})
    except Exception:
        for schedule in memory.schedules:
            if schedule["id"] == schedule_id:
                if payload.zone_id is not None:
                    schedule["zone_id"] = payload.zone_id
                    schedule["zone"] = get_zone_name(payload.zone_id)
                if payload.day is not None:
                    schedule["day"] = payload.day
                if payload.time is not None:
                    schedule["time"] = payload.time
                if payload.waste is not None:
                    schedule["waste"] = payload.waste
                return build_schedule_payload(schedule)
        raise HTTPException(status_code=404, detail="Horario no encontrado")


def delete_schedule(schedule_id: int) -> None:
    try:
        execute_one("delete from schedules where id = %s", (schedule_id,))
    except Exception:
        memory.schedules = [schedule for schedule in memory.schedules if schedule["id"] != schedule_id]


def build_truck_payload(truck: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": truck.get("id"),
        "code": truck.get("code"),
        "driver": truck.get("driver"),
        "status": truck.get("status"),
        "zone_id": truck.get("zone_id"),
        "zone": truck.get("zone") or get_zone_name(truck.get("zone_id")),
        "latitude": truck.get("latitude"),
        "longitude": truck.get("longitude"),
    }


def create_truck_record(payload: TruckCreate) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into trucks (code, driver, status, zone_id, latitude, longitude) values (%s, %s, %s, %s, %s, %s) returning id, code, driver, status, zone_id, latitude, longitude",
            (payload.code, payload.driver, payload.status, payload.zone_id, payload.latitude, payload.longitude),
        )
        return build_truck_payload({**row, "zone": get_zone_name(payload.zone_id)})
    except Exception:
        truck = {
            "id": max([item["id"] for item in memory.trucks], default=0) + 1,
            "code": payload.code,
            "driver": payload.driver,
            "status": payload.status,
            "zone_id": payload.zone_id,
            "zone": get_zone_name(payload.zone_id),
            "latitude": payload.latitude,
            "longitude": payload.longitude,
        }
        memory.trucks.append(truck)
        return build_truck_payload(truck)


def update_truck(truck_id: int, payload: TruckUpdate) -> dict[str, Any]:
    try:
        if payload.code is not None:
            execute_one("update trucks set code = %s where id = %s", (payload.code, truck_id))
        if payload.driver is not None:
            execute_one("update trucks set driver = %s where id = %s", (payload.driver, truck_id))
        if payload.status is not None:
            execute_one("update trucks set status = %s where id = %s", (payload.status, truck_id))
        if payload.zone_id is not None:
            execute_one("update trucks set zone_id = %s where id = %s", (payload.zone_id, truck_id))
        if payload.latitude is not None:
            execute_one("update trucks set latitude = %s where id = %s", (payload.latitude, truck_id))
        if payload.longitude is not None:
            execute_one("update trucks set longitude = %s where id = %s", (payload.longitude, truck_id))
        row = execute_one("select id, code, driver, status, zone_id, latitude, longitude from trucks where id = %s", (truck_id,))
        return build_truck_payload({**row, "zone": get_zone_name(row.get("zone_id"))})
    except Exception:
        for truck in memory.trucks:
            if truck["id"] == truck_id:
                if payload.code is not None:
                    truck["code"] = payload.code
                if payload.driver is not None:
                    truck["driver"] = payload.driver
                if payload.status is not None:
                    truck["status"] = payload.status
                if payload.zone_id is not None:
                    truck["zone_id"] = payload.zone_id
                    truck["zone"] = get_zone_name(payload.zone_id)
                if payload.latitude is not None:
                    truck["latitude"] = payload.latitude
                if payload.longitude is not None:
                    truck["longitude"] = payload.longitude
                return build_truck_payload(truck)
        raise HTTPException(status_code=404, detail="Camión no encontrado")


def delete_truck(truck_id: int) -> None:
    try:
        execute_one("delete from trucks where id = %s", (truck_id,))
    except Exception:
        memory.trucks = [truck for truck in memory.trucks if truck["id"] != truck_id]


def build_maintenance_payload(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item.get("id"),
        "truck_id": item.get("truck_id"),
        "description": item.get("description"),
        "status": item.get("status"),
        "created_at": item.get("created_at"),
    }


def create_maintenance_record(payload: MaintenanceCreate) -> dict[str, Any]:
    try:
        row = execute_one(
            "insert into maintenance_records (truck_id, description, status, created_at) values (%s, %s, %s, %s) returning id, truck_id, description, status, created_at",
            (payload.truck_id, payload.description, payload.status, datetime.now(timezone.utc)),
        )
        return build_maintenance_payload(row)
    except Exception:
        item = {
            "id": max([item["id"] for item in memory.maintenance], default=0) + 1,
            "truck_id": payload.truck_id,
            "description": payload.description,
            "status": payload.status,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        memory.maintenance.append(item)
        return build_maintenance_payload(item)


def update_maintenance(maintenance_id: int, payload: MaintenanceUpdate) -> dict[str, Any]:
    try:
        if payload.truck_id is not None:
            execute_one("update maintenance_records set truck_id = %s where id = %s", (payload.truck_id, maintenance_id))
        if payload.description is not None:
            execute_one("update maintenance_records set description = %s where id = %s", (payload.description, maintenance_id))
        if payload.status is not None:
            execute_one("update maintenance_records set status = %s where id = %s", (payload.status, maintenance_id))
        row = execute_one("select id, truck_id, description, status, created_at from maintenance_records where id = %s", (maintenance_id,))
        return build_maintenance_payload(row)
    except Exception:
        for item in memory.maintenance:
            if item["id"] == maintenance_id:
                if payload.truck_id is not None:
                    item["truck_id"] = payload.truck_id
                if payload.description is not None:
                    item["description"] = payload.description
                if payload.status is not None:
                    item["status"] = payload.status
                return build_maintenance_payload(item)
        raise HTTPException(status_code=404, detail="Mantenimiento no encontrado")


def delete_maintenance(maintenance_id: int) -> None:
    try:
        execute_one("delete from maintenance_records where id = %s", (maintenance_id,))
    except Exception:
        memory.maintenance = [item for item in memory.maintenance if item["id"] != maintenance_id]


    def create_collection_record(payload: CollectionCreate, created_by: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            row = execute_one(
                "insert into collections (truck_id, zone_id, kg, status, date, created_by) values (%s, %s, %s, %s, %s, %s) returning id, kg, status, date, truck_id, zone_id",
                (payload.truck_id, payload.zone_id, payload.kg, payload.status, datetime.now(timezone.utc), created_by and created_by.get("id")),
            )
            return {
                "id": row.get("id"),
                "zone": get_zone_name(row.get("zone_id")),
                "truck": next((t.get("code") for t in bootstrap().get("trucks", []) if int(t.get("id", 0)) == int(row.get("truck_id", 0))), str(row.get("truck_id"))),
                "kg": row.get("kg"),
                "status": row.get("status"),
                "date": row.get("date"),
            }
        except Exception:
            new_id = max([c["id"] for c in memory.collections], default=0) + 1
            truck_code = next((t.get("code") for t in memory.trucks if int(t.get("id", 0)) == int(payload.truck_id)), str(payload.truck_id))
            zone_name = get_zone_name(payload.zone_id) or next((z.get("name") for z in memory.zones if int(z.get("id", 0)) == int(payload.zone_id)), str(payload.zone_id))
            item = {
                "id": new_id,
                "zone": zone_name,
                "truck": truck_code,
                "kg": payload.kg,
                "status": payload.status,
                "date": datetime.now(timezone.utc).date().isoformat(),
            }
            memory.collections.append(item)
            return item


    def confirm_collection_by_citizen(collection_id: int, citizen: dict[str, Any]) -> dict[str, Any]:
        try:
            if database_mode() == "postgresql":
                row = execute_one("update collections set status = %s where id = %s returning id, kg, status, date, truck_id, zone_id", ("Confirmada por ciudadano", collection_id))
                return {
                    "id": row.get("id"),
                    "zone": get_zone_name(row.get("zone_id")),
                    "truck": next((t.get("code") for t in bootstrap().get("trucks", []) if int(t.get("id", 0)) == int(row.get("truck_id", 0))), str(row.get("truck_id"))),
                    "kg": row.get("kg"),
                    "status": row.get("status"),
                    "date": row.get("date"),
                }
        except Exception:
            for col in memory.collections:
                if int(col.get("id", 0)) == int(collection_id):
                    col["status"] = "Confirmada por ciudadano"
                    return col
            raise HTTPException(status_code=404, detail="Recolección no encontrada")


def create_password_reset_token(email: str, token: str, expires_at: datetime) -> dict[str, Any]:
    try:
        return execute_one(
            "insert into password_reset_tokens (email, token, expires_at, created_at) values (%s, %s, %s, %s) returning id, email, token, expires_at",
            (email, token, expires_at, datetime.now(timezone.utc)),
        )
    except Exception:
        memory.password_resets[token] = {"email": email, "expires_at": expires_at.isoformat()}
        return {"id": len(memory.password_resets), "email": email, "token": token, "expires_at": expires_at.isoformat()}


def get_password_reset_entry(token: str) -> Optional[dict[str, Any]]:
    try:
        return execute_one(
            "select id, email, token, expires_at from password_reset_tokens where token = %s",
            (token,),
        )
    except Exception:
        return memory.password_resets.get(token)


def delete_password_reset_token(token: str) -> None:
    try:
        execute_one("delete from password_reset_tokens where token = %s", (token,))
    except Exception:
        memory.password_resets.pop(token, None)


def bootstrap() -> dict[str, Any]:
    try:
        rows = {
            "zones": fetch_all("select id, name, latitude, longitude, criticality from zones order by id"),
            "schedules": fetch_all("select s.id, z.name as zone, s.day, s.time, s.waste from schedules s join zones z on z.id = s.zone_id order by s.id"),
            "trucks": fetch_all("select t.id, t.code, t.driver, t.status, z.name as zone, t.latitude, t.longitude from trucks t join zones z on z.id = t.zone_id order by t.id"),
            "routes": fetch_all("select r.id, t.code as truck, z.name as zone, r.progress, r.eta, r.delay, r.latitude, r.longitude from routes r join trucks t on t.id = r.truck_id join zones z on z.id = r.zone_id order by r.id"),
            "reports": fetch_all("select id, citizen, zone, type, detail, status from reports order by id desc"),
            "collections": normalize_dates(fetch_all("select c.id, z.name as zone, t.code as truck, c.kg, c.status, c.date from collections c join zones z on z.id = c.zone_id join trucks t on t.id = c.truck_id order by c.date desc")),
            "users": list_users(),
            "containers": fetch_all("select id, zone_id, name, fill_level, status, updated_at from containers order by id"),
            "maintenance": fetch_all("select id, truck_id, description, status, created_at from maintenance_records order by id desc"),
            "notifications": fetch_all("select id, user_id, title, message, type, is_read, created_at from notifications order by id desc"),
        }
        rows["analytics"] = analytics_from(rows)
        return rows
    except Exception:
        payload = memory_payload()
        payload["users"] = list_users()
        payload["containers"] = memory.containers
        payload["maintenance"] = memory.maintenance
        payload["notifications"] = memory.notifications
        return payload


def require_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc
    user = get_user_by_email(str(payload.get("email", "")))
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


def require_role(allowed_roles: set[str]):
    def dependency(current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
        if normalize_role(str(current_user.get("role", "ciudadano"))) not in allowed_roles:
            raise HTTPException(status_code=403, detail="No autorizado para esta acción")
        return current_user

    return dependency


@app.get("/api/health")
def health() -> dict[str, str]:
    db_status = database_mode()
    return {
        "status": "ok",
        "database": db_status,
        "version": "1.0.0",
        "mode": "production" if db_status == "postgresql" else "demo"
    }


@app.get("/api/bootstrap")
def get_bootstrap() -> dict[str, Any]:
    return bootstrap()


@app.post("/api/auth/register")
def register(payload: RegisterRequest) -> dict[str, Any]:
    existing = get_user_by_email(str(payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Este correo ya está registrado")
    user = create_user_record(payload)
    token = create_token(user)
    return {"ok": True, "token": token, "user": user}


@app.post("/api/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    user_record = get_user_record_by_email(str(payload.email))
    if user_record is None:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    password_hash = user_record.get("password_hash") or ""
    user = build_user_payload(user_record)
    if not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_token(user)
    return {"ok": True, "token": token, "user": user}


@app.get("/api/auth/me")
def get_me(current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    return current_user


@app.post("/api/auth/forgot-password")
def forgot_password(payload: PasswordResetRequest) -> dict[str, Any]:
    user = get_user_by_email(str(payload.email))
    if user is None:
        return {"ok": True, "message": "Si el correo existe, se ha enviado un enlace de recuperación"}
    token = os.urandom(8).hex()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=20)
    create_password_reset_token(str(payload.email), token, expires_at)
    return {"ok": True, "token": token, "message": "Usa este token para restablecer la contraseña"}


@app.post("/api/auth/reset-password")
def reset_password(payload: PasswordResetConfirm) -> dict[str, Any]:
    entry = get_password_reset_entry(payload.token)
    if entry is None:
        raise HTTPException(status_code=400, detail="Token de recuperación inválido")
    expires_at = datetime.fromisoformat(str(entry["expires_at"]))
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token de recuperación expirado")
    email = str(entry["email"])
    user = get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    new_hash = hash_password(payload.password)
    try:
        execute_one("update users set password_hash = %s where email = %s", (new_hash, email))
    except Exception:
        for stored_user in memory.users:
            if stored_user["email"].lower() == email.lower():
                stored_user["password_hash"] = new_hash
                break
    delete_password_reset_token(payload.token)
    return {"ok": True, "message": "Contraseña actualizada correctamente"}


@app.get("/api/users", dependencies=[Depends(require_role({"admin"}))])
def get_users() -> list[dict[str, Any]]:
    return list_users()


@app.post("/api/users", dependencies=[Depends(require_role({"admin"}))])
def create_user(payload: RegisterRequest) -> dict[str, Any]:
    existing = get_user_by_email(str(payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Este correo ya está registrado")
    user = create_user_record(payload)
    return user


@app.patch("/api/users/{user_id}", dependencies=[Depends(require_role({"admin"}))])
def patch_user(user_id: int, payload: UserUpdate) -> dict[str, Any]:
    return update_user(user_id, payload)


@app.delete("/api/users/{user_id}", dependencies=[Depends(require_role({"admin"}))])
def remove_user(user_id: int) -> dict[str, Any]:
    delete_user(user_id)
    return {"ok": "true", "message": "Usuario eliminado"}


@app.get("/api/zones")
def get_zones() -> list[dict[str, Any]]:
    return bootstrap()["zones"]


@app.post("/api/zones", dependencies=[Depends(require_role({"admin"}))])
def create_zone(payload: ZoneCreate) -> dict[str, Any]:
    return create_zone_record(payload)


@app.patch("/api/zones/{zone_id}", dependencies=[Depends(require_role({"admin"}))])
def patch_zone(zone_id: int, payload: ZoneUpdate) -> dict[str, Any]:
    return update_zone(zone_id, payload)


@app.delete("/api/zones/{zone_id}", dependencies=[Depends(require_role({"admin"}))])
def remove_zone(zone_id: int) -> dict[str, Any]:
    delete_zone(zone_id)
    return {"ok": "true", "message": "Zona eliminada"}


@app.get("/api/schedules")
def get_schedules() -> list[dict[str, Any]]:
    return bootstrap()["schedules"]


@app.post("/api/schedules", dependencies=[Depends(require_role({"admin"}))])
def create_schedule(payload: ScheduleCreate) -> dict[str, Any]:
    return create_schedule_record(payload)


@app.patch("/api/schedules/{schedule_id}", dependencies=[Depends(require_role({"admin"}))])
def patch_schedule(schedule_id: int, payload: ScheduleUpdate) -> dict[str, Any]:
    return update_schedule(schedule_id, payload)


@app.delete("/api/schedules/{schedule_id}", dependencies=[Depends(require_role({"admin"}))])
def remove_schedule(schedule_id: int) -> dict[str, Any]:
    delete_schedule(schedule_id)
    return {"ok": "true", "message": "Horario eliminado"}


@app.get("/api/trucks")
def get_trucks() -> list[dict[str, Any]]:
    return bootstrap()["trucks"]


@app.post("/api/trucks", dependencies=[Depends(require_role({"admin"}))])
def create_truck(payload: TruckCreate) -> dict[str, Any]:
    return create_truck_record(payload)


@app.patch("/api/trucks/{truck_id}", dependencies=[Depends(require_role({"admin"}))])
def patch_truck(truck_id: int, payload: TruckUpdate) -> dict[str, Any]:
    return update_truck(truck_id, payload)


@app.delete("/api/trucks/{truck_id}", dependencies=[Depends(require_role({"admin"}))])
def remove_truck(truck_id: int) -> dict[str, Any]:
    delete_truck(truck_id)
    return {"ok": "true", "message": "Camión eliminado"}


@app.get("/api/maintenance")
def get_maintenance() -> list[dict[str, Any]]:
    return bootstrap()["maintenance"]


@app.post("/api/maintenance", dependencies=[Depends(require_role({"admin"}))])
def create_maintenance(payload: MaintenanceCreate) -> dict[str, Any]:
    return create_maintenance_record(payload)


@app.patch("/api/maintenance/{maintenance_id}", dependencies=[Depends(require_role({"admin"}))])
def patch_maintenance(maintenance_id: int, payload: MaintenanceUpdate) -> dict[str, Any]:
    return update_maintenance(maintenance_id, payload)


@app.delete("/api/maintenance/{maintenance_id}", dependencies=[Depends(require_role({"admin"}))])
def remove_maintenance(maintenance_id: int) -> dict[str, Any]:
    delete_maintenance(maintenance_id)
    return {"ok": "true", "message": "Registro de mantenimiento eliminado"}


@app.get("/truck-locations")
@app.get("/api/truck-locations")
def get_truck_locations() -> dict[str, list[dict[str, Any]]]:
    return {"trucks": geo_trucks()}


@app.get("/api/routes")
def get_routes() -> list[dict[str, Any]]:
    return bootstrap()["routes"]


def build_monitor(simulate: bool = True) -> dict[str, Any]:
    data = bootstrap()
    if simulate:
        data["routes"] = simulate_route_progress(data.get("routes", []))
        data["containers"] = simulate_container_fill(data.get("containers", []))
    else:
        data["routes"] = data.get("routes", [])
        data["containers"] = data.get("containers", [])

        if database_mode() == "memory":
            memory.routes = data["routes"]
            memory.containers = data["containers"]

    prioritized_zones = prioritize_zones(data.get("zones", []), data.get("reports", []), data.get("containers", []))
    optimized_routes = optimize_routes(data.get("routes", []), [zone["name"] for zone in prioritized_zones])
    assignments = suggest_truck_assignments(data.get("trucks", []), optimized_routes)
    intervention_plan = build_intervention_plan(prioritized_zones, optimized_routes)
    return {
        "trucks": simulate_truck_positions(data.get("routes", [])),
        "alerts": build_alerts(routes=data.get("routes", []), containers=data.get("containers", [])),
        "containers": data.get("containers", []),
        "maintenance": data.get("maintenance", []),
        "notifications": data.get("notifications", []),
        "prioritized_zones": prioritized_zones,
        "optimized_routes": optimized_routes,
        "truck_assignments": assignments,
        "intervention_plan": intervention_plan,
        "performance": build_performance_metrics(data.get("routes", []), data.get("reports", []), data.get("containers", [])),
    }


@app.get("/api/operations/monitor")
def get_monitor() -> dict[str, Any]:
    return build_monitor()


@app.post("/api/operations/update")
def update_operation(payload: OperationUpdateRequest, current_user: dict[str, Any] = Depends(require_role({"operador", "admin"}))) -> dict[str, Any]:
    data = bootstrap()
    if payload.type == "route_update":
        updated = False
        if payload.progress is None and payload.delay is None:
            raise HTTPException(status_code=400, detail="Se requiere progreso o retraso para la actualización de ruta")
        if database_mode() == "postgresql":
            updates = []
            params: list[Any] = []
            if payload.progress is not None:
                updates.append("progress = %s")
                params.append(payload.progress)
            if payload.delay is not None:
                updates.append("delay = %s")
                params.append(payload.delay)
            params.append(payload.id)
            execute_one(f"update routes set {', '.join(updates)} where id = %s returning id", tuple(params))
            updated = True
        else:
            for route in memory.routes:
                if int(route.get("id", 0)) == payload.id:
                    if payload.progress is not None:
                        route["progress"] = max(0, min(100, payload.progress))
                    if payload.delay is not None:
                        route["delay"] = payload.delay
                    updated = True
                    break
        if not updated:
            raise HTTPException(status_code=404, detail="Ruta no encontrada")
    elif payload.type == "container_update":
        updated = False
        if payload.fill_level is None and payload.status is None:
            raise HTTPException(status_code=400, detail="Se requiere nivel de llenado o estado para la actualización de contenedor")
        if database_mode() == "postgresql":
            updates = []
            params = []
            if payload.fill_level is not None:
                updates.append("fill_level = %s")
                params.append(max(0, min(100, payload.fill_level)))
            if payload.status is not None:
                updates.append("status = %s")
                params.append(payload.status)
            updates.append("updated_at = now()")
            params.append(payload.id)
            execute_one(f"update containers set {', '.join(updates)} where id = %s returning id", tuple(params))
            updated = True
        else:
            for container in memory.containers:
                if int(container.get("id", 0)) == payload.id:
                    if payload.fill_level is not None:
                        container["fill_level"] = max(0, min(100, payload.fill_level))
                    if payload.status is not None:
                        container["status"] = payload.status
                    updated = True
                    break
        if not updated:
            raise HTTPException(status_code=404, detail="Contenedor no encontrado")
    else:
        raise HTTPException(status_code=400, detail="Tipo de evento operativo no reconocido")

    event_title = "Evento operativo"
    target_desc = ""
    if payload.type == "route_update":
        target_desc = f"Ruta {payload.id} actualizada"
        if payload.progress is not None:
            target_desc += f", progreso {payload.progress}%"
        if payload.delay is not None:
            target_desc += f", retraso {payload.delay}"
    else:
        target_desc = f"Contenedor {payload.id} actualizado"
        if payload.fill_level is not None:
            target_desc += f", llenado {payload.fill_level}%"
        if payload.status is not None:
            target_desc += f", estado {payload.status}"

    notification = {
        "id": len(data.get("notifications", [])) + 1,
        "user_id": current_user.get("id"),
        "title": event_title,
        "message": f"{current_user.get('name')} registró: {target_desc}. {payload.note or ''}".strip(),
        "type": "event",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        if database_mode() == "postgresql":
            execute_one(
                "insert into notifications (user_id, title, message, type, is_read, created_at) values (%s, %s, %s, %s, %s, %s) returning id",
                (current_user.get("id"), notification["title"], notification["message"], notification["type"], notification["is_read"], notification["created_at"]),
            )
    except Exception:
        pass

    if database_mode() == "memory":
        data["routes"] = memory.routes
        data["containers"] = memory.containers
        memory.notifications.insert(0, notification)
        data["notifications"] = memory.notifications

    return build_monitor(simulate=False)


@app.get("/alerts")
@app.get("/api/alerts")
def get_alerts() -> dict[str, list[str]]:
    data = bootstrap()
    routes = data.get("routes", [])
    containers = data.get("containers", [])
    return {"alerts": build_alerts(routes=routes, containers=containers)}


@app.get("/eta")
@app.get("/api/eta")
def get_eta(truck: str | None = None) -> dict[str, Any]:
    trucks = geo_trucks()
    selected = next((item for item in trucks if item["code"] == truck), trucks[0])
    return {
        "truck": selected["code"],
        "etaMinutes": selected["etaMinutes"],
        "eta": f'{selected["etaMinutes"]} min',
    }


@app.get("/api/reports")
def get_reports(current_user: dict[str, Any] = Depends(require_current_user)) -> list[dict[str, Any]]:
    reports = bootstrap()["reports"]
    role = normalize_role(str(current_user.get("role", "ciudadano")))
    if role == "ciudadano":
        return [report for report in reports if report.get("citizen", "").lower() == str(current_user.get("name", "")).lower()]
    return reports


@app.post("/api/reports")
def create_report(payload: ReportCreate, current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    try:
        report = execute_one(
            "insert into reports (citizen, zone, type, detail, status) values (%s, %s, %s, %s, 'Pendiente') returning id, citizen, zone, type, detail, status",
            (current_user.get("name", payload.citizen), payload.zone, payload.type, payload.detail),
        )
        return report
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        report = payload.model_dump()
        report["citizen"] = current_user.get("name", payload.citizen)
        report["id"] = max([item["id"] for item in memory.reports], default=0) + 1
        report["status"] = "Pendiente"
        memory.reports.insert(0, report)
        return report


@app.patch("/api/reports/{report_id}/resolve")
def resolve_report(report_id: int, current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    if normalize_role(str(current_user.get("role", "ciudadano"))) not in {"operador", "admin"}:
        raise HTTPException(status_code=403, detail="Solo operadores o administradores pueden resolver reportes")
    try:
        return execute_one(
            "update reports set status = 'Resuelto' where id = %s returning id, citizen, zone, type, detail, status",
            (report_id,),
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        for report in memory.reports:
            if report["id"] == report_id:
                report["status"] = "Resuelto"
                return report
        raise HTTPException(status_code=404, detail="Reporte no encontrado")


@app.get("/api/collections")
def get_collections() -> list[dict[str, Any]]:
    return bootstrap()["collections"]


@app.post("/api/collections", dependencies=[Depends(require_role({"conductor"}))])
def register_collection(payload: CollectionCreate, current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    # Permitimos que un conductor registre la recolección realizada
    created = create_collection_record(payload, created_by=current_user)
    return created


@app.post("/api/collections/{collection_id}/confirm")
def confirm_collection(collection_id: int, current_user: dict[str, Any] = Depends(require_current_user)) -> dict[str, Any]:
    # Solo un ciudadano puede confirmar la recolección de su zona/registro
    if normalize_role(str(current_user.get("role"))) != "ciudadano":
        raise HTTPException(status_code=403, detail="Solo ciudadanos pueden confirmar recolecciones")
    confirmed = confirm_collection_by_citizen(collection_id, current_user)
    return confirmed


@app.get("/api/analytics/summary")
def get_analytics() -> dict[str, Any]:
    return bootstrap()["analytics"]
