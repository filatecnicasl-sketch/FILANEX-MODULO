@echo off
rem Copia de seguridad diaria de la base de datos de FILANEX.
rem Guarda en C:\Filanex\backups\AAAA-MM-DD y conserva los ultimos 14 dias.
setlocal
set DESTINO=C:\Filanex\backups
set FECHA=%date:~6,4%-%date:~3,2%-%date:~0,2%

where mongodump >nul 2>nul
if errorlevel 1 (
  set MONGODUMP=C:\Program Files\MongoDB\Server\8.0\bin\mongodump.exe
) else (
  set MONGODUMP=mongodump
)

"%MONGODUMP%" --db nexospro --out "%DESTINO%\%FECHA%" >nul 2>nul

rem Borra copias de mas de 14 dias
forfiles /p "%DESTINO%" /d -14 /c "cmd /c if @isdir==TRUE rd /s /q @path" 2>nul
