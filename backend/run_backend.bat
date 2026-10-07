@echo off
title MES Level 3 - SCADA OPC UA Gateway Bridge
cd /d "%~dp0"
echo ======================================================================
echo    ISA-95 LEVEL 3 MOM - SCADA OPC UA GATEWAY SERVICE
echo    Target SCADA Endpoint: opc.tcp://127.0.0.1:4890
echo    Local FastAPI Port:    http://127.0.0.1:8000
echo ======================================================================
echo.

set "PY_CMD="
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PY_CMD=py"
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PY_CMD=python"
    ) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\python.exe" (
        set "PY_CMD=C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python39_64\python.exe"
    )
)

if defined PY_CMD (
    echo [INFO] Starting Uvicorn with: %PY_CMD%
    "%PY_CMD%" -m uvicorn scada_gateway:app --host 0.0.0.0 --port 8000 --reload
) else (
    echo [ERROR] No Python installation found.
    pause
)
