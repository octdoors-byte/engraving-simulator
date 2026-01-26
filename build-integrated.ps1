# 統合用ビルドスクリプト（PowerShell版）
# 使用方法: .\build-integrated.ps1
# または: npm run build:integrated

param(
    [switch]$Clean = $true,
    [switch]$Verify = $true
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "統合用ビルドを開始します" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# .env.productionファイルを作成
Write-Host "📝 .env.productionファイルを作成中..." -ForegroundColor Green
@"
VITE_BASE_PATH=/simulator/
"@ | Out-File -FilePath ".env.production" -Encoding utf8 -NoNewline

if (-not (Test-Path ".env.production")) {
    Write-Host "❌ エラー: .env.productionファイルの作成に失敗しました" -ForegroundColor Red
    exit 1
}

# distフォルダをクリーンアップ
if ($Clean -and (Test-Path "dist")) {
    Write-Host "🧹 古いdistフォルダを削除中..." -ForegroundColor Yellow
    Remove-Item -Path "dist" -Recurse -Force
}

# パッケージマネージャーの確認
$pm = "npm"
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pm = "pnpm"
    Write-Host "✅ pnpmが見つかりました" -ForegroundColor Green
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "✅ npmが見つかりました" -ForegroundColor Green
} else {
    Write-Host "❌ エラー: npmまたはpnpmが見つかりません" -ForegroundColor Red
    exit 1
}

# 依存関係の確認
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 依存関係をインストール中..." -ForegroundColor Green
    & $pm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ エラー: 依存関係のインストールに失敗しました" -ForegroundColor Red
        exit 1
    }
}

# ビルド実行
Write-Host ""
Write-Host "🔨 ビルドを実行中..." -ForegroundColor Green
$env:VITE_BASE_PATH = "/simulator/"
& $pm run build:integrated

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  ビルドがエラーコードで終了しました: $LASTEXITCODE" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "✅ ビルドが正常に完了しました" -ForegroundColor Green
}

# 検証
if ($Verify) {
    Write-Host ""
    Write-Host "🔍 ビルド結果を検証中..." -ForegroundColor Green
    
    if (Test-Path "dist\index.html") {
        $content = Get-Content "dist\index.html" -Raw
        if ($content -match "/simulator/assets") {
            Write-Host "✅ パスが正しく設定されています: /simulator/assets/" -ForegroundColor Green
        } else {
            Write-Host "⚠️  警告: パスが /simulator/assets/ になっていません" -ForegroundColor Yellow
            Write-Host "    dist/index.htmlを確認してください" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ エラー: dist/index.htmlが作成されていません" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "ビルド完了！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
