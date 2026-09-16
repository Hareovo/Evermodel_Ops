@echo off
setlocal
cd /d "%~dp0.."
if "%1"=="middleware" goto middleware
if "%1"=="frontend" goto frontend
if "%1"=="backend" goto backend
if "%1"=="status" goto status
echo Usage: deploy\run.bat middleware [up^|down^|ps^|logs] ^| frontend ^| backend [runserver^|worker^|scheduler^|monitor] ^| status
exit /b 2
:middleware
docker compose -f deploy\docker-compose.yaml %2 %3 %4
exit /b %errorlevel%
:frontend
call npm --prefix frontend start
exit /b %errorlevel%
:backend
if "%2"=="runserver" goto runserver
if "%2"=="worker" goto worker
if "%2"=="scheduler" goto scheduler
if "%2"=="monitor" goto monitor
echo Choose runserver, worker, scheduler or monitor
exit /b 2
:runserver
call backend\venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
exit /b %errorlevel%
:worker
call backend\venv\Scripts\python.exe backend\manage.py runworker
exit /b %errorlevel%
:scheduler
call backend\venv\Scripts\python.exe backend\manage.py runscheduler
exit /b %errorlevel%
:monitor
call backend\venv\Scripts\python.exe backend\manage.py runmonitor
exit /b %errorlevel%
:status
docker compose -f deploy\docker-compose.yaml ps
exit /b %errorlevel%
