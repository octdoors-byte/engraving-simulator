@echo off
chcp 65001 >nul
echo ==========================================
echo Building for integration...
echo ==========================================
echo.

echo Setting environment variables...
set VITE_BASE_PATH=/simulator/

echo Creating .env.production file...
echo VITE_BASE_PATH=/simulator/ > .env.production
type .env.production
echo.

echo Checking npm...
call npm --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not found!
    pause
    exit /b 1
)

echo.
echo Running build with explicit environment variable...
set VITE_BASE_PATH=/simulator/
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ==========================================
    echo Build failed!
    echo ==========================================
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Build completed!
echo ==========================================
echo.
echo Verifying dist/index.html...
findstr /C:"/simulator/assets" dist\index.html >nul
if %ERRORLEVEL% == 0 (
    echo SUCCESS: Path includes /simulator/assets/
) else (
    echo WARNING: Path does NOT include /simulator/assets/
    echo Please check dist/index.html manually
)
echo.
pause
