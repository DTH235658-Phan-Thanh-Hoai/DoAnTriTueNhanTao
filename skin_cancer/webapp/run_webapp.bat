@echo off
setlocal enabledelayedexpansion
title Skin Cancer Classifier - Launcher

cd /d "%~dp0"

cls
echo.
echo  ============================================================
echo    DERMASCAN AI - SKIN CANCER CLASSIFIER
echo    EfficientNet-B0 ^| ISIC 2019 ^| 8-Class Classification
echo  ============================================================
echo.

REM ---------- 1. Check Python ----------
where python >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found.
    echo          Please install Python 3.9+ from https://python.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo  [1/4] Python detected: v!PYVER!

REM ---------- 2. Virtual environment ----------
if not exist "env\Scripts\activate.bat" (
    echo  [2/4] Creating virtual environment...
    python -m venv env
    if errorlevel 1 (
        echo  [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
) else (
    echo  [2/4] Virtual environment ready.
)

call env\Scripts\activate.bat

REM ---------- 3. Dependencies ----------
python -c "import flask, torch, timm, grad_cam, PIL" >nul 2>&1
if errorlevel 1 (
    echo  [3/4] Installing dependencies - this may take 3-5 minutes...
    python -m pip install --upgrade pip --quiet
    pip install -r "requirements.txt"
    if errorlevel 1 (
        echo  [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
    echo  [3/4] Dependencies installed.
) else (
    echo  [3/4] All dependencies satisfied.
)

REM ---------- 4. Verify checkpoints ----------
if not exist "skin_cancer\checkpoints\best_binary.pth" (
    echo  [WARN] Missing: skin_cancer\checkpoints\best_binary.pth
)
if not exist "skin_cancer\checkpoints\best_multiclass.pth" (
    echo  [WARN] Missing: skin_cancer\checkpoints\best_multiclass.pth
)

echo  [4/4] Launching server...
echo.
echo  ------------------------------------------------------------
echo    Server :  http://localhost:5000
echo    Stop   :  Press Ctrl+C
echo  ------------------------------------------------------------
echo.

REM Auto-open browser after 3s
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:5000"

cd skin_cancer\webapp
python app.py

echo.
echo  Server stopped.
pause