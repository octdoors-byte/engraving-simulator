# FTPサーバーへのアップロード手順

## 📦 アップロードするファイル

**`dist/` フォルダの中身すべて**をアップロードしてください。

---

## 🔧 ステップ1: 統合用にビルド（重要）

現在の`dist/`は統合用にビルドされていません。**必ず統合用にビルドしてから**アップロードしてください。

### 方法1: バッチファイルを使用（推奨）

プロジェクトルートで以下を実行：

```bash
統合用ビルド実行.bat
```

### 方法2: 手動でビルド

```bash
# .env.productionファイルを作成（プロジェクトルートに）
# 内容: VITE_BASE_PATH=/simulator/

# ビルド実行
pnpm build
```

### ビルド後の確認

`dist/index.html`を開いて、アセットのパスを確認：

**✅ 正しい（統合用にビルドされている）:**
```html
<script src="/simulator/assets/index-xxx.js"></script>
```

**❌ 間違い（統合用にビルドされていない）:**
```html
<script src="/assets/index-xxx.js"></script>
```

---

## 📤 ステップ2: FTPでアップロード

### アップロード先のパス

サーバーの以下のパスにアップロード：

```
/simulator/
```

または

```
/public_html/simulator/
```

（サーバーの設定によって異なります）

### アップロードするファイル

`dist/`フォルダの中身を**すべて**アップロード：

- `index.html`
- `assets/` フォルダ（中身すべて）
- `basic_settings.html`
- `design_history.html`
- `guide-shots/` フォルダ（中身すべて）
- `public_templates.html`
- `template_creation_guide.html`
- `template_management.html`
- `user-guide.html`

### アップロード方法

1. **FileZillaなどのFTPクライアントを使用**
   - サーバーに接続
   - `/simulator/` フォルダに移動
   - `dist/` の中身をすべてアップロード

2. **フォルダ構造**
   ```
   /simulator/
     ├── index.html
     ├── assets/
     │   ├── certificate-cover-a4.png
     │   ├── index-xxx.js
     │   └── index-xxx.css
     ├── basic_settings.html
     ├── design_history.html
     ├── guide-shots/
     │   └── ...
     └── ...
   ```

---

## ✅ ステップ3: 動作確認

アップロード後、以下にアクセスして動作確認：

```
https://あなたのドメイン/simulator/
```

---

## ⚠️ 注意事項

1. **必ず統合用にビルドしてからアップロード**
   - 統合用にビルドしていないと、パスが正しく動作しません

2. **ファイル権限**
   - アップロード後、必要に応じてファイル権限を設定
   - 通常は `644`（ファイル）、`755`（フォルダ）

3. **既存ファイルのバックアップ**
   - 既に`/simulator/`にファイルがある場合は、バックアップを取ってから上書き

---

## 🔄 更新時の手順

1. 統合用にビルド（`統合用ビルド実行.bat`）
2. `dist/`の中身をFTPでアップロード（既存ファイルを上書き）
3. 動作確認
