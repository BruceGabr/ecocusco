import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.waste import classify_waste, get_all_waste_types


# --- CLASIFICACION: Residuo organico reciclable ---
def test_classify_organic_is_recyclable():
    result = classify_waste("organico")
    assert result["recyclable"] is True
    assert result["bin"] == "Verde"
    assert result["instructions"] == "Residuos de comida y jardineria"


# --- CLASIFICACION: Residuo plastico reciclable ---
def test_classify_plastic_is_recyclable():
    result = classify_waste("plastico")
    assert result["recyclable"] is True
    assert result["bin"] == "Azul"


# --- CLASIFICACION: Residuo vidrio reciclable ---
def test_classify_glass_is_recyclable():
    result = classify_waste("vidrio")
    assert result["recyclable"] is True
    assert result["bin"] == "Amarillo"


# --- CLASIFICACION: Residuo papel reciclable ---
def test_classify_paper_is_recyclable():
    result = classify_waste("papel")
    assert result["recyclable"] is True
    assert result["bin"] == "Blanco"


# --- CLASIFICACION: Tipo de residuo desconocido ---
def test_classify_unknown_type_returns_not_recyclable():
    result = classify_waste("no_existe")
    assert result["recyclable"] is False
    assert result["bin"] == "Gris"
    assert "no reconocido" in result["instructions"].lower()


# --- CLASIFICACION: Case insensitive (mayusculas/minusculas) ---
def test_classify_case_insensitive():
    result = classify_waste("Organico")
    assert result["recyclable"] is True


# --- CLASIFICACION: Lista completa de tipos de residuos ---
def test_get_all_waste_types_returns_dict():
    types = get_all_waste_types()
    assert isinstance(types, dict)
    assert len(types) >= 4
    assert "organico" in types
    assert "plastico" in types
    assert "vidrio" in types
    assert "papel" in types


# --- CLASIFICACION: String vacio devuelve valor por defecto ---
def test_classify_empty_string_returns_default():
    result = classify_waste("")
    assert result["recyclable"] is False
    assert result["bin"] == "Gris"


# --- CLASIFICACION: Todos los tipos tienen las claves requeridas ---
def test_get_all_waste_types_values_have_required_keys():
    types = get_all_waste_types()
    for key, value in types.items():
        assert "bin" in value
        assert "recyclable" in value
        assert "instructions" in value
