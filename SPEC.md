# システム仕様（最新版）

## 1. 概要
- 名入れ刻印シミュレーター（フロントのみ）。ブラウザ上でテンプレ登録→ロゴ配置→PDF（確認用/刻印用）生成まで完結。
- 永続化はローカル（localStorage + IndexedDB）。サーバー不要。
- 技術: Vite + React + react-router-dom。Tailwind でスタイリング。

## 2. 画面とルート
- `/top` … 公開テンプレート一覧（お客様入口）
- `/sim/:templateKey` … シミュレーター本体
- `/categories` … カテゴリ別公開URL一覧（カテゴリごとに表を分割）
- `/common` … お客様向け 共通説明ページ
- `/admin/templates` … テンプレート管理
- `/admin/designs` … 発行履歴管理
- `/admin/common` … 共通設定（カテゴリマスター/共通説明/画像/FAQ/ロゴなど）

## 3. データ構造
### 3.1 共通設定 `CommonSettings`
- `commonInfoCategories`: `{ id: string, title: string, body?: string, color?: string }`（最大3件）
- ほか: header/footer 文言・サイズ、ロゴ画像、共通説明（タイトル/本文/画像最大5枚/PDF最大5MB/FAQ）、表示レイアウトなど。

### 3.2 テンプレート
- `Template` / `TemplateSummary`: `templateKey`, `name`, `status (draft/tested/published/archive)`, `background`, `engravingArea`, `placementRules`, `pdf`, `paper?`, `logoSettings?`, `category?`, `categories?[]`, `comment?`, `updatedAt`.
- 背景画像は IndexedDB（blob）に保存、fallback は localStorage。
- 表/裏が必要な商品は、テンプレを別々に作成します（例: `xxx_front`, `xxx_back`）。公開一覧やカテゴリ一覧でも別テンプレとして表示されます。

### 3.3 デザイン
- `Design` / `DesignSummary`: `designId`, `templateKey`, `createdAt`, ロゴ情報、配置座標、生成PDFアセットID。

## 4. カテゴリ機能
### 4.1 カラー設定
- 5色プリセット（`CATEGORY_COLORS`）から選択。新規カテゴリ追加時に自動割当。
- `color` 未指定の既存データはグレー系で表示。

### 4.2 公開テンプレ一覧 `/top`
- 対象: `published` のみ（公開中のテンプレだけ表示）。表/裏がある場合もテンプレは別々に表示されます。
- カテゴリバッジ: 頭文字1文字＋指定色（未指定はグレー）。未設定は「未分類」扱い。
- フィルタ: テキスト検索 / カテゴリチェックボックス。`?cat=` で初期カテゴリ指定可（複数）。
- URL列: カテゴリごとに公開URLコピー（`/sim/{templateKey}?cat={カテゴリID}`）。

### 4.3 カテゴリ一覧 `/categories`
- カテゴリごとに独立した表を表示（カテゴリ見出し付き）。
- 行: テンプレート名 / 公開URL / コピー / 開く。
- URLは `/sim/{templateKey}?cat={カテゴリID}`。
- カテゴリ内はテンプレ名で昇順ソート。対象は `published` のみ。

## 5. テンプレート管理 `/admin/templates`
- 新規登録: `template.json` + 背景画像ドラッグ&ドロップ。サイズ差があれば自動補正。
- 状態遷移: draft→tested→published→archive（archive は編集不可）。
- 表示名・カテゴリ（複数）をダブルクリック編集。カテゴリはマスターから選択。
- プレビュー: 背景画像（IndexedDBまたはfallback）を表示。
- 削除: 紐づくデザインがある場合は不可（archive 推奨）。
- ロゴ設定: モノクロ切替可。

## 6. 発行履歴 `/admin/designs`
- デザインID、テンプレートキー、日時で一覧・検索。
- PDF（確認/刻印）、ロゴ、背景の再取得が可能。

## 7. シミュレーター本体 `/sim/:templateKey`
- 背景上にロゴを配置・拡大縮小・回転（設定依存）。配置範囲は `engravingArea`、`placementRules` に従う。
- 透過色指定、モノクロ（テンプレ側許可時）。
- PDF生成: 確認用/刻印用を生成し IndexedDB に保存、DL 可。
- バリデーション: ロゴ最小サイズ（mm）、範囲内制約。

## 8. 共通説明 `/common`
- `CommonSettings` の本文・画像・FAQ を表示。レイアウトは `commonInfoLayout` に従う。

## 9. 保存・バックアップ
- localStorage: テンプレ/デザイン/共通設定/バックアップJSON。
- IndexedDB `ksim_db`: 背景画像・ロゴ・生成PDF・自動バックアップ。
- 手動/自動バックアップのエクスポート・復元を提供。

## 10. 制限と注意
- カテゴリ数: 最大3件。
- カラー: プリセット5色（配列編集で拡張可）。
- `color` 未指定データも動作（グレー表示）。
- 大容量画像/PDFは上限あり: 画像2MB/枚×5、PDF 5MB。

## 11. 表/裏（フロント/バック）の取り扱い
- 基本は「片面（1枚）」運用です。
- 表/裏が必要な場合は、テンプレを別々に作成し、別々の公開URLとして扱います。
- 命名は自由ですが、区別しやすいように `*_front` / `*_back` を付ける運用がおすすめです（機能上の必須ではありません）。

## 12. 今後の拡張候補
- 管理側一覧へのカテゴリカラー表示バッジ。
- カラープリセットのユーザー定義化。
- `/categories` にカテゴリ説明や共通リンク表示オプション。
- chunk 分割・ビルドサイズ最適化（現状JS ~760KB gzip284KB）。
