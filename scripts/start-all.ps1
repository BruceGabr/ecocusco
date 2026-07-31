$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$databaseUrl = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@localhost:5432/sir_cusco" }

Write-Host ""
Write-Host "Modo: $(if ($env:DATABASE_URL) { 'PostgreSQL' } else { 'MEMORIA (sin BD)' })" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "Geo TS:   http://localhost:3100" -ForegroundColor Cyan
Write-Host ""

function Start-ServiceProcess {
  param(
    [string]$Name,
    [string]$Command,
    [string]$WorkingDirectory,
    [string]$Port
  )

  Write-Host "Iniciando $Name (puerto $Port)..." -ForegroundColor Cyan
  $envSetup = if ($databaseUrl) { "`$env:DATABASE_URL=`"$databaseUrl`"; " } else { "" }
  Start-Process powershell -ArgumentList @(
    "-ExecutionPolicy",
    "Bypass",
    "-NoExit",
    "-Command",
    "Set-Location `"$WorkingDirectory`"; $envSetup$Command; Write-Host ''; Write-Host 'Cierra esta ventana para detener el servicio' -ForegroundColor Yellow"
  ) -WindowStyle Normal | Out-Null
  
  Start-Sleep -Milliseconds 500
}

function Get-CommandVersion {
  param([string]$Command)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "powershell"
  $psi.Arguments = "-ExecutionPolicy Bypass -Command `"$Command --version`""
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $p = [System.Diagnostics.Process]::Start($psi)
  $p.WaitForExit(10000) | Out-Null
  if ($p.ExitCode -eq 0) {
    return ($p.StandardOutput.ReadToEnd()).Trim()
  }
  return $null
}

$npmVersion = Get-CommandVersion "npm"
$pythonVersion = Get-CommandVersion "python"

if (-not $npmVersion) {
  Write-Host "Error: npm no encontrado. Instala Node.js desde https://nodejs.org/" -ForegroundColor Red
  exit 1
}

if (-not $pythonVersion) {
  Write-Host "Error: Python no encontrado. Instala Python desde https://www.python.org/" -ForegroundColor Red
  exit 1
}

Write-Host "OK npm $npmVersion encontrado" -ForegroundColor Green
Write-Host "OK Python $pythonVersion encontrado" -ForegroundColor Green
Write-Host ""

$venvPython = Join-Path $root "backend-python\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
  $venvPython = Join-Path $root "backend-python\.venv\bin\python.exe"
}
if (-not (Test-Path $venvPython)) {
  $venvPython = Join-Path $root ".venv\Scripts\python.exe"
}
$pythonCommand = if (Test-Path $venvPython) {
  "`"$venvPython`" -m uvicorn app.main:app --reload --app-dir `"$root\backend-python`" --host 0.0.0.0 --port 8000"
} else {
  "python -m uvicorn app.main:app --reload --app-dir `"$root\backend-python`" --host 0.0.0.0 --port 8000"
}

Start-ServiceProcess -Name "FastAPI Backend" -Command $pythonCommand -WorkingDirectory (Join-Path $root "backend-python") -Port "8000"
Start-ServiceProcess -Name "Geo/Alertas TypeScript" -Command "npm run dev" -WorkingDirectory (Join-Path $root "backend-typescript") -Port "3100"
Start-ServiceProcess -Name "Frontend React (Vite)" -Command "npm run dev" -WorkingDirectory (Join-Path $root "frontend") -Port "5173"

Write-Host ""
Write-Host "Todos los servicios iniciados. Abre tu navegador en:" -ForegroundColor Green
Write-Host "   http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pruebas de conexion:" -ForegroundColor Cyan
Write-Host "   Backend API:    http://localhost:8000/api/health" -ForegroundColor Gray
Write-Host "   API Docs:       http://localhost:8000/docs" -ForegroundColor Gray
Write-Host "   Geo Service:    http://localhost:3100/health" -ForegroundColor Gray
Write-Host ""
Write-Host "Para detener los servicios, cierra las 3 ventanas de PowerShell abiertas." -ForegroundColor Yellow
Write-Host ""
