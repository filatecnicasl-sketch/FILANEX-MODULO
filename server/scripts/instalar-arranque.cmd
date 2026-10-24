@echo off
REM Instala el arranque automatico del servidor FILANEX en Windows: copia
REM filanex-arranque.cmd a la carpeta de inicio del usuario. Al iniciar sesion,
REM "pm2 resurrect" levanta la API guardada con pm2 save. No requiere
REM administrador. Ejecutar una vez (o dejar que lo haga el propio servidor).
setlocal
set INICIO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy /y "%~dp0filanex-arranque.cmd" "%INICIO%\filanex-arranque.cmd" >nul
if %errorlevel%==0 (echo Instalado: la API arrancara sola al iniciar sesion.) else (echo ERROR copiando a la carpeta de inicio.)
endlocal
