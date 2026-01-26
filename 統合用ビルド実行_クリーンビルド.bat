@echo off
chcp 65001 >nul
echo ==========================================
echo Building for integration (Clean Build)
echo ==========================================
echo.

echo Removing old dist folder...
if exist "dist" (
    rmdir /s /q dist
    echo dist folder removed.
) else (
    echo dist folder does not exist.
)
echo.

echo Running build...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Build completed!
echo ==========================================
echo.
echo Verifying dist/index.html...
if exist "dist\index.html" (
    findstr /C:"/simulator/assets" dist\index.html >nul
    if %ERRORLEVEL% == 0 (
        echo SUCCESS: Path includes /simulator/assets/
        echo.
        echo Build is ready for FTP upload!
    ) else (
        echo WARNING: Path does NOT include /simulator/assets/
        echo.
        echo Checking current path...
        findstr /C:"assets" dist\index.html
        echo.
        echo Please check vite.config.ts - base should be set to "/simulator/"
    )
) else (
    echo ERROR: dist/index.html was not created!
)

echo.
pause
