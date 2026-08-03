"""Acceso a PostgreSQL.

Es la única capa que habla con psycopg. Si el driver no está instalado o no hay
`DATABASE_URL`, las funciones lanzan `RuntimeError` y los repositorios caen al
almacén en memoria del modo demostración.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import HTTPException

from app.config import database_url

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # pragma: no cover - permite el modo demo sin dependencias de BD
    psycopg = None
    dict_row = None

#: Segundos que se espera al comprobar la conexión en /api/health.
_HEALTHCHECK_TIMEOUT_S = 2


def is_available() -> bool:
    return bool(database_url()) and psycopg is not None


def database_mode() -> str:
    """Describe de dónde salen los datos. Se expone en /api/health."""
    if database_url() and psycopg is not None:
        try:
            with psycopg.connect(database_url(), connect_timeout=_HEALTHCHECK_TIMEOUT_S) as conn:
                with conn.cursor() as cur:
                    cur.execute("select 1")
            return "postgresql"
        except Exception:
            return "memory (postgresql no disponible)"
    if database_url() and psycopg is None:
        return "memory (psycopg no instalado)"
    return "memory"


def _require_connection():
    if not is_available():
        raise RuntimeError("PostgreSQL no disponible")
    return psycopg.connect(database_url(), row_factory=dict_row)


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with _require_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return list(cur.fetchall())


def execute_one(query: str, params: tuple[Any, ...]) -> dict[str, Any]:
    """Ejecuta una sentencia que devuelve una fila y confirma la transacción."""
    with _require_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
            conn.commit()
            if row is None:
                raise HTTPException(status_code=404, detail="Registro no encontrado")
            return dict(row)


def normalize_dates(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convierte fechas a ISO para que FastAPI las serialice igual en ambos modos."""
    for row in rows:
        for key, value in list(row.items()):
            if isinstance(value, (date, datetime)):
                row[key] = value.isoformat()
    return rows
