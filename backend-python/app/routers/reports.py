"""Reportes ciudadanos de incidencias."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.constants import OPERATIONAL_ROLES, PUBLIC_REGISTRATION_ROLE, normalize_role
from app.dependencies import require_current_user
from app.repositories.bootstrap import bootstrap
from app.repositories.reports import create_report_record, resolve_report_record
from app.schemas import ReportCreate
from app.services.visibility import visible_reports_for

router = APIRouter(prefix="/api", tags=["reportes"])


@router.get("/reports")
def get_reports(current_user: dict[str, Any] = Depends(require_current_user)) -> list[dict[str, Any]]:
    return visible_reports_for(current_user, bootstrap()["reports"])


@router.post("/reports")
def create_report(
    payload: ReportCreate,
    current_user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    # El autor es siempre el usuario autenticado: el nombre que venga en el
    # cuerpo de la petición se ignora para que nadie reporte en nombre de otro.
    citizen = current_user.get("name", payload.citizen)
    return create_report_record(payload, citizen)


@router.patch("/reports/{report_id}/resolve")
def resolve_report(
    report_id: int,
    current_user: dict[str, Any] = Depends(require_current_user),
) -> dict[str, Any]:
    if normalize_role(str(current_user.get("role", PUBLIC_REGISTRATION_ROLE))) not in OPERATIONAL_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Solo operadores o administradores pueden resolver reportes",
        )
    return resolve_report_record(report_id)
