# 統合用ビルドガイド

統合用ビルドを簡単に実行する方法を説明します。

## 🚀 簡単な方法（推奨）

### Windows（PowerShell）

```powershell
# 方法1: npmスクリプトを使用（最も簡単）
npm run build:integrated

# 方法2: PowerShellスクリプトを直接実行
.\build-integrated.ps1

# 方法3: クリーンビルド（古いファイルを削除してからビルド）
npm run build:integrated:clean
```

### Mac/Linux

```bash
# 方法1: npmスクリプトを使用
npm run build:integrated

# 方法2: クリーンビルド
npm run build:integrated:clean
```

## 📋 実行される処理

1. `.env.production`ファイルを作成（`VITE_BASE_PATH=/simulator/`を設定）
2. 古い`dist`フォルダを削除（クリーンビルドの場合）
3. 依存関係をインストール（必要な場合）
4. 統合用ビルドを実行
5. ビルド結果を検証（`/simulator/assets/`パスが含まれているか確認）

## 🔍 ビルド結果の確認

ビルド後、以下のファイルを確認してください：

- `dist/index.html` - `/simulator/assets/`パスが含まれているか確認
- `dist/assets/` - ビルドされたアセットファイル

## 🐙 GitHub Actions（自動ビルド）

`main`ブランチにプッシュすると、自動的にビルドが実行されます。

- ビルド結果は「Actions」タブで確認できます
- 成果物は7日間保持されます

## 🛠️ トラブルシューティング

### ビルドが失敗する場合

1. 依存関係を再インストール：
   ```bash
   npm install
   ```

2. キャッシュをクリア：
   ```bash
   npm run build:integrated:clean
   ```

3. Node.jsのバージョンを確認：
   ```bash
   node --version  # 20以上である必要があります
   ```

### パスが正しく設定されない場合

1. `.env.production`ファイルを確認：
   ```bash
   cat .env.production
   # VITE_BASE_PATH=/simulator/ が含まれているか確認
   ```

2. `vite.config.ts`を確認：
   - `loadEnv`を使用して環境変数を読み込んでいるか確認

3. クリーンビルドを実行：
   ```bash
   npm run build:integrated:clean
   ```

## 📝 その他のビルドコマンド

- `npm run build` - 通常のビルド（baseパスなし）
- `npm run build:admin` - 管理画面用ビルド（`/admin/`パス）
- `npm run build:subdomain` - サブドメイン用ビルド（ルートパス）
