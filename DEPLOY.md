# サーバーへのデプロイ手順

このドキュメントでは、名入れ刻印シミュレーターをサーバー上で動作させる方法を説明します。

## 前提条件

- Node.js 20以上がインストールされていること
- pnpmがインストールされていること（`npm install -g pnpm`）

## 方法1: Node.js + Express サーバーを使用（推奨）

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. ビルド

```bash
pnpm build
```

### 3. サーバーの起動

```bash
# 開発モード
pnpm start

# 本番モード
pnpm start:prod
```

サーバーはデフォルトでポート3000で起動します。環境変数`PORT`で変更可能です。

```bash
PORT=8080 pnpm start:prod
```

### 4. プロセス管理（本番環境推奨）

#### PM2を使用する場合

```bash
# PM2のインストール
npm install -g pm2

# アプリケーションの起動
pm2 start server.js --name engraving-simulator

# 自動起動の設定
pm2 startup
pm2 save
```

#### systemdを使用する場合

`/etc/systemd/system/engraving-simulator.service`を作成:

```ini
[Unit]
Description=Engraving Simulator
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/engraving-simulator
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable engraving-simulator
sudo systemctl start engraving-simulator
```

## 方法2: Nginxを使用（静的ファイル配信）

### 1. ビルド

```bash
pnpm build
```

### 2. Nginx設定

`nginx.conf`を参考に、Nginxの設定ファイルを作成します。

```bash
# 設定ファイルをコピー
sudo cp nginx.conf /etc/nginx/sites-available/engraving-simulator

# シンボリックリンクを作成
sudo ln -s /etc/nginx/sites-available/engraving-simulator /etc/nginx/sites-enabled/

# 設定を編集（ドメイン名やパスを変更）
sudo nano /etc/nginx/sites-available/engraving-simulator

# Nginxを再起動
sudo nginx -t
sudo systemctl reload nginx
```

### 3. ファイルの配置

```bash
# distフォルダをサーバーにコピー
sudo cp -r dist /var/www/engraving-simulator/
sudo chown -R www-data:www-data /var/www/engraving-simulator
```

## 方法3: Dockerを使用

### 1. Dockerイメージのビルド

```bash
docker build -t engraving-simulator -f DOCKERFILE .
```

### 2. コンテナの起動

```bash
docker run -d -p 3000:3000 --name engraving-simulator engraving-simulator
```

### 3. Docker Composeを使用する場合

`docker-compose.yml`を作成:

```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: DOCKERFILE
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
```

```bash
docker-compose up -d
```

## リバースプロキシの設定（任意）

本番環境では、NginxやApacheをリバースプロキシとして使用することを推奨します。

### Nginxリバースプロキシの例

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

## 環境変数

- `PORT`: サーバーのポート番号（デフォルト: 3000）
- `NODE_ENV`: 実行環境（`production`推奨）
- `VITE_BASE_PATH`: アプリケーションのベースパス（デフォルト: `/`）

## トラブルシューティング

### ポートが既に使用されている場合

```bash
# ポートの使用状況を確認
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# 別のポートを指定
PORT=8080 pnpm start:prod
```

### ビルドエラーが発生する場合

```bash
# 依存関係を再インストール
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

### ルーティングが正しく動作しない場合

SPAのため、すべてのルートを`index.html`にリダイレクトする必要があります。サーバー設定を確認してください。

## セキュリティの推奨事項

1. HTTPSを使用する（Let's Encryptなど）
2. ファイアウォールで必要なポートのみ開放
3. 定期的なセキュリティアップデート
4. ログの監視

## パフォーマンス最適化

1. 静的ファイルのキャッシュを有効化
2. Gzip圧縮を有効化
3. CDNの使用を検討
4. 画像の最適化
