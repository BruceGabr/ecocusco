param(
    [string]$File = "database\backup\sir_cusco.dump",
    [switch]$UseDocker
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$defaultFile = Join-Path -Path $scriptDir -ChildPath "..\database\backup\sir_cusco.dump"
if ($File -eq "database\backup\sir_cusco.dump") {
    $File = Resolve-Path -Path $defaultFile
}

if (-not $UseDocker -and -not (Test-Path $File)) {
    Write-Error "No se encontró el archivo de respaldo: $File"
    exit 1
}

if ($UseDocker) {
    Write-Host "Restaurando respaldo Docker desde $File"
    $containerDump = "/tmp/$(Split-Path -Leaf $File)"
    docker cp "$File" "sir_cusco_postgres:$containerDump"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al copiar el archivo de respaldo al contenedor."
        exit $LASTEXITCODE
    }
    if ($env:PGPASSWORD) {
        docker exec -e PGPASSWORD=$env:PGPASSWORD -i sir_cusco_postgres pg_restore --clean --if-exists -U postgres -d sir_cusco $containerDump
    } else {
        docker exec -i sir_cusco_postgres pg_restore --clean --if-exists -U postgres -d sir_cusco $containerDump
    }
    docker exec sir_cusco_postgres rm -f $containerDump | Out-Null
} else {
    Write-Host "Restaurando respaldo local desde $File"
    psql -U postgres -c "DROP DATABASE IF EXISTS sir_cusco;"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al eliminar la base de datos sir_cusco. Verifica la conexión a PostgreSQL."
        exit $LASTEXITCODE
    }
    psql -U postgres -c "CREATE DATABASE sir_cusco;"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al crear la base de datos sir_cusco. Verifica la conexión a PostgreSQL."
        exit $LASTEXITCODE
    }
    pg_restore --clean --if-exists -U postgres -d sir_cusco $File
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Error al restaurar el respaldo. Verifica que PostgreSQL esté en ejecución y que el archivo de backup sea válido."
    exit $LASTEXITCODE
}

Write-Host "Restauración completada desde: $File"
