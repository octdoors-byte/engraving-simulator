# 開発サーバー起動スクリプト（確実版）
# このスクリプトは依存関係の確認とインストールを行い、確実にサーバーを起動します

$ErrorActionPreference = "Stop"
$port = 5174
$url = "http://localhost:$port"

# スクリプトのディレクトリに移動
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "開発サーバー起動スクリプト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Node.jsの確認
Write-Host "[1/5] Node.jsの確認中..." -ForegroundColor Yellow
try {
  $nodeVersion = node --version
  Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
  
  $npmVersion = npm --version
  Write-Host "  ✓ npm: $npmVersion" -ForegroundColor Green
} catch {
  Write-Host "  ✗ エラー: Node.jsが見つかりません。" -ForegroundColor Red
  Write-Host "    Node.js 20以上23未満をインストールしてください。" -ForegroundColor Yellow
  exit 1
}

# 2. 依存関係の確認とインストール
Write-Host "[2/5] 依存関係の確認中..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
  Write-Host "  → 依存関係をインストールします..." -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ エラー: 依存関係のインストールに失敗しました。" -ForegroundColor Red
    exit 1
  }
  Write-Host "  ✓ 依存関係のインストールが完了しました。" -ForegroundColor Green
} else {
  Write-Host "  ✓ 依存関係は既にインストールされています。" -ForegroundColor Green
}

# 3. ポートの確認
Write-Host "[3/5] ポート $port の確認中..." -ForegroundColor Yellow
$existingConnection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($existingConnection) {
  Write-Host "  ⚠ ポート $port は既に使用されています。" -ForegroundColor Yellow
  Write-Host "  → 既存のサーバーに接続します。" -ForegroundColor Cyan
  Start-Process $url
  exit 0
} else {
  Write-Host "  ✓ ポート $port は使用可能です。" -ForegroundColor Green
}

# 4. サーバーの起動
Write-Host "[4/5] 開発サーバーを起動中..." -ForegroundColor Yellow
$env:VITE_BASE_PATH = "/"

# 新しいPowerShellウィンドウでサーバーを起動
$startScript = @"
Set-Location '$scriptRoot'
`$env:VITE_BASE_PATH = '/'
npm run dev
"@

Start-Process powershell -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", $startScript
) -WindowStyle Normal

Write-Host "  ✓ 開発サーバーを起動しました。" -ForegroundColor Green

# 5. サーバーの起動を待機
Write-Host "[5/5] サーバーの起動を待機中..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0

while ($waited -lt $maxWait) {
  Start-Sleep -Seconds 1
  $waited++
  
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  ✓ サーバーが起動しました！" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "サーバーURL: $url" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Start-Process $url
    exit 0
  } catch {
    # サーバーはまだ起動していない
  }
  
  if ($waited % 5 -eq 0) {
    Write-Host "  → 待機中... ($waited/$maxWait 秒)" -ForegroundColor Cyan
  }
}

# タイムアウト
Write-Host ""
Write-Host "  ✗ エラー: サーバーが $maxWait 秒以内に起動しませんでした。" -ForegroundColor Red
Write-Host ""
Write-Host "トラブルシューティング:" -ForegroundColor Yellow
Write-Host "  1. 新しいPowerShellウィンドウでエラーメッセージを確認してください" -ForegroundColor White
Write-Host "  2. ポート $port が使用されていないか確認してください" -ForegroundColor White
Write-Host "  3. ファイアウォールの設定を確認してください" -ForegroundColor White
Write-Host ""
exit 1
