@echo off
REM Evermodel Ops scheduler - runs task-planning / cron style jobs
setlocal
cd /d "%~dp0..\..\backend"
call "venv\Scripts\activate.bat"
echo [evermodel_ops] scheduler started (Ctrl+C to stop)
python manage.py runscheduler
