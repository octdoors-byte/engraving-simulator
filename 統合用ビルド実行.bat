@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==========================================
echo Building for integration...
echo ==========================================
echo.

echo Creating .env.production file...
(
echo VITE_BASE_PATH=/simulator/
) > .env.production
if not exist ".env.production" (
    echo ERROR: Failed to create .env.production file!
    pause
    exit /b 1
)

echo Checking package manager...
set PM_CMD=
set PM_NAME=

where pnpm >nul 2>&1
if %ERRORLEVEL% == 0 (
    set PM_CMD=pnpm
    set PM_NAME=pnpm
    goto :found_pm
)

where npm >nul 2>&1
if %ERRORLEVEL% == 0 (
    set PM_CMD=npm
    set PM_NAME=npm
    goto :found_pm
)

echo ERROR: Neither pnpm nor npm is found in PATH!
echo.
echo Please install Node.js from https://nodejs.org/
echo After installation, restart your computer and try again.
echo.
pause
exit /b 1

:found_pm
echo Using %PM_NAME%...
echo.

if "%PM_NAME%"=="npm" (
    echo Checking dependencies...
    if not exist "node_modules" (
        echo Installing dependencies...
        call npm install
        if !ERRORLEVEL! NEQ 0 (
            echo.
            echo ERROR: Failed to install dependencies!
            pause
            exit /b 1
        )
    ) else (
        echo Dependencies already installed.
    )
    echo.
)

echo Cleaning dist folder...
if exist "dist" (
    echo Removing old dist folder...
    rmdir /s /q "dist"
)

echo Running build:integrated...
set VITE_BASE_PATH=/simulator/
call %PM_CMD% run build:integrated > build.log 2>&1
set BUILD_RESULT=!ERRORLEVEL!

echo.
echo ==========================================
if !BUILD_RESULT! NEQ 0 (
    echo Build reported error code: !BUILD_RESULT!
    echo ==========================================
    echo.
    echo Checking if dist/index.html exists...
    if exist "dist\index.html" (
        echo dist/index.html was created.
        echo.
        echo Verifying build output...
        findstr /C:"/simulator/assets" "dist\index.html" >nul
        if !ERRORLEVEL! == 0 (
            echo SUCCESS: Path includes /simulator/assets/
            echo.
            echo NOTE: Build reported an error code, but output files were created correctly.
            echo This may be a false error. Checking build log...
            echo.
            findstr /I /C:"error" /C:"failed" /C:"fatal" build.log >nul
            if !ERRORLEVEL! NEQ 0 (
                echo No critical errors found in build log.
                echo Build appears to have succeeded despite error code.
                echo.
                goto :verify_success
            ) else (
                echo WARNING: Errors found in build log:
                findstr /I /C:"error" /C:"failed" /C:"fatal" build.log
                echo.
            )
        ) else (
            echo WARNING: Path does NOT include /simulator/assets/
            echo Please check dist/index.html manually
        )
    ) else (
        echo dist/index.html was NOT created.
        echo Build definitely failed.
        echo.
        echo Last 20 lines of build log:
        powershell -Command "Get-Content build.log -Tail 20"
    )
    echo.
    pause
    exit /b 1
)

:verify_success
echo Build completed successfully!
echo ==========================================
echo.
echo Verifying dist/index.html...
if exist "dist\index.html" (
    findstr /C:"/simulator/assets" "dist\index.html" >nul
    if !ERRORLEVEL! == 0 (
        echo SUCCESS: Path includes /simulator/assets/
        echo.
        echo Build verification complete!
    ) else (
        echo WARNING: Path does NOT include /simulator/assets/
        echo Please check dist/index.html manually
        pause
        exit /b 1
    )
) else (
    echo ERROR: dist/index.html was not created!
    pause
    exit /b 1
)
echo.
pause
