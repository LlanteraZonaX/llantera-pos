@echo off
chcp 65001 >nul
title Detener Llantera POS
echo.
echo  Deteniendo Llantera POS...
taskkill /f /fi "WINDOWTITLE eq Llantera API*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Llantera Frontend*" >nul 2>&1
echo  [OK] Sistema detenido.
timeout /t 2 /nobreak >nul
