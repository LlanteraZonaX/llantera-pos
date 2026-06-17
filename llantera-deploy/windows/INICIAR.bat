@echo off
chcp 65001 >nul
title Llantera POS v1.0
color 0A
cls

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║               LLANTERA POS v1.0                         ║
echo  ║            Iniciando el sistema...                       ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Verificar que está instalado
if not exist "..\backend\.env" (
    echo  [ERROR] El sistema no está instalado.
    echo  Ejecuta primero INSTALAR.bat
    pause
    exit /b 1
)

echo  Iniciando backend API...
start "Llantera API" cmd /k "cd /d %~dp0..\backend && node src/index.js"

echo  Esperando que el servidor inicie...
timeout /t 3 /nobreak >nul

echo  Iniciando interfaz web...
start "Llantera Frontend" cmd /k "cd /d %~dp0.. && npm run dev"

echo  Esperando que la interfaz inicie...
timeout /t 4 /nobreak >nul

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                 SISTEMA INICIADO                        ║
echo  ╠══════════════════════════════════════════════════════════╣
echo  ║                                                          ║
echo  ║   Abriendo el navegador...                              ║
echo  ║   URL: http://localhost:5173                            ║
echo  ║                                                          ║
echo  ║   Para detener el sistema, cierra las ventanas          ║
echo  ║   que se abrieron con "Llantera API" y "Frontend"       ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Abrir navegador
timeout /t 2 /nobreak >nul
start http://localhost:5173

pause
