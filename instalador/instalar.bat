@echo off
setlocal EnableDelayedExpansion
title Instalador FILANEX
echo ============================================================
echo   FILANEX - Instalacion en este equipo
echo ============================================================
echo.
echo  Este script:
echo   1. Comprueba Node.js y MongoDB
echo   2. Copia la aplicacion a C:\Filanex\app
echo   3. Instala dependencias y compila el cliente
echo   4. Crea la configuracion (.env) con claves aleatorias
echo   5. Registra FILANEX como servicio de Windows (NSSM)
echo   6. Programa una copia de seguridad diaria de la base de datos
echo.
echo  Ejecutar como ADMINISTRADOR.
echo.
pause

set DESTINO=C:\Filanex
set ORIGEN=%~dp0..
set PUERTO=4700

echo.
echo [1/6] Comprobando requisitos...
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado.
  echo Descargalo de https://nodejs.org ^(version LTS^) y vuelve a ejecutar este script.
  pause & exit /b 1
)
node -v
where mongod >nul 2>nul
if errorlevel 1 (
  echo AVISO: MongoDB no encontrado en el PATH.
  echo Si MongoDB esta instalado como servicio, no pasa nada; si no, instalalo
  echo de https://www.mongodb.com/try/download/community marcando "Install as service".
  echo.
  pause
)

echo.
echo [2/6] Copiando la aplicacion a %DESTINO%\app ...
if not exist "%DESTINO%" mkdir "%DESTINO%"
robocopy "%ORIGEN%\server" "%DESTINO%\app\server" /MIR /XD node_modules uploads >nul
robocopy "%ORIGEN%\client" "%DESTINO%\app\client" /MIR /XD node_modules dist >nul
echo Copia terminada.

echo.
echo [3/6] Instalando dependencias y compilando (puede tardar unos minutos)...
cd /d "%DESTINO%\app\server"
call npm install --omit=dev || (echo ERROR instalando el servidor & pause & exit /b 1)
cd /d "%DESTINO%\app\client"
call npm install || (echo ERROR instalando el cliente & pause & exit /b 1)
call npm run build || (echo ERROR compilando el cliente & pause & exit /b 1)

echo.
echo [4/6] Creando configuracion .env ...
if not exist "%DESTINO%\app\server\.env" (
  for /f "delims=" %%s in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')"') do set JWT=%%s
  (
    echo PORT=%PUERTO%
    echo MONGODB_URI=mongodb://localhost:27017/nexospro
    echo JWT_SECRET=!JWT!
    echo AEAT_ENTORNO=pruebas
  ) > "%DESTINO%\app\server\.env"
  echo .env creado con clave JWT aleatoria.
) else (
  echo .env ya existe: no se toca.
)

echo.
echo [5/6] Registrando el servicio de Windows...
set NSSM=%DESTINO%\nssm\nssm.exe
if not exist "%NSSM%" (
  echo Descargando NSSM (gestor de servicios)...
  if not exist "%DESTINO%\nssm" mkdir "%DESTINO%\nssm"
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%DESTINO%\nssm\nssm.zip'; Expand-Archive -Force '%DESTINO%\nssm\nssm.zip' '%DESTINO%\nssm\tmp'; Copy-Item '%DESTINO%\nssm\tmp\nssm-2.24\win64\nssm.exe' '%DESTINO%\nssm\nssm.exe'; Remove-Item -Recurse -Force '%DESTINO%\nssm\tmp','%DESTINO%\nssm\nssm.zip'"
)
if not exist "%NSSM%" (
  echo AVISO: no se pudo descargar NSSM ^(sin internet?^).
  echo Descarga nssm.exe de https://nssm.cc/download y copialo en %DESTINO%\nssm\
  echo Despues ejecuta: %DESTINO%\nssm\nssm.exe install Filanex "%ProgramFiles%\nodejs\node.exe" "%DESTINO%\app\server\src\index.js"
  goto backup
)
"%NSSM%" stop Filanex >nul 2>nul
"%NSSM%" remove Filanex confirm >nul 2>nul
for /f "delims=" %%n in ('where node') do set NODEEXE=%%n & goto nodok
:nodok
"%NSSM%" install Filanex "!NODEEXE!" "%DESTINO%\app\server\src\index.js"
"%NSSM%" set Filanex AppDirectory "%DESTINO%\app\server"
"%NSSM%" set Filanex DisplayName "FILANEX - Facturacion"
"%NSSM%" set Filanex Description "Aplicacion de facturacion FILANEX (puerto %PUERTO%)"
"%NSSM%" set Filanex Start SERVICE_AUTO_START
"%NSSM%" set Filanex AppStdout "%DESTINO%\logs\filanex.log"
"%NSSM%" set Filanex AppStderr "%DESTINO%\logs\filanex.log"
if not exist "%DESTINO%\logs" mkdir "%DESTINO%\logs"
"%NSSM%" start Filanex
echo Servicio Filanex instalado y arrancado ^(se inicia solo con Windows^).

:backup
echo.
echo [6/6] Programando copia de seguridad diaria (21:30)...
if not exist "%DESTINO%\backups" mkdir "%DESTINO%\backups"
copy /y "%~dp0backup.bat" "%DESTINO%\backup.bat" >nul
schtasks /create /tn "Filanex-Backup" /tr "\"%DESTINO%\backup.bat\"" /sc daily /st 21:30 /f >nul 2>nul
if errorlevel 1 (echo AVISO: no se pudo programar la tarea. Ejecuta %DESTINO%\backup.bat a mano cuando quieras.) else (echo Copia diaria programada a las 21:30 en %DESTINO%\backups.)

echo.
echo ============================================================
echo   INSTALACION TERMINADA
echo ============================================================
echo.
echo  Abre el navegador en:  http://localhost:%PUERTO%
echo.
echo  Primera vez:
echo   1. Crea la cuenta de administrador (pantalla de acceso).
echo   2. Sigue el asistente de configuracion inicial.
echo.
echo  Desde otros equipos o moviles del local:
echo   http://IP-DE-ESTE-EQUIPO:%PUERTO%   (misma red / WiFi)
echo.
pause
