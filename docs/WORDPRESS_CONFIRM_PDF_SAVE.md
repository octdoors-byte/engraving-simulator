# WordPress: 確認用PDFをサーバー保存する（最小構成）

目的: お客様が別PCで発行した「確認用PDF」を、管理者が後からどの端末でも確認できるようにする。

このリポジトリ側で追加したもの:
- フロント側: 発行時に確認用PDFをWordPressへアップロード（設定時のみ）
- WordPress側: 受け取り用の簡易プラグイン `wordpress/ksim-pdf-receiver`

## 1) WordPressにプラグインを設置

1. WordPressサーバーの `wp-content/plugins/` に、フォルダごとアップロード:
   - `wordpress/ksim-pdf-receiver/` -> `wp-content/plugins/ksim-pdf-receiver/`
2. WP管理画面 -> プラグイン -> `KSIM PDF Receiver (Confirm PDF)` を有効化

## 2) アップロード用キーを設定（必須）

`wp-config.php` に1行追加します（ランダムで長い文字列にしてください）:

```php
define('KSIM_UPLOAD_KEY', 'YOUR_LONG_RANDOM_STRING');
```

このキーはフロント（Vite環境変数）にも同じ値を入れます。

## 3) フロント（このアプリ）に環境変数を設定

`.env.production`（またはローカルなら `.env.local`）に設定します。

```env
VITE_WP_KSIM_API_BASE=https://YOUR-WP-DOMAIN/wp-json/ksim/v1
VITE_WP_KSIM_UPLOAD_KEY=YOUR_LONG_RANDOM_STRING
```

## 4) 動作確認

1. `/sim/:templateKey` で発行する
2. WordPress管理画面 -> メディア に `XXXXXX_XXXXXXXX-confirm.pdf`（デザインID）が追加されていればOK

## 注意

- いまのプラグインはCORSを `Access-Control-Allow-Origin: *` にしています（最初の検証用）。
  本番では、運用が固まったら「許可するドメインを限定」に変更するのがおすすめです。
