@echo off
REM Copia de seguridad de la base de datos NEXOSPRO (MongoDB).
REM Requiere mongodump en el PATH (MongoDB Database Tools).
REM Uso: backup-mongo.cmd  -> crea backups\AAAAMMDD-HHMM\nexospro\
setlocal
set FECHA=%date:~6,4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%
set FECHA=%FECHA: =0%
set DESTINO=%~dp0..\..\backups\%FECHA%
mongodump --uri="mongodb://localhost:27017/nexospro" --out="%DESTINO%"
if %errorlevel%==0 (echo Copia creada en %DESTINO%) else (echo ERROR en la copia)
endlocal
