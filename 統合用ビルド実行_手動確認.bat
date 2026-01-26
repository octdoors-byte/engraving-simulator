@echo off
chcp 65001 >nul
echo ==========================================
echo Node.js Installation Check
echo ==========================================
echo.

echo Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% == 0 (
    node --version
    echo Node.js is installed!
    echo.
) else (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js:
    echo 1. Download from https://nodejs.org/
    echo 2. Install Node.js (npm will be installed automatically)
    echo 3. Restart your computer
    echo 4. Run this batch file again
    echo.
    pause
    exit /b 1
)

echo Checking npm...
npm --version >nul 2>&1
if %ERRORLEVEL% == 0 (
    npm --version
    echo npm is installed!
    echo.
) else (
    echo ERROR: npm is not found!
    echo.
    pause
    exit /b 1
)

echo Checking pnpm...
pnpm --version >nul 2>&1
if %ERRORLEVEL% == 0 (
    pnpm --version
    echo pnpm is installed!
    echo.
    echo Using pnpm to build...
    set VITE_BASE_PATH=/simulator/
    call pnpm build:integrated
) else (
    echo pnpm is not installed, using npm...
    echo.
    echo Using npm to build...
    set VITE_BASE_PATH=/simulator/
    call npm run build:integrated
)

echo.
echo ==========================================
echo Build completed!
echo ==========================================
echo.
echo Please check dist/index.html to verify the path includes /simulator/
echo.
pause
