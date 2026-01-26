# 【緊急】simulator 404エラー解決手順

## 🔴 現在の状況
`https://kawauso-leather.com/simulator/` にアクセスすると「ページが見つかりません」という404エラーが表示される

---

## 🔍 確認手順（順番に確認してください）

### ステップ1: 直接index.htmlにアクセス

ブラウザで以下にアクセスしてください：

```
https://kawauso-leather.com/simulator/index.html
```

**結果:**
- ✅ **ページが表示される** → ステップ2へ（`.htaccess`のルーティング設定の問題）
- ❌ **404エラー** → ステップ3へ（ファイルが存在しない、またはパスの問題）

---

### ステップ2: サーバー上の.htaccessを確認

もし `index.html` に直接アクセスできる場合、`.htaccess` の設定を確認してください。

**確認場所:**
1. **サーバーのルートディレクトリ（`/`）の `.htaccess`**
   - WinSCPでサーバーのルートディレクトリに移動
   - `.htaccess` ファイルを開く
   - 以下の設定が**WordPressの設定より前に**あるか確認：

```apache
# simulatorディレクトリへのアクセスを許可
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^simulator/ - [L]
</IfModule>
```

**完全な例（WordPress統合版）:**
```apache
# simulatorディレクトリへのアクセスを許可
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^simulator/ - [L]
</IfModule>

# BEGIN WordPress
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.php$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.php [L]
</IfModule>
# END WordPress
```

**もし設定がない場合:**
→ 上記の設定を追加してください（WordPressの設定より前に）

---

### ステップ3: ファイルの存在確認

もし `index.html` に直接アクセスできない場合、ファイルの存在を確認してください。

**確認方法:**
1. WinSCPでサーバーに接続
2. 以下のディレクトリとファイルが存在するか確認：
   - `/simulator/` ディレクトリ
   - `/simulator/index.html` ファイル
   - `/simulator/assets/` ディレクトリ
   - `/simulator/.htaccess` ファイル

**もしファイルが存在しない場合:**
→ ビルドしてファイルをアップロードしてください（下記の「解決方法」を参照）

---

### ステップ4: サーバー上のindex.htmlの内容を確認

FTPでサーバー上の `/simulator/index.html` をダウンロードして、8-9行目を確認してください。

**確認ポイント:**
```html
<!-- 正しい（統合用） -->
<script src="/simulator/assets/index-xxx.js"></script>
<link href="/simulator/assets/index-xxx.css">

<!-- 間違い -->
<script src="/assets/index-xxx.js"></script>
<link href="/assets/index-xxx.css">
```

**もし `/assets/` になっていたら:**
→ 統合用にビルドし直して、再アップロードしてください

---

## 🔧 解決方法

### 方法1: サーバーのルート.htaccessを修正

**手順:**
1. WinSCPでサーバーのルートディレクトリ（`/`）に移動
2. `.htaccess` ファイルを開く（または作成）
3. **WordPressの設定より前に**、以下の設定を追加：

```apache
# simulatorディレクトリへのアクセスを許可
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^simulator/ - [L]
</IfModule>
```

4. 保存
5. ブラウザで `https://kawauso-leather.com/simulator/` にアクセスして確認

---

### 方法2: 統合用にビルドして再アップロード

**手順:**
1. ローカルで統合用にビルド：
   ```bash
   npm run build:integrated
   ```

2. `dist/` フォルダの内容を確認：
   - `dist/index.html` のアセットパスが `/simulator/assets/` になっているか確認

3. サーバーにアップロード：
   - `dist/` フォルダの全内容を `/simulator/` にアップロード
   - `.htaccess` も一緒にアップロード

---

### 方法3: /simulator/.htaccessを確認

`/simulator/.htaccess` ファイルが存在するか確認してください。

**正しい内容:**
```apache
# SPAのルーティング対応
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /simulator/
    
    # ファイルが存在しない場合、index.htmlにリダイレクト
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ index.html [L]
</IfModule>
```

---

## 📋 確認結果を教えてください

以下の結果を教えていただければ、具体的な解決方法をお伝えします：

1. **`https://kawauso-leather.com/simulator/index.html` に直接アクセスした結果**
   - 表示される / 404エラー

2. **サーバーのルートディレクトリ（`/`）の `.htaccess` の内容**
   - `/simulator/` の除外設定があるか
   - WordPressの設定があるか

3. **`/simulator/` ディレクトリとファイルの存在**
   - `/simulator/index.html` が存在するか
   - `/simulator/assets/` が存在するか

4. **サーバー上の `index.html` の8-9行目**
   - `/simulator/assets/` になっているか
   - `/assets/` になっているか

---

## 🚨 よくある原因

### 原因1: WordPressの.htaccessが/simulator/をブロックしている
**症状:** `index.html` に直接アクセスできるが、`/simulator/` にアクセスできない

**解決:** サーバーのルートディレクトリの `.htaccess` に `/simulator/` の除外設定を追加

---

### 原因2: ファイルがアップロードされていない
**症状:** `index.html` に直接アクセスできない

**解決:** 統合用にビルドして、ファイルをアップロード

---

### 原因3: ビルドが正しく行われていない
**症状:** サーバー上の `index.html` が `/assets/` になっている

**解決:** `npm run build:integrated` で統合用にビルドし直す
