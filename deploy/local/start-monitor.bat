@echo off
REM Evermodel Ops monitor - runs site / port / process / ping monitoring checks
setlocal
cd /d "%~dp0..\..\backend"
call "venv\Scripts\activate.bat"
echo [evermodel_ops] monitor started (Ctrl+C to stop)
python manage.py runmonitor
