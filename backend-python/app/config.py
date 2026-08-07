"""Configuración leída del entorno.

Reúne en un solo sitio todo lo que el despliegue puede cambiar sin tocar
código: CORS, base de datos y clave de firma JWT.
"""

from __future__ import annotations

import os
from typing import Optional

APP_TITLE = "SIR Cusco API"
APP_VERSION = "1.0.0"

JWT_ALGORITHM = "HS256"

# --- Política de sesión ---------------------------------------------------
#
# La sesión es deslizante: el token vive poco y se renueva mientras la persona
# usa la aplicación. Si deja de usarla, nadie pide la renovación y caduca solo,
# sin necesidad de temporizadores en el servidor.
#
# Antes el token duraba 12 horas fijas desde el inicio de sesión, así que
# cortaba a mitad de la jornada aunque se estuviera trabajando.

#: Vida de cada token. Al caducar hay que renovarlo o volver a iniciar sesión.
#: Marca también el tiempo de inactividad tolerado.
TOKEN_TTL_MINUTES = 30

#: Tope absoluto desde el inicio de sesión original. Aunque haya actividad
#: continua, pasado este plazo hay que autenticarse de nuevo. Sin él, una
#: sesión renovada sin pausa sería eterna, algo inaceptable en un equipo
#: compartido que maneja datos personales de ciudadanos.
SESSION_ABSOLUTE_MAX_HOURS = 12

#: Validez del token de recuperación de contraseña.
PASSWORD_RESET_TTL_MINUTES = 20

_DEV_JWT_SECRET = "dev-secret-change-me-change-this-to-a-strong-secret-123456"

#: Entornos que se consideran desarrollo local.
_LOCAL_ENVIRONMENTS = ("development", "dev", "local", "test")


def cors_origins() -> list[str]:
    """Orígenes autorizados. En local se permite el servidor de Vite."""
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def cors_origin_regex() -> Optional[str]:
    """Patrón adicional de orígenes, para los despliegues de vista previa."""
    return os.getenv("CORS_ORIGIN_REGEX")


def database_url() -> Optional[str]:
    return os.getenv("DATABASE_URL")


def app_env() -> str:
    return os.getenv("APP_ENV", "development").strip().lower()


def demo_simulation_enabled() -> bool:
    """Si el monitoreo debe inventar movimiento operativo.

    Está apagado: el monitor devuelve el estado tal y como está guardado. Con
    la simulación encendida, cada consulta sumaba avance a las rutas, llenado a
    los contenedores y un desplazamiento fijo a los camiones, así que la
    pantalla mostraba cifras que no correspondían a ningún dato registrado.

    Solo tiene sentido activarla (`DEMO_SIMULATION=1`) para una demostración
    sin base de datos, y lo que se muestre entonces debe presentarse como
    simulado.
    """
    return os.getenv("DEMO_SIMULATION", "").strip().lower() in {"1", "true", "yes", "on"}


def is_deployed() -> bool:
    """Se considera desplegado si hay base de datos o el entorno no es local."""
    return bool(os.getenv("DATABASE_URL", "").strip()) or app_env() not in _LOCAL_ENVIRONMENTS


def resolve_jwt_secret() -> str:
    """Resuelve la clave de firma JWT.

    El valor por defecto está publicado en el repositorio: si un despliegue lo
    usara, cualquiera podría firmar tokens de administrador. Por eso solo se
    admite en desarrollo local.
    """
    secret = os.getenv("JWT_SECRET", "").strip()
    if secret:
        return secret

    if is_deployed():
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


JWT_SECRET = resolve_jwt_secret()
