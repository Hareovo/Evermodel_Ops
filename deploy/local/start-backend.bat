@echo off
REM Evermodel Ops backend - Django ASGI dev server, serves HTTP + WebSocket on 0.0.0.0:8000
REM WebSocket support comes from daphne (first item in INSTALLED_APPS), so runserver
REM handles both http and ws on the same port.
setlocal
cd /d "%~dp0..\..\backend"
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] venv not found at backend\venv
    pause
    exit /b 1
)
call "venv\Scripts\activate.bat"
echo [evermodel_ops] backend dev server on http://0.0.0.0:8000  (Ctrl+C to stop)
python manage.py runserver 0.0.0.0:8000
