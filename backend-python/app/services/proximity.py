"""Proximidad entre camiones y zonas.

Cierra el aviso que faltaba en la operación: saber que el camión ya está cerca
sin tener que mirar el mapa. La distancia se calcula con Haversine sobre las
coordenadas que ya viajan en rutas, camiones y zonas, así que no hace falta
ninguna dependencia geoespacial ni una tabla nueva.

Qué ve cada rol:

- ciudadano: camiones `En ruta` a menos del radio de su zona asignada.
- conductor: zonas a menos del radio de su propio camión.
- admin: todas las parejas camión-zona dentro del radio.

Las alertas se emiten con el mismo formato que las notificaciones persistidas
(`type = "proximity"`) para que el frontend las pinte con el módulo de avisos
que ya existe.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from app.constants import (
    ADMIN_ROLES,
    OPERATIONAL_ROLES,
    PROXIMITY_RADIUS_M,
    PROXIMITY_VERY_NEAR_M,
    PUBLIC_REGISTRATION_ROLE,
    Role,
    TRUCK_STATUS_ON_ROUTE,
    normalize_role,
)

#: Tipo con el que viajan estas notificaciones. El frontend filtra por él.
NOTIFICATION_TYPE_PROXIMITY = "proximity"

#: Radio terrestre medio, en metros.
EARTH_RADIUS_M = 6_371_000


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia geodésica en metros entre dos coordenadas, redondeada a 1 decimal."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(EARTH_RADIUS_M * c, 1)


def proximity_tone(distance_m: float) -> str:
    """Gradúa el aviso: por debajo del umbral corto ya está encima."""
    return "muy_cercano" if distance_m <= PROXIMITY_VERY_NEAR_M else "cercano"


def _coordinates(item: dict[str, Any]) -> tuple[float, float]:
    return float(item.get("latitude", 0) or 0), float(item.get("longitude", 0) or 0)


def _same_text(left: Any, right: Any) -> bool:
    return str(left or "").strip().lower() == str(right or "").strip().lower()


def active_trucks(trucks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Solo los camiones en ruta: los parados o en taller no generan avisos."""
    return [truck for truck in trucks if _same_text(truck.get("status"), TRUCK_STATUS_ON_ROUTE)]


def route_eta_for(truck: dict[str, Any], routes: list[dict[str, Any]]) -> str:
    route = next((item for item in routes if _same_text(item.get("truck"), truck.get("code"))), None)
    return str(route.get("eta", "N/A")) if route else "N/A"


def find_nearby_trucks(
    latitude: float,
    longitude: float,
    radius_m: int,
    trucks: list[dict[str, Any]],
    routes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Camiones en ruta dentro del radio, del más cercano al más lejano."""
    nearby: list[dict[str, Any]] = []
    for truck in active_trucks(trucks):
        truck_lat, truck_lon = _coordinates(truck)
        distance = haversine_distance_m(latitude, longitude, truck_lat, truck_lon)
        if distance > radius_m:
            continue
        nearby.append({
            "truck_code": truck.get("code"),
            "driver": truck.get("driver"),
            "zone": truck.get("zone"),
            "distance_m": distance,
            "eta": route_eta_for(truck, routes),
            "status": truck.get("status"),
            "tone": proximity_tone(distance),
        })
    return sorted(nearby, key=lambda item: item["distance_m"])


def _alert(
    index: int,
    user: dict[str, Any] | None,
    title: str,
    message: str,
    truck: dict[str, Any],
    zone_name: Any,
    distance_m: float,
    eta: str,
    created_at: str,
) -> dict[str, Any]:
    return {
        "id": f"proximity-{index}",
        "user_id": user.get("id") if user else None,
        "title": title,
        "message": message,
        "type": NOTIFICATION_TYPE_PROXIMITY,
        "is_read": False,
        "created_at": created_at,
        "tone": proximity_tone(distance_m),
        "truck_code": truck.get("code"),
        "driver": truck.get("driver"),
        "zone": zone_name,
        "distance_m": distance_m,
        "eta": eta,
    }


def build_proximity_alerts(
    user: dict[str, Any] | None,
    trucks: list[dict[str, Any]],
    zones: list[dict[str, Any]],
    routes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Avisos de proximidad para el usuario dado, según su rol.

    Sin sesión no se devuelve nada: el aviso siempre es relativo a la zona o al
    camión de alguien concreto.
    """
    if user is None:
        return []

    role = normalize_role(str(user.get("role", PUBLIC_REGISTRATION_ROLE)))
    on_route = active_trucks(trucks)
    if not on_route:
        return []

    created_at = datetime.now(timezone.utc).isoformat()
    alerts: list[dict[str, Any]] = []

    if role == Role.CIUDADANO.value:
        zone = next((item for item in zones if _same_text(item.get("name"), user.get("zone"))), None)
        if zone is None:
            return []
        zone_lat, zone_lon = _coordinates(zone)
        for truck in on_route:
            truck_lat, truck_lon = _coordinates(truck)
            distance = haversine_distance_m(zone_lat, zone_lon, truck_lat, truck_lon)
            if distance > PROXIMITY_RADIUS_M:
                continue
            eta = route_eta_for(truck, routes)
            tone = proximity_tone(distance)
            alerts.append(_alert(
                index=len(alerts) + 1,
                user=user,
                title="Camión muy cercano" if tone == "muy_cercano" else "Camión cercano",
                message=(
                    f"El camión {truck.get('code')} ({truck.get('driver')}) está a "
                    f"{int(distance)}m de {zone.get('name')}. ETA: {eta}."
                ),
                truck=truck,
                zone_name=zone.get("name"),
                distance_m=distance,
                eta=eta,
                created_at=created_at,
            ))
        return alerts

    if role == Role.CONDUCTOR.value:
        # El camión se identifica por el nombre del conductor porque `trucks`
        # guarda el nombre, no el id del usuario.
        my_truck = next((truck for truck in on_route if _same_text(truck.get("driver"), user.get("name"))), None)
        if my_truck is None:
            return []
        truck_lat, truck_lon = _coordinates(my_truck)
        for zone in zones:
            zone_lat, zone_lon = _coordinates(zone)
            distance = haversine_distance_m(truck_lat, truck_lon, zone_lat, zone_lon)
            if distance > PROXIMITY_RADIUS_M:
                continue
            tone = proximity_tone(distance)
            alerts.append(_alert(
                index=len(alerts) + 1,
                user=user,
                title="Zona muy cercana" if tone == "muy_cercano" else "Zona cercana",
                message=f"Estás a {int(distance)}m de la zona {zone.get('name')}.",
                truck=my_truck,
                zone_name=zone.get("name"),
                distance_m=distance,
                eta="N/A",
                created_at=created_at,
            ))
        return alerts

    if role in ADMIN_ROLES:
        for truck in on_route:
            truck_lat, truck_lon = _coordinates(truck)
            for zone in zones:
                zone_lat, zone_lon = _coordinates(zone)
                distance = haversine_distance_m(truck_lat, truck_lon, zone_lat, zone_lon)
                if distance > PROXIMITY_RADIUS_M:
                    continue
                alerts.append(_alert(
                    index=len(alerts) + 1,
                    user=user,
                    title=f"{truck.get('code')} cerca de {zone.get('name')}",
                    message=(
                        f"El camión {truck.get('code')} ({truck.get('driver')}) está a "
                        f"{int(distance)}m de la zona {zone.get('name')}."
                    ),
                    truck=truck,
                    zone_name=zone.get("name"),
                    distance_m=distance,
                    eta=route_eta_for(truck, routes),
                    created_at=created_at,
                ))

    return alerts
