#!/bin/bash

# デプロイスクリプト
# 使用方法: ./deploy.sh [環境名]
# 例: ./deploy.sh production

set -e

# 設定ファイルを読み込み（存在する場合）
if [ -f ".deploy.env" ]; then
    source .deploy.env
fi

# デフォルト値
ENVIRONMENT=${1:-production}
SERVER_HOST=${SERVER_HOST:-"your-server.com"}
SERVER_USER=${SERVER_USER:-"deploy"}
SERVER_PATH=${SERVER_PATH:-"/var/www/engraving-simulator"}
PORT=${PORT:-3000}

echo "=========================================="
echo "デプロイを開始します"
echo "環境: $ENVIRONMENT"
echo "サーバー: $SERVER_USER@$SERVER_HOST"
echo "パス: $SERVER_PATH"
echo "=========================================="

# 1. ローカルでビルド
echo "📦 ビルド中..."
pnpm install
pnpm build

# 2. サーバーに接続してデプロイ
echo "🚀 サーバーにデプロイ中..."

ssh $SERVER_USER@$SERVER_HOST << EOF
    set -e
    
    # ディレクトリが存在しない場合は作成
    mkdir -p $SERVER_PATH
    
    # バックアップ（既存のdistがある場合）
    if [ -d "$SERVER_PATH/dist" ]; then
        echo "📦 既存のビルドをバックアップ中..."
        mv $SERVER_PATH/dist $SERVER_PATH/dist.backup.\$(date +%Y%m%d_%H%M%S)
    fi
    
    # プロジェクトディレクトリに移動
    cd $SERVER_PATH
    
    # Gitから最新を取得（Gitを使用している場合）
    if [ -d ".git" ]; then
        echo "📥 Gitから最新を取得中..."
        git pull
    fi
EOF

# 3. ファイルをアップロード
echo "📤 ファイルをアップロード中..."
scp -r dist $SERVER_USER@$SERVER_HOST:$SERVER_PATH/
scp server.js $SERVER_USER@$SERVER_HOST:$SERVER_PATH/
scp package.json $SERVER_USER@$SERVER_HOST:$SERVER_PATH/
scp pnpm-lock.yaml $SERVER_USER@$SERVER_HOST:$SERVER_PATH/

# 4. サーバー上で依存関係をインストールして再起動
echo "🔄 サーバーを再起動中..."

ssh $SERVER_USER@$SERVER_HOST << EOF
    set -e
    cd $SERVER_PATH
    
    # 依存関係のインストール
    echo "📦 依存関係をインストール中..."
    pnpm install --prod --frozen-lockfile
    
    # PM2を使用している場合
    if command -v pm2 &> /dev/null; then
        echo "🔄 PM2で再起動中..."
        pm2 restart engraving-simulator || pm2 start server.js --name engraving-simulator
        pm2 save
    else
        # systemdを使用している場合
        if systemctl is-active --quiet engraving-simulator; then
            echo "🔄 systemdで再起動中..."
            sudo systemctl restart engraving-simulator
        else
            echo "⚠️  PM2またはsystemdが設定されていません。手動でサーバーを起動してください。"
        fi
    fi
    
    echo "✅ デプロイ完了！"
EOF

echo ""
echo "=========================================="
echo "✅ デプロイが完了しました！"
echo "URL: http://$SERVER_HOST:$PORT"
echo "=========================================="
