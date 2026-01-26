@echo off
chcp 65001 >nul
echo ==========================================
echo 統合用distフォルダのzip化
echo ==========================================
echo.

echo 現在のdistフォルダをzip化します...
echo.

REM PowerShellでzip化を実行
powershell -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'dist-integrated.zip' -Force"

if exist dist-integrated.zip (
    echo.
    echo ==========================================
    echo zip化が完了しました！
    echo ==========================================
    echo.
    echo ファイル: dist-integrated.zip
    echo.
    echo ⚠️ 重要: このzipファイルは統合用にビルドされていない可能性があります。
    echo 統合用にビルドするには、「統合用ビルド実行.bat」を先に実行してください。
    echo.
) else (
    echo.
    echo エラー: zip化に失敗しました。
    echo.
)

pause
