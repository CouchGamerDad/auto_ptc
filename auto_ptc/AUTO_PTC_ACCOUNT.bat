@echo off
:: Batch script to run the Python script as administrator

:: Navigate to the script directory
cd C:\auto_ptc\auto_ptc

:: Check if the script is being run as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell Start-Process -FilePath "%~f0" -Verb RunAs
    exit /b
)

:: Run the npm start
npm start
pause
