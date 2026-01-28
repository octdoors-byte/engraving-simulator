# start-local.ps1 のエイリアス（互換のため残しています）
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $scriptRoot "start-local.ps1"

if (-not (Test-Path $target)) {
  Write-Host "エラー: start-local.ps1 が見つかりません: $target" -ForegroundColor Red
  exit 1
}

& $target
