@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo node_modules missing, run npm install first
  exit /b 1
)
call npx react-app-rewired start
exit /b %errorlevel%