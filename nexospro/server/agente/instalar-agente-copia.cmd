@echo off
REM Instalador del agente de copia local de FILANEX para el PC del cliente.
REM
REM 1. Copie esta carpeta (agente) a un lugar fijo, p.ej. C:\filanex-agente
REM 2. Edite agente-copia.config con la URL y el token de su empresa
REM    (en FILANEX: Ajustes -> Copias -> Copia local automatica)
REM 3. Ejecute este archivo UNA VEZ.
REM
REM Desde entonces, cada dia a las 09:00 (o al encender el PC si estaba
REM apagado) su copia de seguridad mas reciente se descargara sola a
REM C:\backup\filanex. Sus datos, en su ordenador, todos los dias.
setlocal
set DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$action = New-ScheduledTaskAction -Execute 'powershell' -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%DIR%agente-copia.ps1\"';" ^
  "$trigger = New-ScheduledTaskTrigger -Daily -At 09:00;" ^
  "$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30);" ^
  "Register-ScheduledTask -TaskName 'FilanexCopiaLocal' -Action $action -Trigger $trigger -Settings $settings -Description 'Descarga diaria de la copia de seguridad de FILANEX a este equipo' -Force | Out-Null;" ^
  "Write-Host 'Tarea FilanexCopiaLocal instalada: diaria 09:00, se recupera si el PC estaba apagado.'"
if %errorlevel%==0 (
  echo Instalado correctamente. Probando la primera descarga...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%DIR%agente-copia.ps1"
) else (
  echo ERROR instalando la tarea.
)
endlocal
pause
