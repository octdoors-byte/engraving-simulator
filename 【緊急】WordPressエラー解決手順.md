# 【緊急】WordPressエラー解決手順

## 🔴 現在の状況
- 403エラーが発生
- WordPressの管理画面でJavaScriptエラーが発生
- ホームページが見れなくなった

---

## 🔍 原因の可能性

`.htaccess` の設定がWordPressの動作を妨げている可能性があります。

---

## 🔧 解決方法

### ステップ1: サーバーのルート `.htaccess` を一時的に無効化

**緊急対応:**
1. WinSCPでサーバーのルートディレクトリ（`/`）に移動
2. `.htaccess` を `.htaccess.bak` にリネーム
3. これでWordPressのデフォルト設定に戻ります

---

### ステップ2: ホームページが表示されるか確認

ブラウザで以下にアクセス：

```
https://kawauso-leather.com/
```

**期待される動作:**
- ホームページが表示される
- WordPressの管理画面が正常に動作する

---

### ステップ3: `/admin/` の設定を追加（慎重に）

ホームページが正常に表示されることを確認したら、`.htaccess` を復元して、正しい設定を追加します。

**正しい設定:**
```apache
# /admin/ はWordPressのリライト対象から除外
# この設定は WordPress の設定より前に配置すること
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^admin/ - [L]
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

**重要:**
- `/admin/` の除外設定は、WordPressの設定より**前に**配置する
- `RewriteEngine On` は1回だけ記述する（重複しない）

---

## 📋 確認事項

1. **サーバーのルート `.htaccess` を一時的に無効化**
   - `.htaccess` を `.htaccess.bak` にリネーム

2. **ホームページが表示されるか確認**
   - `https://kawauso-leather.com/` にアクセス

3. **WordPressの管理画面が正常に動作するか確認**
   - 管理画面にログイン
   - 投稿編集画面が正常に動作するか確認

---

## 🔧 もし `.htaccess` を無効化しても403エラーが出る場合

ロリポップの管理画面で確認してください：

1. **「サーバーの管理・設定」→「.htaccess設定」**
2. **`.htaccess` が有効になっているか確認**
3. **エラーログを確認**

---

まずは、**サーバーのルート `.htaccess` を `.htaccess.bak` にリネーム**して、ホームページが表示されるか確認してください。
