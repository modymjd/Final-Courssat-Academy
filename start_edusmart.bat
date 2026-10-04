@echo off
title Launching EduSmart Platform...
echo ========================================================
echo         EduSmart Platform - Local Launcher
echo ========================================================
echo.

:: 1. Check and Start PostgreSQL Service
echo [1/4] Checking PostgreSQL database service...
net start postgresql-x64-18 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PostgreSQL service started.
) else (
    echo [INFO] PostgreSQL service is ready.
)
echo.

:: 2. Launch Django Backend Server
echo [2/4] Starting Backend (Django REST Framework on http://127.0.0.1:8000)...
start "EduSmart Backend" cmd /k "cd /d %~dp0Backend && call .venv\Scripts\activate.bat && .venv\Scripts\python.exe manage.py migrate && .venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000"

:: 3. Launch React Frontend Server
echo [3/4] Starting Frontend (React + Vite on http://localhost:8080)...
start "EduSmart Frontend" cmd /k "cd /d %~dp0Frontend && npm run dev"

:: 4. Wait for servers to initialize, then open browser
echo [4/4] Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

echo.
echo ========================================================
echo [SUCCESS] EduSmart is running! Opening browser...
echo   - Frontend UI:  http://localhost:8080/
echo   - Backend API:  http://127.0.0.1:8000/api/v1/
echo   - Admin Panel:  http://127.0.0.1:8000/admin/
echo ========================================================
echo.
start http://localhost:8080/

pause
