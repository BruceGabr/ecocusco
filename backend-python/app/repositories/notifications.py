"""Persistencia de notificaciones."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.database import execute_one
from app.memory_store import memory

NOTIFICATION_TYPE_INFO = "info"
NOTIFICATION_TYPE_EVENT = "event"


def create_notification(
    user_id: int | None,
    title: str,
    message: str,
    notification_type: str = NOTIFICATION_TYPE_INFO,
) -> dict[str, Any]:
    """Registra una notificación y devuelve la fila creada."""
    created_at = datetime.now(timezone.utc).isoformat()
    notification = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "is_read": False,
        "created_at": created_at,
    }
    try:
        row = execute_one(
            "insert into notifications (user_id, title, message, type, is_read, created_at) "
            "values (%s, %s, %s, %s, %s, %s) returning id",
            (user_id, title, message, notification_type, False, created_at),
        )
        return {**notification, "id": row.get("id")}
    except Exception:
        notification["id"] = max([item["id"] for item in memory.notifications], default=0) + 1
        memory.notifications.insert(0, notification)
        return notification
