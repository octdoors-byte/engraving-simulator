# 【AI依頼用】かわうそレザーサイト統合パッケージ

## 📋 依頼内容サマリー

名入れ刻印シミュレーターをかわうそレザーのサイトに統合してください。

**統合後のURL**: `https://kawauso-leather.com/simulator/`

---

## 📦 提供ファイル一覧

### 【必須】ビルド成果物
1. **`dist/` フォルダ**
   - ビルド済みのファイル一式
   - 配置先: `/var/www/kawauso-leather/simulator/`

### 【必須】設定ファイル
2. **`nginx-integration.conf`**
   - Nginx設定例（既存設定に追加）

### 【参考】ドキュメント
3. **`AI依頼用_簡易手順.md`**
   - 3ステップの簡単手順

4. **`AI依頼用_必要な情報とファイル.md`**
   - 詳細な手順と必要な情報

5. **`AI依頼用_チェックリスト.md`**
   - 作業チェックリスト

---

## 🔧 最小限の作業手順

### 1. ファイル配置
```bash
sudo cp -r dist/* /var/www/kawauso-leather/simulator/
sudo chown -R www-data:www-data /var/www/kawauso-leather/simulator
sudo chmod -R 755 /var/www/kawauso-leather/simulator
```

### 2. Nginx設定追加
`nginx-integration.conf` の18-28行目を既存のNginx設定に追加

### 3. Nginx再読み込み
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4. 動作確認
https://kawauso-leather.com/simulator/ にアクセス

---

## 📝 必要な情報（事前確認）

以下の情報があるとスムーズです：

- [ ] サーバーのSSH接続情報
- [ ] 現在のNginx設定ファイルのパス
- [ ] かわうそレザーサイトのドキュメントルート
- [ ] sudo権限の有無

---

## ✅ 確認事項

統合後、以下を確認してください：

1. **URLアクセス**
   - https://kawauso-leather.com/simulator/ が表示される

2. **アセット読み込み**
   - JavaScript、CSS、画像が正しく読み込まれる

3. **既存サイトへの影響**
   - https://kawauso-leather.com/ が正常に動作する

---

## 📞 トラブル時の対応

問題が発生した場合：

1. Nginx設定から追加した部分を削除
2. エラーログを確認（`/var/log/nginx/error.log`）
3. プロジェクト担当者に連絡

詳細は `AI依頼用_必要な情報とファイル.md` を参照してください。
