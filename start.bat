@echo off
echo Starting Liftuplabs Backend Server...
echo.

echo Checking if MongoDB is running...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ MongoDB is running
) else (
    echo ❌ MongoDB is not running
    echo Please start MongoDB first
    echo.
    echo You can start MongoDB with:
    echo   mongod --dbpath "C:\data\db"
    echo.
    pause
    exit /b 1
)

echo.
echo Starting backend server...
npm run dev