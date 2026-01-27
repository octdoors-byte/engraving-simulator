@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0開発サーバー起動_確実版.ps1"
pause
