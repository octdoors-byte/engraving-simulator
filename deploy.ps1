# PowerShellデプロイスクリプト（Windows用）
# 使用方法: .\deploy.ps1 [環境名]

param(
    [string]$Environment = "production"
)

# 設定ファイルを読み込み（存在する場合）
$configFile = ".deploy.env"
if (Test-Path $configFile) {
    Get-Content $configFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Variable -Name $name -Value $value -Scope Script
        }
    }
}

# デフォルト値
if (-not $SERVER_HOST) { $SERVER_HOST = "your-server.com" }
if (-not $SERVER_USER) { $SERVER_USER = "deploy" }
if (-not $SERVER_PATH) { $SERVER_PATH = "/var/www/engraving-simulator" }
if (-not $PORT) { $PORT = "3000" }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "デプロイを開始します" -ForegroundColor Cyan
Write-Host "環境: $Environment" -ForegroundColor Yellow
Write-Host "サーバー: ${SERVER_USER}@${SERVER_HOST}" -ForegroundColor Yellow
Write-Host "パス: $SERVER_PATH" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

# 1. ローカルでビルド
Write-Host "`n📦 ビルド中..." -ForegroundColor Green
pnpm install
pnpm build

# 2. サーバーにファイルをアップロード
Write-Host "`n📤 ファイルをアップロード中..." -ForegroundColor Green
scp -r dist ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/
scp server.js ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/
scp package.json ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/
scp pnpm-lock.yaml ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/

# 3. サーバー上で依存関係をインストールして再起動
Write-Host "`n🔄 サーバーを再起動中..." -ForegroundColor Green

$deployScript = @"
set -e
cd $SERVER_PATH

# 依存関係のインストール
echo '📦 依存関係をインストール中...'
pnpm install --prod --frozen-lockfile

# PM2を使用している場合
if command -v pm2 &> /dev/null; then
    echo '🔄 PM2で再起動中...'
    pm2 restart engraving-simulator || pm2 start server.js --name engraving-simulator
    pm2 save
else
    # systemdを使用している場合
    if systemctl is-active --quiet engraving-simulator; then
        echo '🔄 systemdで再起動中...'
        sudo systemctl restart engraving-simulator
    else
        echo '⚠️  PM2またはsystemdが設定されていません。手動でサーバーを起動してください。'
    fi
fi

echo '✅ デプロイ完了！'
"@

ssh ${SERVER_USER}@${SERVER_HOST} $deployScript

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ デプロイが完了しました！" -ForegroundColor Green
Write-Host "URL: http://${SERVER_HOST}:${PORT}" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
