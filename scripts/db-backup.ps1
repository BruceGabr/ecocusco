param(
    [switch]$UseDocker
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backupDir = Join-Path -Path $scriptDir -ChildPath "..\database\backup"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}
$backupDir = Resolve-Path -Path $backupDir | Select-Object -ExpandProperty Path

$timestamp = Get-Date -Format yyyyMMddHHmmss
$backupFile = Join-Path $backupDir "sir_cusco-$timestamp.dump"

if ($UseDocker) {
    Write-Host "Generando respaldo Docker en $backupFile"
    $containerDump = "/tmp/sir_cusco-$timestamp.dump"
    if ($env:PGPASSWORD) {
        docker exec -e PGPASSWORD=$env:PGPASSWORD -i sir_cusco_postgres pg_dump -U postgres -Fc -d sir_cusco -f $containerDump
    } else {
        docker exec -i sir_cusco_postgres pg_dump -U postgres -Fc -d sir_cusco -f $containerDump
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al generar el respaldo dentro del contenedor. Verifica que PostgreSQL esté en ejecución y que la conexión sea correcta."
        exit $LASTEXITCODE
    }
    docker cp "sir_cusco_postgres:$containerDump" "$backupFile"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al copiar el respaldo desde el contenedor al host."
        exit $LASTEXITCODE
    }
    docker exec sir_cusco_postgres rm -f $containerDump | Out-Null
} else {
    Write-Host "Generando respaldo local en $backupFile"
    pg_dump -U postgres -Fc -d sir_cusco -f $backupFile
}

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backupFile)) {
    Write-Error "Error al generar el respaldo. Verifica que PostgreSQL esté en ejecución y que la conexión sea correcta."
    exit $LASTEXITCODE
}

Write-Host "Respaldo completado: $backupFile"
