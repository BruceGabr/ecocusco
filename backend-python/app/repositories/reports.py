"""Persistencia de reportes ciudadanos de incidencias."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.constants import REPORT_STATUS_PENDING, REPORT_STATUS_RESOLVED
from app.database import execute_one
from app.memory_store import memory
from app.schemas import ReportCreate


def create_report_record(payload: ReportCreate, citizen: str) -> dict[str, Any]:
    """Registra una incidencia a nombre del ciudadano autenticado."""
    try:
        return execute_one(
            "insert into reports (citizen, zone, type, detail, status) "
            "values (%s, %s, %s, %s, %s) "
            "returning id, citizen, zone, type, detail, status",
            (citizen, payload.zone, payload.type, payload.detail, REPORT_STATUS_PENDING),
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        report = payload.model_dump()
        report["citizen"] = citizen
        report["id"] = max([item["id"] for item in memory.reports], default=0) + 1
        report["status"] = REPORT_STATUS_PENDING
        memory.reports.insert(0, report)
        return report


def resolve_report_record(report_id: int) -> dict[str, Any]:
    """Marca una incidencia como resuelta."""
    try:
        return execute_one(
            "update reports set status = %s where id = %s "
            "returning id, citizen, zone, type, detail, status",
            (REPORT_STATUS_RESOLVED, report_id),
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        for report in memory.reports:
            if report["id"] == report_id:
                report["status"] = REPORT_STATUS_RESOLVED
                return report
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
