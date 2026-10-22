@echo off
setlocal enabledelayedexpansion
title DermaScan AI - Skin Cancer Diagnostic System

cd /d "%~dp0"

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

echo.
echo ===============================================================================
echo      DERMASCAN AI - HE THONG CHAN DOAN UNG THU DA THONG MINH
echo      Web App + AI Background Worker + Disk Cache (No Docker / No Redis)
echo ===============================================================================
echo.

REM 1. Activate Virtual Environment
if exist ".venv\Scripts\activate.bat" (
    echo [1/3] Kich hoat moi truong ao .venv...
    call .venv\Scripts\activate.bat
) else if exist "env\Scripts\activate.bat" (
    echo [1/3] Kich hoat moi truong ao env...
    call env\Scripts\activate.bat
) else (
    echo [CANH BAO] Khong tim thay .venv hoac env. Dung python he thong...
)

REM 2. Check Database
if not exist "instance\dermascan.db" (
    echo [2/3] Dang khoi tao co so du lieu mau...
    python -m flask --app skin_cancer.webapp.database_app db upgrade
    python -m flask --app skin_cancer.webapp.database_app seed-demo
    echo [2/3] Khoi tao co so du lieu thanh cong!
) else (
    echo [2/3] Co so du lieu da san sang.
)

REM 3. Launch App
echo [3/3] Dang khoi dong may chu Web va AI...
echo.
echo -------------------------------------------------------------------------------
echo   - Dia chi Web   : http://localhost:5000
echo   - Bac si demo   : doctor@dermascan.local  / Mat khau: 123456123456
echo   - Benh nhan     : patient@dermascan.local / Mat khau: 123456123456
echo   - Cache du lieu : SQLite Disk Cache (instance\cache.db - Khong can Docker)
echo   - Background AI : Tu dong chay ngam (Khong can mo them terminal khac)
echo   - Dung server   : Nhan to hop phim Ctrl + C
echo -------------------------------------------------------------------------------
echo.

REM Auto open browser after 3 seconds in background
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5000"

REM Run Web Application
python skin_cancer\webapp\app.py

echo.
echo He thong da dung.
pause
