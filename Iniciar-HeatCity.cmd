@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1"
set "HEATCITY_EXIT=%ERRORLEVEL%"
if not "%HEATCITY_EXIT%"=="0" pause
exit /b %HEATCITY_EXIT%
