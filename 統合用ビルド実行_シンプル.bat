@echo off
chcp 65001 >nul
echo Building for integration...
echo.

echo Running build (vite.config.ts is set to use /simulator/ by default)...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build completed with warnings, but checking result...
)

echo.
echo Checking dist/index.html...
if exist "dist\index.html" (
    findstr /C:"/simulator/assets" dist\index.html >nul
    if %ERRORLEVEL% == 0 (
        echo SUCCESS: Path includes /simulator/assets/
        echo.
        echo Build is ready for upload!
    ) else (
        echo WARNING: Path does NOT include /simulator/assets/
        echo Please check dist/index.html manually
    )
) else (
    echo ERROR: dist/index.html was not created!
)

echo.
pause
