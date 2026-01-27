# デプロイ確認スクリプト
# GitHub Actionsのデプロイ状況を確認し、成功するまで待機します

$ErrorActionPreference = "Stop"
$repoOwner = "octdoors-byte"
$repoName = "engraving-simulator"
$deployUrl = "https://$repoOwner.github.io/$repoName/"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "デプロイ確認スクリプト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "リポジトリ: $repoOwner/$repoName" -ForegroundColor Yellow
Write-Host "デプロイURL: $deployUrl" -ForegroundColor Yellow
Write-Host ""

# GitHub Actionsのワークフロー実行状況を確認
Write-Host "GitHub Actionsのワークフロー実行状況を確認中..." -ForegroundColor Cyan
Write-Host "Actions URL: https://github.com/$repoOwner/$repoName/actions" -ForegroundColor Yellow
Write-Host ""

# デプロイURLへのアクセスを確認
Write-Host "デプロイURLへのアクセスを確認中..." -ForegroundColor Cyan
$maxWait = 300  # 最大5分待機
$waited = 0
$checkInterval = 10  # 10秒ごとに確認

while ($waited -lt $maxWait) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $deployUrl -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
      Write-Host "✅ デプロイが成功しました！" -ForegroundColor Green
      Write-Host ""
      Write-Host "========================================" -ForegroundColor Cyan
      Write-Host "デプロイURL: $deployUrl" -ForegroundColor Green
      Write-Host "========================================" -ForegroundColor Cyan
      Write-Host ""
      Write-Host "サイトは正常にアクセス可能です。" -ForegroundColor Green
      exit 0
    }
  } catch {
    # まだデプロイされていない、またはエラー
    if ($waited % 30 -eq 0 -and $waited -gt 0) {
      Write-Host "  → 待機中... ($waited/$maxWait 秒) - デプロイが完了するまで待機しています..." -ForegroundColor Yellow
    }
  }
  
  Start-Sleep -Seconds $checkInterval
  $waited += $checkInterval
}

Write-Host ""
Write-Host "⚠️  タイムアウト: $maxWait 秒以内にデプロイが完了しませんでした。" -ForegroundColor Yellow
Write-Host ""
Write-Host "手動で確認してください:" -ForegroundColor Yellow
Write-Host "1. GitHub Actions: https://github.com/$repoOwner/$repoName/actions" -ForegroundColor White
Write-Host "2. デプロイURL: $deployUrl" -ForegroundColor White
Write-Host ""
Write-Host "GitHub Pagesの反映には数分かかる場合があります。" -ForegroundColor Yellow
exit 1
