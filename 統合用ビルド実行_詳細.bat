@echo off
chcp 65001 >nul
echo ==========================================
echo Building for integration...
echo ==========================================
echo.

echo Setting environment variables...
echo Creating .env.production file...
echo VITE_BASE_PATH=/simulator/ > .env.production
type .env.production
echo.

echo Checking package manager...
call npm --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not found!
    pause
    exit /b 1
)

echo.
echo Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
)

echo.
echo Running build with detailed output...
call npm run build
set BUILD_ERROR=%ERRORLEVEL%

echo.
echo ==========================================
if %BUILD_ERROR% NEQ 0 (
    echo Build failed! Error code: %BUILD_ERROR%
    echo ==========================================
    echo.
    echo Please check the error messages above.
    echo.
    echo Common issues:
    echo 1. Missing dependencies - try: npm install
    echo 2. TypeScript errors - check src files
    echo 3. File permission issues
    echo.
) else (
    echo Build completed successfully!
    echo ==========================================
    echo.
    echo Please check dist/index.html to verify the path includes /simulator/
    echo.
)
pause
if %BUILD_ERROR% NEQ 0 exit /b 1

echo.
echo ==========================================
echo Build completed successfully!
echo ==========================================
echo.
echo Please check dist/index.html to verify the path includes /simulator/
echo.
pause
