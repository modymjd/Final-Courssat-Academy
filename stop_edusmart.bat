@echo off
title Stopping EduSmart Platform...
echo ========================================================
echo        EduSmart Platform - Shutdown & Restore
echo ========================================================
echo.

echo [1/2] Stopping Backend server on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/2] Stopping Frontend server on port 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ========================================================
echo [SUCCESS] EduSmart processes stopped successfully!
echo           System restored to normal state.
echo ========================================================
echo.
pause
