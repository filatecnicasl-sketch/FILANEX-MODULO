@echo off
REM Instala la tarea diaria de copia de seguridad de FILANEX en el Programador
REM de tareas de Windows. Ejecutar UNA VEZ en cada instalacion local de cliente.
REM
REM La tarea genera la copia de todas las empresas en C:\backup\filanex:
REM   - todos los dias a las 08:30;
REM   - si el PC estaba apagado a esa hora, al encenderlo (StartWhenAvailable);
REM   - funciona aunque la aplicacion FILANEX este cerrada (solo necesita MongoDB).
setlocal
set DIR=%~dp0..
set TAREA=FilanexCopiaDiaria

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$node = (Get-Command node).Source;" ^
  "$action = New-ScheduledTaskAction -Execute $node -Argument 'scripts\backup-local.mjs' -WorkingDirectory '%DIR%';" ^
  "$trigger = New-ScheduledTaskTrigger -Daily -At 08:30;" ^
  "$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30);" ^
  "Register-ScheduledTask -TaskName '%TAREA%' -Action $action -Trigger $trigger -Settings $settings -Description 'Copia diaria de FILANEX en C:\backup\filanex (automatica y manuales visibles en Ajustes -^> Copias)' -Force | Out-Null;" ^
  "Write-Host 'Tarea %TAREA% instalada: diaria 08:30, se recupera si el PC estaba apagado.'"

if %errorlevel%==0 (echo Instalada correctamente.) else (echo ERROR instalando la tarea. Ejecuta este archivo como administrador.)
endlocal
