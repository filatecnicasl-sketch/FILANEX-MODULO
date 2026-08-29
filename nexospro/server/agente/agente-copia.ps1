# Agente de copia local de FILANEX
# Descarga la copia de seguridad mas reciente de la empresa desde la nube a
# este equipo. Pensado para ejecutarse a diario mediante la tarea programada
# que crea instalar-agente-copia.cmd. Los datos quedan siempre en tu poder.
#
# Configuracion: junto a este script debe existir agente-copia.config con:
#   URL=https://api.filanex.es
#   TOKEN=fbk_xxxxxxxxxxxxxxxx      (Ajustes -> Copias -> Copia local automatica)
#   CARPETA=C:\backup\filanex       (opcional)
#   CONSERVAR=14                    (opcional, copias que se conservan)
$ErrorActionPreference = "Stop"

$dirScript = Split-Path -Parent $MyInvocation.MyCommand.Path
$config = @{}
Get-Content (Join-Path $dirScript "agente-copia.config") | ForEach-Object {
  if ($_ -match "^\s*([A-Z]+)\s*=\s*(.+?)\s*$") { $config[$Matches[1]] = $Matches[2] }
}

$url = $config["URL"]; $token = $config["TOKEN"]
if (-not $url -or -not $token) { Write-Error "Falta URL o TOKEN en agente-copia.config"; exit 1 }
$carpeta = if ($config["CARPETA"]) { $config["CARPETA"] } else { "C:\backup\filanex" }
$conservar = if ($config["CONSERVAR"]) { [int]$config["CONSERVAR"] } else { 14 }
$cabeceras = @{ "X-Backup-Token" = $token }

# 1. Pregunta cual es la ultima copia disponible.
$info = Invoke-RestMethod -Uri "$url/api/backups-agente/ultima" -Headers $cabeceras -TimeoutSec 60
$destinoDir = Join-Path $carpeta $info.empresa
New-Item -ItemType Directory -Force -Path $destinoDir | Out-Null
$destino = Join-Path $destinoDir $info.archivo

# 2. Si ya la tenemos con el mismo tamano, no se vuelve a descargar.
if ((Test-Path $destino) -and ((Get-Item $destino).Length -eq $info.tamano)) {
  Write-Host "[agente-copia] Ya al dia: $($info.archivo)"
  exit 0
}

# 3. Descarga a archivo temporal y renombra solo si se completo bien.
$temporal = "$destino.parcial"
Invoke-WebRequest -Uri "$url/api/backups-agente/ultima/descargar" -Headers $cabeceras -OutFile $temporal -TimeoutSec 600
if ((Get-Item $temporal).Length -ne $info.tamano) {
  Remove-Item $temporal -Force
  Write-Error "Descarga incompleta de $($info.archivo)"; exit 1
}
Move-Item -Force $temporal $destino
Write-Host "[agente-copia] Guardada: $destino ($([math]::Round($info.tamano/1KB)) KB)"

# 4. Conserva solo las N copias mas recientes descargadas en este equipo.
Get-ChildItem $destinoDir -Filter "backup-*.zip" |
  Sort-Object Name -Descending |
  Select-Object -Skip $conservar |
  Remove-Item -Force
