@echo off
setlocal
cd /d "%~dp0"
if "%1"=="all" goto all
if "%1"=="api" goto api
if "%1"=="worker" goto worker
if "%1"=="scheduler" goto scheduler
if "%1"=="monitor" goto monitor
echo Usage: backend\tools\start-dev.bat [all^|api^|worker^|scheduler^|monitor]
exit /b 2
:api
call ..\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
exit /b %errorlevel%
:worker
call ..\venv\Scripts\python.exe manage.py runworker
exit /b %errorlevel%
:scheduler
call ..\venv\Scripts\python.exe manage.py runscheduler
exit /b %errorlevel%
:monitor
call ..\venv\Scripts\python.exe manage.py runmonitor
exit /b %errorlevel%
:all
start "evermodel-api" cmd /k call ..\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
start "evermodel-worker" cmd /k call ..\venv\Scripts\python.exe manage.py runworker
start "evermodel-scheduler" cmd /k call ..\venv\Scripts\python.exe manage.py runscheduler
start "evermodel-monitor" cmd /k call ..\venv\Scripts\python.exe manage.py runmonitor
exit /b 0