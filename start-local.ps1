$ErrorActionPreference = "SilentlyContinue"
$port = 5174
$url = "http://localhost:$port"
$logDir = Join-Path $PSScriptRoot "資料\\ログ"
$logPath = Join-Path $logDir "dev-server.log"

function Test-LocalUrl([string]$target) {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $target -TimeoutSec 1 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Start-DevServer {
  if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  }
  $cmd = "Set-Location `"$PSScriptRoot`"; pnpm dev --host --port $port *> `"$logPath`""
  Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd) -WindowStyle Minimized | Out-Null
}

if (Test-LocalUrl $url) {
  Start-Process $url | Out-Null
  exit 0
}

Start-DevServer

for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Test-LocalUrl $url) {
    Start-Process $url | Out-Null
    exit 0
  }
}

Write-Host "Server did not respond on $url. See $logPath"
