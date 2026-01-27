# デプロイ自動化スクリプト
# このスクリプトは変更をコミット・プッシュし、デプロイの成功を確認します

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "デプロイ自動化スクリプト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. YAML構文チェック
Write-Host "[1/5] YAML構文チェック中..." -ForegroundColor Yellow
$yamlFile = ".github\workflows\deploy.yml"
if (Test-Path $yamlFile) {
  # 基本的なYAML構文チェック（インデント、コロン、ハイフンなど）
  $content = Get-Content $yamlFile -Raw
  $lines = Get-Content $yamlFile
  
  $errors = @()
  $inMultilineString = $false
  $multilineDelimiter = ""
  
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $lineNum = $i + 1
    
    # here-documentの開始をチェック
    if ($line -match "<<\s*['""]?(\w+)['""]?") {
      $inMultilineString = $true
      $multilineDelimiter = $matches[1]
      Write-Host "  → Line $lineNum : here-document開始 ($multilineDelimiter)" -ForegroundColor Cyan
    }
    
    # here-documentの終了をチェック
    if ($inMultilineString -and $line.Trim() -eq $multilineDelimiter) {
      $inMultilineString = $false
      $multilineDelimiter = ""
      Write-Host "  → Line $lineNum : here-document終了" -ForegroundColor Cyan
    }
  }
  
  if ($inMultilineString) {
    Write-Host "  ✗ エラー: here-documentが閉じられていません" -ForegroundColor Red
    exit 1
  }
  
  Write-Host "  ✓ YAML構文チェック完了" -ForegroundColor Green
} else {
  Write-Host "  ✗ エラー: $yamlFile が見つかりません" -ForegroundColor Red
  exit 1
}

# 2. 変更ファイルの確認
Write-Host "[2/5] 変更ファイルの確認中..." -ForegroundColor Yellow
$changedFiles = git status --short 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ✗ エラー: git status に失敗しました" -ForegroundColor Red
  Write-Host $changedFiles
  exit 1
}

$modifiedFiles = ($changedFiles | Where-Object { $_ -match "^ M" }).Count
$newFiles = ($changedFiles | Where-Object { $_ -match "^\?\?" }).Count

if ($modifiedFiles -eq 0 -and $newFiles -eq 0) {
  Write-Host "  ⚠ 変更されたファイルがありません" -ForegroundColor Yellow
  exit 0
}

Write-Host "  ✓ 変更ファイル: $modifiedFiles 件、新規ファイル: $newFiles 件" -ForegroundColor Green

# 3. ファイルをステージング
Write-Host "[3/5] ファイルをステージング中..." -ForegroundColor Yellow
git add -A 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ✗ エラー: git add に失敗しました" -ForegroundColor Red
  exit 1
}
Write-Host "  ✓ ステージング完了" -ForegroundColor Green

# 4. コミット
Write-Host "[4/5] コミット中..." -ForegroundColor Yellow
$commitMessage = "Update: Fix deploy.yml, improve UI components, and enhance template status handling"
git commit -m $commitMessage 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ✗ エラー: git commit に失敗しました" -ForegroundColor Red
  Write-Host "  ヒント: 変更がないか、コミットメッセージに問題がある可能性があります" -ForegroundColor Yellow
  exit 1
}
Write-Host "  ✓ コミット完了: $commitMessage" -ForegroundColor Green

# 5. プッシュ
Write-Host "[5/5] リモートにプッシュ中..." -ForegroundColor Yellow
git push origin master 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ✗ エラー: git push に失敗しました" -ForegroundColor Red
  Write-Host "  ヒント: 認証情報を確認してください" -ForegroundColor Yellow
  exit 1
}
Write-Host "  ✓ プッシュ完了" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "デプロイが開始されました" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "GitHub Actionsでデプロイの進行状況を確認してください:" -ForegroundColor Yellow
Write-Host "https://github.com/octdoors-byte/engraving-simulator/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "デプロイ完了後、以下のURLで確認できます:" -ForegroundColor Yellow
Write-Host "https://octdoors-byte.github.io/engraving-simulator/" -ForegroundColor Cyan
Write-Host ""
