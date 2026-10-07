@echo off
title MES PRODUCTION SYSTEM (Industrial Launcher)
cls
echo =========================================================================
echo               MES PRODUCTION SYSTEM - LAUNCHER
echo =========================================================================

echo [1/5] Pre-launch Cleanup: Clearing any leftover background processes...
taskkill /F /IM python.exe /T >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    if %%a NEQ 0 ( taskkill /F /T /PID %%a >nul 2>&1 )
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    if %%a NEQ 0 ( taskkill /F /T /PID %%a >nul 2>&1 )
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    if %%a NEQ 0 ( taskkill /F /T /PID %%a >nul 2>&1 )
)

echo [2/5] Starting Python FastAPI Kepware Gateway (Port 8000)...
start "MES_Gateway_Service" /min cmd /c "python -m uvicorn backend.kepware_gateway:app --host 127.0.0.1 --port 8000"

echo [3/5] Starting Vite Dev Server (Port 3000)...
start "MES_Vite_Service" /min cmd /c "npm run dev"

echo [4/5] Waiting for Gateway (8000) and Vite (3000) to initialize...
:wait_gateway
timeout /t 1 >nul
curl -s -f http://127.0.0.1:8000/docs >nul 2>&1
if %errorlevel% neq 0 (
    goto wait_gateway
)

:wait_vite
timeout /t 1 >nul
curl -s -f http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    goto wait_vite
)

echo [5/5] Services operational! Launching MES Desktop Application...
npx electron electron/main.cjs

echo =========================================================================
echo Application closed by operator. Executing Post-Exit Zero-Footprint Cleanup...
echo =========================================================================
taskkill /F /IM python.exe /T >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    if %%a NEQ 0 ( taskkill /F /T /PID %%a >nul 2>&1 )
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    if %%a NEQ 0 ( taskkill /F /T /PID %%a >nul 2>&1 )
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    if %%a NEQ 0 ( taskkill /F /T /PID %%a >nul 2>&1 )
)

echo [OK] All MES services and background tasks terminated cleanly. Zero background footprint.
timeout /t 2 >nul
exit
