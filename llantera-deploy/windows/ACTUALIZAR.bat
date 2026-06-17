@echo off
chcp 65001 >nul
title Actualizar Llantera POS
echo.
echo  Actualizando dependencias...
cd ..\backend && npm install --silent
cd ..         && npm install --silent
echo  [OK] Actualización completada.
pause
