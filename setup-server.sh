#!/bin/bash

# サーバー初期設定スクリプト
# サーバー上で初回のみ実行してください

set -e

echo "=========================================="
echo "サーバー初期設定を開始します"
echo "=========================================="

# Node.jsのインストール確認
if ! command -v node &> /dev/null; then
    echo "📦 Node.jsをインストール中..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# pnpmのインストール
if ! command -v pnpm &> /dev/null; then
    echo "📦 pnpmをインストール中..."
    npm install -g pnpm
fi

# PM2のインストール
if ! command -v pm2 &> /dev/null; then
    echo "📦 PM2をインストール中..."
    npm install -g pm2
fi

# プロジェクトディレクトリの作成
PROJECT_PATH=${1:-"/var/www/engraving-simulator"}
echo "📁 プロジェクトディレクトリを作成: $PROJECT_PATH"
sudo mkdir -p $PROJECT_PATH
sudo chown -R $USER:$USER $PROJECT_PATH

# ログディレクトリの作成
echo "📁 ログディレクトリを作成"
mkdir -p $PROJECT_PATH/logs

# systemdサービスの設定（オプション）
read -p "systemdサービスを設定しますか？ (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "⚙️  systemdサービスを設定中..."
    sudo cp engraving-simulator.service /etc/systemd/system/
    sudo sed -i "s|/var/www/engraving-simulator|$PROJECT_PATH|g" /etc/systemd/system/engraving-simulator.service
    sudo systemctl daemon-reload
    sudo systemctl enable engraving-simulator
    echo "✅ systemdサービスを設定しました"
    echo "   起動: sudo systemctl start engraving-simulator"
    echo "   状態確認: sudo systemctl status engraving-simulator"
fi

# PM2の自動起動設定
echo "⚙️  PM2の自動起動を設定中..."
pm2 startup
pm2 save

echo ""
echo "=========================================="
echo "✅ サーバー初期設定が完了しました！"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. プロジェクトファイルを $PROJECT_PATH に配置"
echo "2. pnpm install && pnpm build を実行"
echo "3. pm2 start ecosystem.config.js で起動"
echo "   または sudo systemctl start engraving-simulator"
