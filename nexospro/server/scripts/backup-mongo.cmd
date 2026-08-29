@echo off
REM Copia de seguridad COMPLETA del servidor local (todas las bases filanex_*),
REM pensada para desastre total. Es la segunda capa: la primera son las copias
REM por empresa que genera la propia aplicacion cada noche (Ajustes -^> Copias).
REM
REM Requiere mongodump en el PATH (MongoDB Database Tools).
REM Uso:  backup-mongo.cmd  -> crea C:\backup\filanex\mongo\AAAAMMDD-HHMM\
REM Se puede cambiar la carpeta:  set BACKUP_SERVIDOR_DIR=D:\copias\mongo
setlocal
set FECHA=%date:~6,4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%
set FECHA=%FECHA: =0%
if "%BACKUP_SERVIDOR_DIR%"=="" set BACKUP_SERVIDOR_DIR=C:\backup\filanex\mongo
set DESTINO=%BACKUP_SERVIDOR_DIR%\%FECHA%
mongodump --uri="mongodb://localhost:27017" --gzip --out="%DESTINO%"
if %errorlevel%==0 (echo Copia creada en %DESTINO%) else (echo ERROR en la copia)
REM Restaurar en caso de desastre (solo las bases de la aplicacion):
REM   mongorestore --uri="mongodb://localhost:27017" --gzip --nsInclude "filanex*" "%DESTINO%"
endlocal
