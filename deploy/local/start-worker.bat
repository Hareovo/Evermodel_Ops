@echo off
REM Evermodel Ops worker - consumes the redis queues that drive batch exec / schedule / monitor jobs
setlocal
cd /d "%~dp0..\..\backend"
call "venv\Scripts\activate.bat"
echo [evermodel_ops] worker started (Ctrl+C to stop)
python manage.py runworker
