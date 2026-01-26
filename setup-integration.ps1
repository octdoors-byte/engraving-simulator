# かわうそレザー統合用 自動設定スクリプト
# 使用方法: .\setup-integration.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "かわうそレザー統合 - 自動設定を開始します" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. 環境変数ファイルの作成
Write-Host "`n📝 環境変数ファイルを作成中..." -ForegroundColor Green
$envContent = "VITE_BASE_PATH=/simulator/"
$envContent | Out-File -FilePath .env.production -Encoding utf8 -NoNewline
Write-Host "✅ .env.production を作成しました" -ForegroundColor Green

# 2. ビルドの実行
Write-Host "`n📦 統合用にビルド中..." -ForegroundColor Green
try {
    pnpm build:integrated
    Write-Host "✅ ビルドが完了しました" -ForegroundColor Green
} catch {
    Write-Host "❌ ビルドエラー: $_" -ForegroundColor Red
    Write-Host "手動で 'pnpm build:integrated' を実行してください" -ForegroundColor Yellow
    exit 1
}

# 3. ビルド成果物の確認
Write-Host "`n📋 ビルド成果物を確認中..." -ForegroundColor Green
if (Test-Path "dist\index.html") {
    Write-Host "✅ dist/index.html が存在します" -ForegroundColor Green
    $distSize = (Get-ChildItem -Path dist -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "   サイズ: $([math]::Round($distSize, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "❌ dist/index.html が見つかりません" -ForegroundColor Red
    exit 1
}

# 4. Nginx設定ファイルの確認
Write-Host "`n📋 Nginx設定ファイルを確認中..." -ForegroundColor Green
if (Test-Path "nginx-integration.conf") {
    Write-Host "✅ nginx-integration.conf が存在します" -ForegroundColor Green
} else {
    Write-Host "⚠️  nginx-integration.conf が見つかりません" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ 自動設定が完了しました！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Yellow
Write-Host "1. dist/ フォルダの内容をサーバーの /var/www/kawauso-leather/simulator/ に配置" -ForegroundColor White
Write-Host "2. nginx-integration.conf を参考にNginx設定を追加" -ForegroundColor White
Write-Host "3. メインサイトにリンクを追加: <a href='/simulator/'>名入れ刻印シミュレーター</a>" -ForegroundColor White
Write-Host ""
Write-Host "統合後のURL: https://kawauso-leather.com/simulator/" -ForegroundColor Cyan
Write-Host ""
