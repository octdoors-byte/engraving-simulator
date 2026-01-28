$ErrorActionPreference = "Stop"

$port = 5174
$url = "http://localhost:$port"
$scriptRoot = $PSScriptRoot
$logDir = Join-Path $scriptRoot "logs"
$logPath = Join-Path $logDir "dev-server.log"
$pidPath = Join-Path $logDir "dev-server.pid"

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Test-LocalUrl([string]$target) {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $target -TimeoutSec 2 -ErrorAction Stop | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Get-PortInUse([int]$localPort) {
  try {
    return [bool](Get-NetTCPConnection -LocalPort $localPort -ErrorAction SilentlyContinue | Select-Object -First 1)
  } catch {
    $result = netstat -ano | Select-String -Pattern (":$localPort\\s")
    return [bool]$result
  }
}

function Start-DevServer {
  Set-Location $scriptRoot

  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host "名入れ刻印シミュレーター（開発サーバー起動）" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host "URL: $url" -ForegroundColor Green
  Write-Host "ログ: $logPath" -ForegroundColor DarkGray
  Write-Host ""

  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $nodeCmd -or -not $npmCmd) {
    Write-Host "エラー: Node.js / npm が見つかりません。" -ForegroundColor Red
    Write-Host "Node.js をインストールしてから再実行してください。" -ForegroundColor Yellow
    exit 1
  }

  $nodeVersionText = (node --version) 2>$null
  $npmVersionText = (npm --version) 2>$null
  Write-Host "Node.js: $nodeVersionText / npm: $npmVersionText" -ForegroundColor Gray

  if ($nodeVersionText -match "^v(\\d+)\\.") {
    $nodeMajor = [int]$Matches[1]
    if ($nodeMajor -ge 23) {
      Write-Host "注意: Node.js $nodeVersionText を検出しました（package.json の engines は 23未満を想定）。" -ForegroundColor Yellow
      Write-Host "動かない場合は Node.js 20/22 へ切り替えてください。" -ForegroundColor Yellow
      Write-Host ""
    }
  }

  if (-not (Test-Path "node_modules")) {
    Write-Host "依存関係をインストールします（npm install）..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install に失敗しました（exit code: $LASTEXITCODE）" }
  }

  if (Get-PortInUse $port) {
    Write-Host "ポート $port は既に使用中です。ブラウザを開きます。" -ForegroundColor Yellow
    Start-Process $url | Out-Null
    return
  }

  "" | Set-Content -Encoding utf8 $logPath

  Write-Host "開発サーバーを起動します（npm run dev）..." -ForegroundColor Cyan
  $cmd = "npm run dev > `"$logPath`" 2>&1"
  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -WorkingDirectory $scriptRoot -WindowStyle Normal -PassThru
  $proc.Id | Set-Content -Encoding ascii $pidPath

  Write-Host "ブラウザを開きます: $url" -ForegroundColor Green
  Write-Host "初回起動は数分かかることがあります（その間は読み込み中になります）。" -ForegroundColor Yellow
  Write-Host "進捗はログで確認できます: $logPath" -ForegroundColor DarkGray
  Start-Process $url | Out-Null
}

Start-DevServer
