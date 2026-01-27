$ErrorActionPreference = "Stop"
$port = 5174
$url = "http://localhost:$port"
$logDir = Join-Path $PSScriptRoot "資料\ログ"
$logPath = Join-Path $logDir "dev-server.log"

# ログディレクトリを作成
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Test-LocalUrl([string]$target) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $target -TimeoutSec 2 -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Start-DevServer {
  Write-Host "開発サーバーを起動しています..."
  Write-Host "ログ: $logPath"
  
  # 現在のディレクトリに移動（パスの問題を回避）
  Push-Location $PSScriptRoot
  
  try {
    # npmが利用可能か確認
    $npmCheck = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCheck) {
      Write-Host "エラー: npmが見つかりません。Node.jsがインストールされているか確認してください。" -ForegroundColor Red
      exit 1
    }
    
    # node_modulesが存在するか確認
    if (-not (Test-Path "node_modules")) {
      Write-Host "依存関係がインストールされていません。インストールを開始します..." -ForegroundColor Yellow
      npm install
      if ($LASTEXITCODE -ne 0) {
        Write-Host "エラー: 依存関係のインストールに失敗しました。" -ForegroundColor Red
        exit 1
      }
      Write-Host "依存関係のインストールが完了しました。" -ForegroundColor Green
    }
    
    # 既存のプロセスを確認
    $existingProcess = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Host "警告: ポート $port は既に使用されています。" -ForegroundColor Yellow
      Write-Host "既存のサーバーを使用します。" -ForegroundColor Yellow
      return
    }
    
    # サーバーを起動（新しいウィンドウで実行）
    Write-Host "開発サーバーを起動中..." -ForegroundColor Cyan
    $env:VITE_BASE_PATH = "/"
    Start-Process powershell -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-Command",
      "Set-Location '$PSScriptRoot'; `$env:VITE_BASE_PATH='/'; npm run dev"
    ) -WindowStyle Normal
    
    Write-Host "開発サーバーを起動しました。" -ForegroundColor Green
    
  } catch {
    Write-Host "エラー: サーバーの起動に失敗しました: $_" -ForegroundColor Red
    Write-Host "詳細はログを確認してください: $logPath" -ForegroundColor Yellow
    exit 1
  } finally {
    Pop-Location
  }
}

# 既にサーバーが起動しているか確認
if (Test-LocalUrl $url) {
  Write-Host "サーバーは既に起動しています。" -ForegroundColor Green
  Start-Process $url | Out-Null
  exit 0
}

# サーバーを起動
Start-DevServer

# サーバーの起動を待機
Write-Host "サーバーの起動を待機しています..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0

while ($waited -lt $maxWait) {
  Start-Sleep -Seconds 1
  $waited++
  
  if (Test-LocalUrl $url) {
    Write-Host "サーバーが起動しました！" -ForegroundColor Green
    Start-Process $url | Out-Null
    exit 0
  }
  
  if ($waited % 5 -eq 0) {
    Write-Host "待機中... ($waited/$maxWait 秒)" -ForegroundColor Yellow
  }
}

# タイムアウト
Write-Host "エラー: サーバーが $maxWait 秒以内に起動しませんでした。" -ForegroundColor Red
Write-Host "ログを確認してください: $logPath" -ForegroundColor Yellow

# ログの最後の20行を表示
if (Test-Path $logPath) {
  Write-Host "`n=== ログの最後の20行 ===" -ForegroundColor Cyan
  Get-Content $logPath -Tail 20
}

exit 1
