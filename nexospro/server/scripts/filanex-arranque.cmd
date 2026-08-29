@echo off
REM Arranque automatico de FILANEX: pm2 resurrect levanta la API guardada con
REM pm2 save. Este archivo lo crea instalar-arranque.cmd en la carpeta de
REM inicio de Windows del usuario (no requiere permisos de administrador).
start "" /min "%APPDATA%\npm\pm2.cmd" resurrect
