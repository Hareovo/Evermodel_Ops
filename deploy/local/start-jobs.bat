@echo off
REM Open worker / scheduler / monitor, each in its own console window.
REM The backend itself is NOT started here - run start-backend.bat in a separate window.
setlocal
start "evermodel_ops-worker"    cmd /k "%~dp0start-worker.bat"
start "evermodel_ops-scheduler" cmd /k "%~dp0start-scheduler.bat"
start "evermodel_ops-monitor"   cmd /k "%~dp0start-monitor.bat"
