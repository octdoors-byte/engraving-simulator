@echo off
chcp 65001 >nul
echo ==========================================
echo Building for integration...
echo ==========================================
echo.

echo Setting environment variables...
set VITE_BASE_PATH=/simulator/
set NODE_ENV=production

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
echo Running build...
call npm run build
set BUILD_RESULT=%ERRORLEVEL%

echo.
echo ==========================================
if %BUILD_RESULT% NEQ 0 (
    echo Build failed with error code: %BUILD_RESULT%
    echo ==========================================
    echo.
    echo However, checking if dist/index.html was created...
    if exist "dist\index.html" (
        echo dist/index.html exists. Checking path...
        findstr /C:"/simulator/assets" dist\index.html >nul
        if %ERRORLEVEL% == 0 (
            echo SUCCESS: Path includes /simulator/assets/ - Build may have succeeded!
        ) else (
            echo WARNING: Path does NOT include /simulator/assets/
        )
    )
) else (
    echo Build completed successfully!
    echo ==========================================
    echo.
    echo Verifying dist/index.html...
    if exist "dist\index.html" (
        findstr /C:"/simulator/assets" dist\index.html >nul
        if %ERRORLEVEL% == 0 (
            echo SUCCESS: Path includes /simulator/assets/
        ) else (
            echo WARNING: Path does NOT include /simulator/assets/
            echo Please check dist/index.html manually
        )
    )
)
echo.
pause
if %BUILD_RESULT% NEQ 0 exit /b 1
