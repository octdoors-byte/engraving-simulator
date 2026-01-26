@echo off
chcp 65001 >nul
echo ==========================================
echo ビルド結果を確認します
echo ==========================================
echo.

if not exist dist\index.html (
    echo [エラー] dist\index.html が見つかりません
    echo ビルドが実行されていない可能性があります
    pause
    exit /b 1
)

echo dist/index.html の内容を確認中...
echo.

findstr /C:"/simulator/assets" dist\index.html >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] 統合用に正しくビルドされています！
    echo     アセットのパスに /simulator/ が含まれています
    echo.
    echo このファイルをサーバーにアップロードすれば解決します
) else (
    echo [警告] 統合用にビルドされていません
    echo        アセットのパスを確認してください
    echo.
    echo index.htmlのアセットパス部分:
    type dist\index.html | findstr "assets"
    echo.
    echo.
    echo 手動で修正する場合は、以下のように変更してください:
    echo   /assets/ → /simulator/assets/
)

echo.
echo ==========================================
echo 確認完了
echo ==========================================
echo.
pause
