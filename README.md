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
- `/categories`: カテゴリ別 公開URL 一覧（お客様向け）

## 役割（管理者 / お客様）と操作フロー

### 管理者（社内・運用者）がやること
1. **基本設定を登録**（`/admin/common`）  
   - ロゴ、見出し、共通説明、カテゴリカラーなど「全体に効く設定」を整える。
2. **テンプレートを登録・調整**（`/admin/templates`）  
   - JSON＋背景画像を登録し、プレビューで位置や見た目を確認する。
3. **公開してURLを共有**（`/admin/templates`）  
   - draft → tested → published の順で状態を切り替え、公開URLをお客様へ渡す。
   - `/top` や `/categories` は「社内で公開状態を確認するための一覧」として使う（お客様が必ず見るとは限らない）。
4. **履歴を確認・対応**（`/admin/designs`）  
   - 発行履歴の検索/削除、必要に応じてバックアップ/復元を行う。

### お客様（外部・利用者）がやること
1. **管理者から渡されたURLを開く**（例：`/sim/:templateKey`）  
   - 公開テンプレート一覧（`/top`）を見ずに、直接URLからシミュレーターを利用する運用が基本。
2. **ロゴ等を入れて確認→発行**  
   - ロゴアップロード、配置調整、確認用/刻印用PDFの生成・ダウンロードを行う。

> 注意: 本アプリのデータはサーバーDBではなく、利用したブラウザの `localStorage` / `IndexedDB` に保存されます。
> そのため「どの端末/ブラウザで操作したか」で、履歴や保存データの見え方が変わります。

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

## 統合用ビルド（簡単）

```bash
# 最も簡単な方法（推奨）
npm run build:integrated

# クリーンビルド（古いファイルを削除してからビルド）
npm run build:integrated:clean
```

詳細は [BUILD_GUIDE.md](./BUILD_GUIDE.md) を参照してください。

## サーバーへのデプロイ

詳細な手順は [DEPLOY.md](./DEPLOY.md) を参照してください。

### クイックスタート（Node.jsサーバー）

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm build

# サーバー起動
pnpm start
```

サーバーはデフォルトで `http://localhost:3000` で起動します。

### その他のデプロイ方法

- **GitHub Pages**: 自動デプロイに対応（[GITHUB_PAGES_DEPLOY.md](./GITHUB_PAGES_DEPLOY.md) を参照）
- **Nginx**: 静的ファイルとして配信
- **Docker**: `docker-compose up` で起動
- **PM2/systemd**: プロセス管理ツールを使用

詳細は [DEPLOY.md](./DEPLOY.md) を参照してください。

## テスト
```bash
pnpm test
pnpm test:e2e
```

## データ保存
- `localStorage`: テンプレート/デザイン/共通設定
- `IndexedDB (ksim_db)`: 背景画像/ロゴ/生成PDF/バックアップ

## 最近の仕様追加（カテゴリ一覧 & カラー対応）
- `/categories` を追加し、カテゴリごとにテンプレートの公開URLを「テンプレート名 / 公開URL / コピー / 開く」の1行で表示（公開中のみ）。
- 公開テンプレ一覧（/top）のカテゴリバッジは頭文字1文字表示＋カテゴリカラーを反映。
- 基本設定のカテゴリ編集で色を5色プリセットから選択でき、追加時に自動割り当て。`commonInfoCategories` に `color` を保存。
- 既存データで `color` 未指定の場合は従来のグレーで表示。

## 重要ファイル
- `src/pages/sim/SimPage.tsx`: シミュレーター本体
- `src/pages/admin/AdminTemplatesPage.tsx`: テンプレート管理
- `src/pages/admin/AdminDesignsPage.tsx`: 発行履歴管理
- `src/domain/pdf/`: PDF生成ロジック
- `src/storage/`: localStorage/IndexedDB/バックアップ管理

## 備考
- テンプレートの形式は `src/domain/template/validateTemplate.ts` を参照。
- 初期データは `src/domain/seed/seedData.ts` で投入されます。

## ドキュメントサマリー（1枚）
- `docs/OVERVIEW.md` に、概要/技術スタック/データフロー/永続化（localStorage・IndexedDB）/課題をまとめています。

## 今何ができるのか（現行機能）
- テンプレート管理（JSON＋背景画像の登録、draft/tested/published 状態、画像アップロード＋位置調整）。
- 基本設定／共通説明（タイトル・本文・ロゴ・カラー・カテゴリ説明など）を `/admin/common` で一元管理し、ナビや他画面に反映。
- 公開テンプレート一覧（`/top`）とカテゴリ一覧（`/categories`）から、顧客向けに公開中テンプレートを確認・共有。
- シミュレーター本体（`/sim/:templateKey`）でロゴアップロード・確認用・刻印用PDF生成・印刷用書き出し。
- 発行履歴管理（`/admin/designs`）で履歴検索・絞り込み・削除 + IndexedDB/LocalStorage バックアップ。
- ローカル保存の自動/手動バックアップと復元機能により、データの保全。

## ユーザーの操作ステップ
1. **基本設定を整える**  
   - `/admin/common` で見出し・説明文・ロゴ・カテゴリカラーなどを登録。共通情報はテンプレートプレビューや公開側のヘッダーに反映される。
2. **カテゴリを整理する（任意）**  
   - `/categories` でテンプレートを分けておくと公開一覧がグルーピングされ、用途別の入口になる。不要なら飛ばして OK。
3. **テンプレート管理**  
   - `/admin/templates` で JSON/背景を登録。プレビューで位置・文字サイズを確認し、draft→tested→published を順に切り替えて品質を担保。
   - 画像はトリミング・配置調整が可能。公開 URL のコピーもこの画面から。
4. **公開リリース＆お客様の利用**
   - 管理者が公開URLを発行すると、お客様はそのURLだけを直接開いてシミュレーターを使います。公開テンプレート一覧（`/top`/`/categories`）は社内確認用で、お客様が必ず見るとは限りません。
   - `/sim/:templateKey` ではロゴアップロード・確認用/刻印用PDF生成を行い、PDFやリンクを社内から共有する形になります。
5. **デザイン発行履歴で確認＆対応**  
   - `/admin/designs` に履歴（日時/テンプレート/PDF）を保存。CSV エクスポート・再発行・削除をここから操作。
   - IndexedDB (ksim_db) や LocalStorage のバックアップ機能で復元も可能。
6. **デプロイ/ビルド**  
   - `pnpm build` 、`npm run build:integrated` 等でビルドし、`pnpm start`/`npm run dev` でサーバー立ち上げ。デプロイは `DEPLOY.md` も参照。
