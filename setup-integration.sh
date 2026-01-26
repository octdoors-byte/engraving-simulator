#!/bin/bash

# かわうそレザー統合用 自動設定スクリプト
# 使用方法: chmod +x setup-integration.sh && ./setup-integration.sh

set -e

echo "=========================================="
echo "かわうそレザー統合 - 自動設定を開始します"
echo "=========================================="

# 1. 環境変数ファイルの作成
echo ""
echo "📝 環境変数ファイルを作成中..."
echo "VITE_BASE_PATH=/simulator/" > .env.production
echo "✅ .env.production を作成しました"

# 2. ビルドの実行
echo ""
echo "📦 統合用にビルド中..."
if pnpm build:integrated; then
    echo "✅ ビルドが完了しました"
else
    echo "❌ ビルドエラーが発生しました"
    echo "手動で 'pnpm build:integrated' を実行してください"
    exit 1
fi

# 3. ビルド成果物の確認
echo ""
echo "📋 ビルド成果物を確認中..."
if [ -f "dist/index.html" ]; then
    echo "✅ dist/index.html が存在します"
    DIST_SIZE=$(du -sh dist | cut -f1)
    echo "   サイズ: $DIST_SIZE"
else
    echo "❌ dist/index.html が見つかりません"
    exit 1
fi

# 4. Nginx設定ファイルの確認
echo ""
echo "📋 Nginx設定ファイルを確認中..."
if [ -f "nginx-integration.conf" ]; then
    echo "✅ nginx-integration.conf が存在します"
else
    echo "⚠️  nginx-integration.conf が見つかりません"
fi

echo ""
echo "=========================================="
echo "✅ 自動設定が完了しました！"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. dist/ フォルダの内容をサーバーの /var/www/kawauso-leather/simulator/ に配置"
echo "2. nginx-integration.conf を参考にNginx設定を追加"
echo "3. メインサイトにリンクを追加: <a href='/simulator/'>名入れ刻印シミュレーター</a>"
echo ""
echo "統合後のURL: https://kawauso-leather.com/simulator/"
echo ""
