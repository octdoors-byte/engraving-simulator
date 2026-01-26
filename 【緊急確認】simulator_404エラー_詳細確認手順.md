# 【緊急確認】simulator 404エラー 詳細確認手順

## 🔴 現在の状況
- `https://kawauso-leather.com/simulator/` → 「ページが見つかりません」（404エラー）
- `https://kawauso-leather.com/top` → かわうそレザーのWordPressサイトのトップページが表示される

---

## 🔍 確認手順（順番に確認してください）

### ステップ1: /simulator/ディレクトリの存在確認

**WinSCPでサーバーに接続して確認：**

1. サーバーのルートディレクトリ（`/`）に移動
2. `/simulator/` ディレクトリが存在するか確認
3. `/simulator/index.html` ファイルが存在するか確認
4. `/simulator/assets/` ディレクトリが存在するか確認
5. `/simulator/.htaccess` ファイルが存在するか確認

**結果:**
- ✅ すべて存在する → ステップ2へ
- ❌ 存在しない → ステップ4へ（ファイルをアップロード）

---

### ステップ2: 直接index.htmlにアクセス

ブラウザで以下にアクセスしてください：

```
https://kawauso-leather.com/simulator/index.html
```

**結果:**
- ✅ **ページが表示される** → ステップ3へ（`.htaccess`のルーティング設定の問題）
- ❌ **404エラー** → ステップ4へ（ファイルパスの問題）

---

### ステップ3: サーバー上のindex.htmlの内容を確認

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

### ステップ4: ルートディレクトリの.htaccessを確認

**WinSCPでサーバーのルートディレクトリ（`/`）の `.htaccess` を確認：**

以下の設定が**WordPressの設定より前に**あるか確認：

```apache
# /simulator/ はWordPressのリライト対象から除外
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^simulator/ - [L]
</IfModule>
```

**もし設定がない、またはWordPressの設定より後にある場合:**
→ `.htaccess_ルートディレクトリ用_最適化版_WordPress互換` の内容に置き換えてください

---

### ステップ5: /simulator/.htaccessを確認

**WinSCPで `/simulator/.htaccess` を確認：**

以下の内容になっているか確認：

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

**もし設定がない、または間違っている場合:**
→ `.htaccess_simulatorディレクトリ用` の内容に置き換えてください

---

## 🔧 解決方法

### 方法1: 統合用にビルドして再アップロード

**手順:**
1. ローカルで統合用にビルド：
   ```bash
   npm run build:integrated
   ```

2. `dist/` フォルダの内容を確認：
   - `dist/index.html` のアセットパスが `/simulator/assets/` になっているか確認

3. サーバーにアップロード：
   - `dist/` フォルダの全内容を `/simulator/` にアップロード
   - `.htaccess_simulatorディレクトリ用` の内容を `/simulator/.htaccess` としてアップロード

---

### 方法2: ルートディレクトリの.htaccessを修正

**手順:**
1. WinSCPでサーバーのルートディレクトリ（`/`）に移動
2. `.htaccess` ファイルを開く
3. `.htaccess_ルートディレクトリ用_最適化版_WordPress互換` の内容に置き換え
4. 保存
5. ブラウザで `https://kawauso-leather.com/simulator/` にアクセスして確認

---

## 📋 確認結果を教えてください

以下の結果を教えていただければ、具体的な解決方法をお伝えします：

1. **`/simulator/` ディレクトリとファイルの存在**
   - `/simulator/index.html` が存在するか
   - `/simulator/assets/` が存在するか
   - `/simulator/.htaccess` が存在するか

2. **`https://kawauso-leather.com/simulator/index.html` に直接アクセスした結果**
   - 表示される / 404エラー

3. **サーバー上の `index.html` の8-9行目**
   - `/simulator/assets/` になっているか
   - `/assets/` になっているか

4. **サーバーのルートディレクトリ（`/`）の `.htaccess` の内容**
   - `/simulator/` の除外設定があるか
   - WordPressの設定より前に配置されているか

---

## 🚨 よくある原因

### 原因1: /simulator/ディレクトリにファイルがアップロードされていない
**症状:** `/simulator/` ディレクトリが存在しない、または空

**解決:** 統合用にビルドして、ファイルをアップロード

---

### 原因2: ビルドが正しく行われていない
**症状:** サーバー上の `index.html` が `/assets/` になっている

**解決:** `npm run build:integrated` で統合用にビルドし直す

---

### 原因3: ルートディレクトリの.htaccessに/simulator/の除外設定がない
**症状:** `index.html` に直接アクセスできるが、`/simulator/` にアクセスできない

**解決:** ルートディレクトリの `.htaccess` に `/simulator/` の除外設定を追加
