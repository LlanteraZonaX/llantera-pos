@echo off
chcp 65001 >nul
title Actualizar Llantera POS
color 0A
cls

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║              ACTUALIZAR LLANTERA POS                    ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Este proceso descarga el código mas reciente (si usas git),
echo  actualiza dependencias y aplica cualquier cambio nuevo a la
echo  base de datos SIN borrar la informacion que ya tienes.
echo.
pause

echo.
echo  [1/3] Actualizando dependencias del backend...
cd ..\backend
call npm install --silent
if %errorLevel% neq 0 (
    echo  [ERROR] Fallo al actualizar dependencias del backend
    pause
    exit /b 1
)

echo.
echo  [2/3] Actualizando dependencias del frontend...
cd ..
call npm install --silent
if %errorLevel% neq 0 (
    echo  [ERROR] Fallo al actualizar dependencias del frontend
    pause
    exit /b 1
)

echo.
echo  [3/3] Aplicando migraciones de base de datos...
echo  (Si no hay nada nuevo, no se modifica nada)
cd backend
call npm run migrate
if %errorLevel% neq 0 (
    echo.
    echo  [ERROR] Una migracion fallo. Tu base de datos NO quedo dañada:
    echo  el sistema revierte automaticamente cualquier cambio a medias.
    echo  Revisa el mensaje de error arriba y contacta a soporte.
    pause
    exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║         ACTUALIZACION COMPLETADA CORRECTAMENTE           ║
echo  ║         Tu informacion existente esta intacta            ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
