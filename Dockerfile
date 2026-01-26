# マルチステージビルド
# ステージ1: ビルド
FROM node:20-alpine AS builder

WORKDIR /app

# 依存関係のインストール
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# ソースコードのコピーとビルド
COPY . .
RUN pnpm build

# ステージ2: 本番環境
FROM node:20-alpine

WORKDIR /app

# 本番用の依存関係のみインストール
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && \
    pnpm install --prod --frozen-lockfile

# ビルド成果物をコピー
COPY --from=builder /app/dist ./dist
COPY server.js ./

# ポートを公開
EXPOSE 3000

# サーバーを起動
CMD ["node", "server.js"]
