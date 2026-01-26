# クイックデプロイガイド

このガイドでは、作成したデプロイスクリプトを使用して簡単にサーバーにデプロイする方法を説明します。

## 📋 事前準備

### 1. 設定ファイルの作成

`.deploy.env.example` を `.deploy.env` にコピーして、実際の値を設定してください：

```bash
# Linux/Mac
cp .deploy.env.example .deploy.env

# Windows
copy .deploy.env.example .deploy.env
```

`.deploy.env` を編集：
```env
SERVER_HOST=your-server.com
SERVER_USER=deploy
SERVER_PATH=/var/www/engraving-simulator
PORT=3000
```

### 2. SSH鍵の設定

サーバーにSSH鍵認証を設定してください：

```bash
ssh-copy-id user@your-server.com
```

## 🚀 デプロイ方法

### 方法1: デプロイスクリプトを使用（推奨）

#### Linux/Mac
```bash
chmod +x deploy.sh
./deploy.sh production
```

または
```bash
pnpm deploy
```

#### Windows
```powershell
.\deploy.ps1 production
```

または
```bash
pnpm deploy:win
```

### 方法2: GitHub Actionsを使用（自動デプロイ）

1. GitHubリポジトリのSecretsに以下を設定：
   - `SERVER_HOST`: サーバーのホスト名
   - `SERVER_USER`: SSHユーザー名
   - `SSH_PRIVATE_KEY`: SSH秘密鍵
   - `SERVER_PATH`: デプロイ先パス（オプション）

2. `main` ブランチにプッシュすると自動デプロイされます

### 方法3: 手動デプロイ

```bash
# 1. ビルド
pnpm build

# 2. サーバーにファイルをアップロード
scp -r dist user@server:/var/www/engraving-simulator/
scp server.js package.json pnpm-lock.yaml user@server:/var/www/engraving-simulator/

# 3. サーバー上で実行
ssh user@server
cd /var/www/engraving-simulator
pnpm install --prod
pm2 restart engraving-simulator
```

## 🛠️ サーバー初期設定（初回のみ）

サーバー上で以下のスクリプトを実行：

```bash
chmod +x setup-server.sh
./setup-server.sh /var/www/engraving-simulator
```

このスクリプトは以下を自動設定します：
- Node.js 20のインストール
- pnpmのインストール
- PM2のインストールと自動起動設定
- systemdサービスの設定（オプション）

## 📦 PM2での管理

### 起動
```bash
pnpm pm2:start
```

### 停止
```bash
pnpm pm2:stop
```

### 再起動
```bash
pnpm pm2:restart
```

### ログ確認
```bash
pnpm pm2:logs
```

### 状態確認
```bash
pm2 status
pm2 info engraving-simulator
```

## 🔧 systemdでの管理

### サービスファイルの配置
```bash
sudo cp engraving-simulator.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable engraving-simulator
```

### 起動/停止/再起動
```bash
sudo systemctl start engraving-simulator
sudo systemctl stop engraving-simulator
sudo systemctl restart engraving-simulator
```

### 状態確認
```bash
sudo systemctl status engraving-simulator
```

### ログ確認
```bash
sudo journalctl -u engraving-simulator -f
```

## 🌐 Nginxリバースプロキシの設定

`nginx.conf` を参考に、Nginxでリバースプロキシを設定：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 ファイアウォール設定

```bash
# UFWを使用している場合
sudo ufw allow 3000/tcp
# またはNginxを使用する場合
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## ✅ デプロイ確認

デプロイ後、以下で確認：

```bash
# サーバーの状態確認
pm2 status
# または
sudo systemctl status engraving-simulator

# ログ確認
pm2 logs engraving-simulator
# または
sudo journalctl -u engraving-simulator -f

# ブラウザでアクセス
curl http://localhost:3000
```

## 🐛 トラブルシューティング

### ポートが使用中
```bash
# ポートの使用状況を確認
sudo netstat -tlnp | grep 3000
# または
sudo lsof -i :3000
```

### 権限エラー
```bash
# ファイルの所有者を確認
ls -la /var/www/engraving-simulator
# 必要に応じて所有者を変更
sudo chown -R $USER:$USER /var/www/engraving-simulator
```

### PM2が起動しない
```bash
# PM2のログを確認
pm2 logs
# PM2を再インストール
npm install -g pm2
pm2 update
```

## 📝 注意事項

- `.deploy.env` ファイルには機密情報が含まれるため、Gitにコミットしないでください
- 本番環境では必ずHTTPSを使用してください（Let's Encryptなど）
- 定期的にバックアップを取得してください
- ログを定期的に確認してください
