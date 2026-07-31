# =============================================================================
#  deploy-cloudflare.ps1  (v2 - fix rutas con espacios)
#  Sistema Inteligente de Recoleccion de Residuos - Cusco
#  Despliegue con Cloudflare Quick Tunnels (sin dominio ni cuenta)
# =============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# --- Copiar cloudflared a TEMP (ruta sin espacios) para evitar errores -------
$cloudflaredSrc  = Join-Path $PSScriptRoot "cloudflared.exe"
$cloudflaredExe  = "$env:TEMP\cloudflared.exe"   # <-- ruta sin espacios ni tildes

Clear-Host
Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "   Sistema de Recoleccion de Residuos - Cusco          " -ForegroundColor White
Write-Host "   Despliegue via Cloudflare Quick Tunnels              " -ForegroundColor White
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

# --------------------------------------------------------------------------- #
#  1. Verificar / descargar cloudflared
# --------------------------------------------------------------------------- #
if (-not (Test-Path $cloudflaredSrc)) {
    $inPath = Get-Command "cloudflared" -ErrorAction SilentlyContinue
    if ($inPath) {
        $cloudflaredSrc = $inPath.Source
        Write-Host "  [OK] cloudflared encontrado en PATH" -ForegroundColor Green
    } else {
        Write-Host "  [..] Descargando cloudflared..." -ForegroundColor Yellow
        $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        Invoke-WebRequest -Uri $url -OutFile $cloudflaredSrc -UseBasicParsing
        Write-Host "  [OK] cloudflared descargado" -ForegroundColor Green
    }
} else {
    Write-Host "  [OK] cloudflared.exe encontrado" -ForegroundColor Green
}

# Copiar a TEMP (ruta sin espacios) para usarlo desde sub-procesos
Copy-Item $cloudflaredSrc $cloudflaredExe -Force
Write-Host "  [OK] cloudflared copiado a: $cloudflaredExe" -ForegroundColor Green

# --------------------------------------------------------------------------- #
#  2. Verificar dependencias
# --------------------------------------------------------------------------- #
Write-Host ""
Write-Host "  Verificando dependencias..." -ForegroundColor Cyan

if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "  [!!] npm no encontrado." -ForegroundColor Red; exit 1
}
Write-Host "  [OK] Node.js / npm" -ForegroundColor Green

$pythonCmd = "python"
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "  [!!] Python no encontrado." -ForegroundColor Red; exit 1
}
Write-Host "  [OK] Python" -ForegroundColor Green

# node_modules frontend
if (-not (Test-Path (Join-Path $root "frontend\node_modules"))) {
    Write-Host "  [..] npm install frontend..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "frontend"); npm install --silent; Pop-Location
}
Write-Host "  [OK] Frontend node_modules" -ForegroundColor Green

# node_modules backend-ts
if (-not (Test-Path (Join-Path $root "backend-typescript\node_modules"))) {
    Write-Host "  [..] npm install backend-typescript..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "backend-typescript"); npm install --silent; Pop-Location
}
Write-Host "  [OK] Backend-TS node_modules" -ForegroundColor Green

# Python venv
$venvPy = Join-Path $root "backend-python\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Host "  [..] Creando venv Python..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "backend-python")
    python -m venv .venv | Out-Null
    & $venvPy -m pip install -r requirements.txt --quiet | Out-Null
    Pop-Location
}
Write-Host "  [OK] Python venv" -ForegroundColor Green

# --------------------------------------------------------------------------- #
#  3. Build del frontend
# --------------------------------------------------------------------------- #
Write-Host ""
Write-Host "  Compilando frontend..." -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
npm run build 2>&1 | Out-Null
Pop-Location
Write-Host "  [OK] Frontend compilado en frontend/dist/" -ForegroundColor Green

# --------------------------------------------------------------------------- #
#  4. Crear scripts auxiliares en TEMP (rutas sin espacios)
# --------------------------------------------------------------------------- #
# Usamos scripts intermedios en $env:TEMP para evitar el problema de espacios

$rootEsc = $root  # se usara dentro de here-strings

# Script para FastAPI
$scriptPy = "$env:TEMP\start_fastapi.ps1"
@"
`$venv = "$venvPy"
Set-Location "$root\backend-python"
Write-Host '[FastAPI] Iniciando en puerto 8000...' -ForegroundColor Green
& `$venv -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir "$root\backend-python"
"@ | Out-File $scriptPy -Encoding UTF8

# Script para Geo TypeScript
$scriptTs = "$env:TEMP\start_geo.ps1"
@"
Set-Location "$root\backend-typescript"
Write-Host '[GeoTS] Iniciando en puerto 3100...' -ForegroundColor Magenta
npm run dev
"@ | Out-File $scriptTs -Encoding UTF8

# Script para Frontend preview
$scriptFe = "$env:TEMP\start_frontend.ps1"
@"
Set-Location "$root\frontend"
Write-Host '[Frontend] Iniciando preview en puerto 4173...' -ForegroundColor Cyan
npm run preview
"@ | Out-File $scriptFe -Encoding UTF8

# Scripts de tunnel (usan $cloudflaredExe que esta en TEMP sin espacios)
$logFrontend = "$env:TEMP\cf_frontend.log"
$logApi      = "$env:TEMP\cf_api.log"
$logGeo      = "$env:TEMP\cf_geo.log"
Remove-Item $logFrontend, $logApi, $logGeo -ErrorAction SilentlyContinue

$scriptTunFe = "$env:TEMP\tunnel_frontend.ps1"
@"
Write-Host '=== TUNEL FRONTEND (puerto 4173) ===' -ForegroundColor Cyan
Write-Host 'Busca la URL: https://xxxxx.trycloudflare.com' -ForegroundColor Yellow
Write-Host ''
& "$cloudflaredExe" tunnel --url http://localhost:4173 2>&1 | Tee-Object -FilePath "$logFrontend"
"@ | Out-File $scriptTunFe -Encoding UTF8

$scriptTunApi = "$env:TEMP\tunnel_api.ps1"
@"
Write-Host '=== TUNEL API PYTHON (puerto 8000) ===' -ForegroundColor Green
Write-Host 'Busca la URL: https://xxxxx.trycloudflare.com' -ForegroundColor Yellow
Write-Host ''
& "$cloudflaredExe" tunnel --url http://localhost:8000 2>&1 | Tee-Object -FilePath "$logApi"
"@ | Out-File $scriptTunApi -Encoding UTF8

$scriptTunGeo = "$env:TEMP\tunnel_geo.ps1"
@"
Write-Host '=== TUNEL GEO TYPESCRIPT (puerto 3100) ===' -ForegroundColor Magenta
Write-Host 'Busca la URL: https://xxxxx.trycloudflare.com' -ForegroundColor Yellow
Write-Host ''
& "$cloudflaredExe" tunnel --url http://localhost:3100 2>&1 | Tee-Object -FilePath "$logGeo"
"@ | Out-File $scriptTunGeo -Encoding UTF8

# --------------------------------------------------------------------------- #
#  5. Iniciar servicios
# --------------------------------------------------------------------------- #
Write-Host ""
Write-Host "  Iniciando servicios locales..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-NoExit","-File",$scriptPy  -WindowStyle Minimized
Start-Sleep -Milliseconds 800
Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-NoExit","-File",$scriptTs  -WindowStyle Minimized
Start-Sleep -Milliseconds 800
Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-NoExit","-File",$scriptFe  -WindowStyle Minimized

Write-Host "  [OK] FastAPI Python  -> localhost:8000" -ForegroundColor Green
Write-Host "  [OK] Geo TypeScript  -> localhost:3100" -ForegroundColor Green
Write-Host "  [OK] Frontend Vite   -> localhost:4173" -ForegroundColor Green

Write-Host ""
Write-Host "  Esperando que los servicios inicien (15s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# --------------------------------------------------------------------------- #
#  6. Abrir tuneles
# --------------------------------------------------------------------------- #
Write-Host "  Abriendo tuneles Cloudflare..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-NoExit","-File",$scriptTunFe  -WindowStyle Normal
Start-Sleep -Milliseconds 500
Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-NoExit","-File",$scriptTunApi -WindowStyle Normal
Start-Sleep -Milliseconds 500
Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-NoExit","-File",$scriptTunGeo -WindowStyle Normal

Write-Host ""
Write-Host "  Esperando URLs de Cloudflare (35s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 35

# --------------------------------------------------------------------------- #
#  7. Leer URLs de los logs
# --------------------------------------------------------------------------- #
function Get-TunnelUrl([string]$LogFile) {
    if (Test-Path $LogFile) {
        $txt = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
        if ($txt -match "https://[a-z0-9\-]+\.trycloudflare\.com") { return $Matches[0] }
    }
    return "Revisa la ventana del tunel (aun cargando)"
}

$urlFe  = Get-TunnelUrl $logFrontend
$urlApi = Get-TunnelUrl $logApi
$urlGeo = Get-TunnelUrl $logGeo

# --------------------------------------------------------------------------- #
#  8. Resumen
# --------------------------------------------------------------------------- #
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "   URLS PUBLICAS CLOUDFLARE                                    " -ForegroundColor White
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   FRONTEND:" -ForegroundColor Yellow
Write-Host "   $urlFe" -ForegroundColor White
Write-Host ""
Write-Host "   API PYTHON (FastAPI):" -ForegroundColor Green
Write-Host "   $urlApi" -ForegroundColor White
Write-Host "   $urlApi/docs" -ForegroundColor Gray
Write-Host ""
Write-Host "   GEO-SERVICE (TypeScript):" -ForegroundColor Magenta
Write-Host "   $urlGeo" -ForegroundColor White
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "  IMPORTANTE: Deja abiertas las 3 ventanas de tunel           " -ForegroundColor Yellow
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""

# Guardar en archivo
$summaryFile = Join-Path $root "CLOUDFLARE-URLS.txt"
@"
URLS PUBLICAS - $(Get-Date -Format 'yyyy-MM-dd HH:mm')
============================================================
FRONTEND:   $urlFe
API Python: $urlApi
            $urlApi/docs
            $urlApi/api/health
Geo TS:     $urlGeo
            $urlGeo/api/truck-locations
============================================================
NOTA: URLs temporales, cambian al reiniciar cloudflared.
"@ | Out-File $summaryFile -Encoding UTF8

Write-Host "  Resumen guardado en CLOUDFLARE-URLS.txt" -ForegroundColor Cyan
Write-Host ""
