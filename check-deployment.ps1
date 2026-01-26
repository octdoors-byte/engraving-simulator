# デプロイ状況チェックスクリプト
param(
    [string]$RepoOwner = "octdoors-byte",
    [string]$RepoName = "engraving-simulator",
    [string]$Branch = "master"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "デプロイ状況チェック" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. ローカルのGit状態を確認
Write-Host "ローカルのGit状態を確認中..." -ForegroundColor Yellow
$gitStatus = git status --porcelain 2>&1
$gitLog = git log --oneline -5 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Gitリポジトリに接続できました" -ForegroundColor Green
    Write-Host "最新のコミット:" -ForegroundColor Gray
    $gitLog | Select-Object -First 3 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    
    if ($gitStatus) {
        Write-Host "未コミットの変更があります" -ForegroundColor Yellow
    } else {
        Write-Host "作業ディレクトリはクリーンです" -ForegroundColor Green
    }
} else {
    Write-Host "Gitコマンドの実行に失敗しました" -ForegroundColor Red
}

Write-Host ""

# 2. リモートとの同期状態を確認
Write-Host "リモートとの同期状態を確認中..." -ForegroundColor Yellow
git fetch origin $Branch --quiet 2>&1 | Out-Null
$localCommit = git rev-parse HEAD 2>&1
$remoteCommit = git rev-parse "origin/$Branch" 2>&1

if ($remoteCommit -and -not ($remoteCommit -match "fatal")) {
    if ($localCommit -eq $remoteCommit) {
        Write-Host "ローカルとリモートは同期されています" -ForegroundColor Green
    } else {
        Write-Host "ローカルとリモートが同期されていません" -ForegroundColor Yellow
        Write-Host "  ローカル: $($localCommit.Substring(0, 7))" -ForegroundColor Gray
        Write-Host "  リモート: $($remoteCommit.Substring(0, 7))" -ForegroundColor Gray
    }
} else {
    Write-Host "リモートブランチの確認に失敗しました" -ForegroundColor Yellow
}

Write-Host ""

# 3. GitHub ActionsのURL
Write-Host "GitHub Actionsの実行状況を確認:" -ForegroundColor Yellow
$actionsUrl = "https://github.com/$RepoOwner/$RepoName/actions"
Write-Host "  $actionsUrl" -ForegroundColor Cyan

Write-Host ""

# 4. デプロイされたサイトの確認
Write-Host "デプロイされたサイトを確認中..." -ForegroundColor Yellow
$siteUrl = "https://$RepoOwner.github.io/$RepoName/"
Write-Host "サイトURL: $siteUrl" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri $siteUrl -Method Head -TimeoutSec 10 -ErrorAction Stop
    Write-Host "サイトは正常にアクセス可能です (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "サイトにアクセスできません" -ForegroundColor Red
    Write-Host "  デプロイがまだ完了していないか、エラーが発生している可能性があります" -ForegroundColor Yellow
}

Write-Host ""

# 5. ワークフローファイルの存在確認
Write-Host "ワークフローファイルの確認中..." -ForegroundColor Yellow
$workflowFile = ".github/workflows/deploy.yml"
if (Test-Path $workflowFile) {
    Write-Host "ワークフローファイルが見つかりました" -ForegroundColor Green
} else {
    Write-Host "ワークフローファイルが見つかりません: $workflowFile" -ForegroundColor Red
}

Write-Host ""

# 6. まとめ
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "チェック結果のまとめ" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Yellow
Write-Host "1. GitHub Actionsページで最新の実行を確認:" -ForegroundColor Gray
Write-Host "   $actionsUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. サイトにアクセスして動作を確認:" -ForegroundColor Gray
Write-Host "   $siteUrl" -ForegroundColor Cyan
Write-Host ""
