"""Descripción legible de los eventos operativos registrados por el personal."""

from __future__ import annotations

from app.schemas import OperationUpdateRequest

EVENT_TITLE = "Evento operativo"

ROUTE_UPDATE = "route_update"
CONTAINER_UPDATE = "container_update"


def describe_operation_event(payload: OperationUpdateRequest) -> str:
    """Resume qué cambió, para el cuerpo de la notificación."""
    if payload.type == ROUTE_UPDATE:
        parts = [f"Ruta {payload.id} actualizada"]
        if payload.progress is not None:
            parts.append(f"progreso {payload.progress}%")
        if payload.delay is not None:
            parts.append(f"retraso {payload.delay}")
    else:
        parts = [f"Contenedor {payload.id} actualizado"]
        if payload.fill_level is not None:
            parts.append(f"llenado {payload.fill_level}%")
        if payload.status is not None:
            parts.append(f"estado {payload.status}")
    return ", ".join(parts)


def build_event_message(actor_name: str, payload: OperationUpdateRequest) -> str:
    description = describe_operation_event(payload)
    note = (payload.note or "").strip()
    return f"{actor_name} registró: {description}. {note}".strip()
