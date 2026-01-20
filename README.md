# 名入れ刻印シミュレーター

社内向けの名入れ刻印シミュレーターです。テンプレートの登録、ロゴの配置、PDF（確認用/刻印用）発行までをブラウザで完結できます。ローカルの `localStorage` と `IndexedDB` にデータを保存する設計です。

## 主な機能
- テンプレート管理（登録/状態管理/背景プレビュー）
- ロゴのアップロード、トリミング、透過処理、配置調整
- デザインIDの発行と確認用PDFプレビュー/ダウンロード
- 発行履歴の一覧・検索・一括削除
- 自動バックアップ/手動バックアップのエクスポート/復元

## 画面構成
- `/top`: 公開テンプレート一覧（お客様向け入口）
- `/sim/:templateKey`: シミュレーター本体
- `/admin/templates`: テンプレート管理
- `/admin/designs`: 発行履歴管理
- `/admin/common`: 共通説明の編集（タイトル/本文/画像）
- `/common`: お客様向け 共通説明ページ

## 開発/起動
```bash
pnpm install
pnpm dev
```

## かんたん起動（Windows）
`start-local.bat` をダブルクリックすると、サーバーを起動して自動でブラウザを開きます。

## ビルド/プレビュー
```bash
pnpm build
pnpm preview
```

## テスト
```bash
pnpm test
pnpm test:e2e
```

## データ保存
- `localStorage`: テンプレート/デザイン/共通設定
- `IndexedDB (ksim_db)`: 背景画像/ロゴ/生成PDF/バックアップ

## 重要ファイル
- `src/pages/sim/SimPage.tsx`: シミュレーター本体
- `src/pages/admin/AdminTemplatesPage.tsx`: テンプレート管理
- `src/pages/admin/AdminDesignsPage.tsx`: 発行履歴管理
- `src/domain/pdf/`: PDF生成ロジック
- `src/storage/`: localStorage/IndexedDB/バックアップ管理

## 備考
- テンプレートの形式は `src/domain/template/validateTemplate.ts` を参照。
- 初期データは `src/domain/seed/seedData.ts` で投入されます。
