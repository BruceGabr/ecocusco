#!/usr/bin/env python
"""
Sistema de verificación pre-ejecución para SIR Cusco.
Verifica que todos los requisitos estén instalados y configurados.
"""

import sys
import subprocess
from pathlib import Path


def check_python_version():
    """Verifica que Python sea v3.9 o superior."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 9):
        print(f"❌ Python {version.major}.{version.minor} es muy antiguo. Se requiere Python 3.9+")
        return False
    print(f"✅ Python {version.major}.{version.minor} encontrado")
    return True


def check_command_exists(cmd, name):
    """Verifica que un comando esté disponible."""
    try:
        result = subprocess.run([cmd, "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip().split("\n")[0]
            print(f"✅ {name}: {version}")
            return True
    except FileNotFoundError:
        pass
    print(f"❌ {name} no encontrado. Instálalo desde la documentación.")
    return False


def check_directories():
    """Verifica que la estructura de directorios sea correcta."""
    required = ["frontend", "backend-python", "backend-typescript", "database", "scripts"]
    root = Path(__file__).parent
    
    all_exist = True
    for directory in required:
        path = root / directory
        if path.exists():
            print(f"✅ Directorio {directory}/ encontrado")
        else:
            print(f"❌ Directorio {directory}/ no encontrado")
            all_exist = False
    
    return all_exist


def check_dependencies():
    """Verifica las dependencias de Python."""
    required = ["fastapi", "uvicorn", "pydantic", "python-dotenv"]
    all_installed = True
    
    for package in required:
        try:
            __import__(package.replace("-", "_"))
            print(f"✅ {package} instalado")
        except ImportError:
            print(f"❌ {package} no instalado")
            print(f"   Instala con: pip install {package}")
            all_installed = False
    
    return all_installed


def main():
    """Ejecuta todas las verificaciones."""
    print("🔍 Verificando sistema SIR Cusco...\n")
    
    checks = [
        ("Python", check_python_version),
        ("Node.js", lambda: check_command_exists("node", "Node.js")),
        ("npm", lambda: check_command_exists("npm", "npm")),
        ("Estructura de directorios", check_directories),
        ("Dependencias Python", check_dependencies),
    ]
    
    results = []
    for name, check in checks:
        print(f"\n📋 {name}:")
        try:
            result = check()
            results.append((name, result))
        except Exception as e:
            print(f"⚠️ Error al verificar {name}: {e}")
            results.append((name, False))
    
    print("\n" + "="*50)
    print("📊 Resumen:")
    for name, result in results:
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n✅ Sistema listo. Ejecuta: python scripts/start-all.ps1")
    else:
        print("\n⚠️ Hay problemas. Consulta GUIA_EJECUCION.md para instrucciones.")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
