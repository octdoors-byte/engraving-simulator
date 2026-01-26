# 【解決】WordPress編集画面復旧手順

## ✅ 現在の状況
- ホームページは表示された
- 編集画面が見えなくなった

---

## 🔍 原因

`.htaccess` を無効化したことで、WordPressのリライトルールが効かなくなり、管理画面へのアクセスができなくなった可能性があります。

---

## 🔧 解決方法

### ステップ1: `.htaccess` を復元

1. WinSCPでサーバーのルートディレクトリ（`/`）に移動
2. `.htaccess.bak` を `.htaccess` にリネーム（元に戻す）

---

### ステップ2: `.htaccess` の内容を確認

`.htaccess` を開いて、内容を確認してください。

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
- WordPressの設定（`# BEGIN WordPress` 〜 `# END WordPress`）が正しく残っているか確認

---

### ステップ3: もし設定が間違っていた場合

`.htaccess` の内容を上記の正しい設定に置き換えてください。

---

### ステップ4: 動作確認

設定を修正したら、以下を確認：

1. **ホームページが表示されるか**
   ```
   https://kawauso-leather.com/
   ```

2. **WordPressの管理画面にアクセスできるか**
   ```
   https://kawauso-leather.com/wp-admin/
   ```

3. **編集画面が表示されるか**
   - 管理画面にログイン
   - 投稿編集画面を開く

4. **`/admin/` 配下が動作するか**
   ```
   https://kawauso-leather.com/admin/templates
   ```

---

## 📋 確認事項

1. **`.htaccess.bak` を `.htaccess` にリネームしましたか？**
   - はい / いいえ

2. **`.htaccess` の内容を確認しましたか？**
   - WordPressの設定が正しく残っているか
   - `/admin/` の除外設定が正しい位置にあるか

3. **編集画面は表示されますか？**
   - はい / いいえ

---

まずは、**`.htaccess.bak` を `.htaccess` にリネーム**して、`.htaccess` の内容を確認してください。内容を教えていただければ、具体的な修正方法をお伝えします。
