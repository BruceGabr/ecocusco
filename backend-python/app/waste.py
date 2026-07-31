WASTE_TYPES = {
    "organico": {
        "bin": "Verde",
        "recyclable": True,
        "instructions": "Residuos de comida y jardineria",
    },
    "plastico": {
        "bin": "Azul",
        "recyclable": True,
        "instructions": "Envases plasticos, botellas y bolsas",
    },
    "vidrio": {
        "bin": "Amarillo",
        "recyclable": True,
        "instructions": "Botellas y frascos de vidrio",
    },
    "papel": {
        "bin": "Blanco",
        "recyclable": True,
        "instructions": "Papel, carton y periodicos",
    },
}

_DEFAULT = {
    "bin": "Gris",
    "recyclable": False,
    "instructions": "Tipo de residuo no reconocido. Consulta la guia municipal",
}


def _normalize(waste_type: str) -> str | None:
    if not waste_type or not isinstance(waste_type, str):
        return None
    return waste_type.strip().lower()


def classify_waste(waste_type: str) -> dict:
    key = _normalize(waste_type)
    if key is None:
        return dict(_DEFAULT)
    entry = WASTE_TYPES.get(key)
    return dict(entry) if entry else dict(_DEFAULT)


def get_all_waste_types() -> dict:
    return {k: dict(v) for k, v in WASTE_TYPES.items()}
