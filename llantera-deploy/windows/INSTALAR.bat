@echo off
chcp 65001 >nul
title Instalador - Llantera POS v1.0
color 0A
cls

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║           LLANTERA POS v1.0 - INSTALADOR                ║
echo  ║        Sistema Punto de Venta para Llanterías            ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Este instalador verificará e instalará todos los componentes
echo  necesarios para ejecutar el sistema en tu PC con Windows.
echo.
pause

:: ─── Verificar derechos de administrador ───────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [ERROR] Este instalador requiere permisos de Administrador.
    echo  Haz clic derecho en INSTALAR.bat y selecciona:
    echo  "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

echo.
echo  [1/6] Verificando Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  Node.js no encontrado. Descargando instalador...
    echo  Se abrirá el navegador. Instala Node.js LTS y vuelve a ejecutar este archivo.
    start https://nodejs.org/es/download/
    echo.
    echo  Una vez instalado Node.js, cierra esta ventana y vuelve a ejecutar INSTALAR.bat
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
    echo  [OK] Node.js %NODE_VER% detectado
)

echo.
echo  [2/6] Verificando PostgreSQL...
pg_isready >nul 2>&1
if %errorLevel% neq 0 (
    echo  PostgreSQL no encontrado o no está corriendo.
    echo.
    echo  Opciones:
    echo  A) Descargar PostgreSQL: https://www.postgresql.org/download/windows/
    echo  B) Si ya lo instalaste, asegurate de que el servicio esté iniciado:
    echo     Panel de control → Servicios → postgresql-x64-xx → Iniciar
    echo.
    set /p CONTINUE="¿Deseas continuar de todas formas? (s/n): "
    if /i "%CONTINUE%" neq "s" exit /b 1
) else (
    echo  [OK] PostgreSQL detectado y corriendo
)

echo.
echo  [3/6] Configurando variables de entorno del backend...

:: ─── Pedir datos de configuración ──────────────────────────────
echo.
echo  ┌─────────────────────────────────────────────┐
echo  │  Configuración de la base de datos          │
echo  └─────────────────────────────────────────────┘
set /p DB_HOST="  Host PostgreSQL [localhost]: "
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT="  Puerto PostgreSQL [5432]: "
if "%DB_PORT%"=="" set DB_PORT=5432

set /p DB_NAME="  Nombre de la base de datos [llantera_db]: "
if "%DB_NAME%"=="" set DB_NAME=llantera_db

set /p DB_USER="  Usuario PostgreSQL [postgres]: "
if "%DB_USER%"=="" set DB_USER=postgres

set /p DB_PASS="  Contraseña PostgreSQL: "

echo.
echo  ┌─────────────────────────────────────────────┐
echo  │  Configuración del administrador            │
echo  └─────────────────────────────────────────────┘
set /p ADMIN_EMAIL="  Email del administrador [admin@llantera.com]: "
if "%ADMIN_EMAIL%"=="" set ADMIN_EMAIL=admin@llantera.com

set /p ADMIN_PASS="  Contraseña del administrador [Admin2024!]: "
if "%ADMIN_PASS%"=="" set ADMIN_PASS=Admin2024!

:: Generar JWT secret aleatorio (fecha + variables)
set JWT_SECRET=LlanteraPOS_%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set JWT_SECRET=%JWT_SECRET: =0%

:: Escribir .env del backend
echo DB_HOST=%DB_HOST%> ..\backend\.env
echo DB_PORT=%DB_PORT%>> ..\backend\.env
echo DB_NAME=%DB_NAME%>> ..\backend\.env
echo DB_USER=%DB_USER%>> ..\backend\.env
echo DB_PASSWORD=%DB_PASS%>> ..\backend\.env
echo PORT=3001>> ..\backend\.env
echo NODE_ENV=production>> ..\backend\.env
echo JWT_SECRET=%JWT_SECRET%>> ..\backend\.env
echo FRONTEND_URL=http://localhost:5173>> ..\backend\.env
echo ADMIN_EMAIL=%ADMIN_EMAIL%>> ..\backend\.env
echo ADMIN_PASSWORD=%ADMIN_PASS%>> ..\backend\.env

echo  [OK] Archivo .env creado

echo.
echo  [4/6] Instalando dependencias del backend...
cd ..\backend
call npm install --silent
if %errorLevel% neq 0 (
    echo  [ERROR] Fallo al instalar dependencias del backend
    pause
    exit /b 1
)
echo  [OK] Dependencias del backend instaladas

echo.
echo  [5/6] Instalando dependencias del frontend...
cd ..
call npm install --silent
if %errorLevel% neq 0 (
    echo  [ERROR] Fallo al instalar dependencias del frontend
    pause
    exit /b 1
)
echo  [OK] Dependencias del frontend instaladas

echo.
echo  [6/6] Inicializando base de datos...
cd backend
call node src/scripts/setup-db.js
if %errorLevel% neq 0 (
    echo.
    echo  [ERROR] No se pudo inicializar la base de datos.
    echo  Verifica que PostgreSQL esté corriendo y que los datos de conexión sean correctos.
    pause
    exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║             ¡INSTALACIÓN COMPLETADA!                    ║
echo  ╠══════════════════════════════════════════════════════════╣
echo  ║                                                          ║
echo  ║  Para iniciar el sistema usa: INICIAR.bat               ║
echo  ║                                                          ║
echo  ║  Credenciales de acceso:                                ║
echo  ║  • Email    : %ADMIN_EMAIL%
echo  ║  • Password : %ADMIN_PASS%
echo  ║                                                          ║
echo  ║  ⚠  IMPORTANTE: Cambia la contraseña al ingresar        ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
