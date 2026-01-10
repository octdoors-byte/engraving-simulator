# 刻印デザインシミュレーター（ローカル完結版）実装仕様書（詳細）
spec_id: engraving-simulator-local-v1.1  
対象: **ローカル環境（Vite + React + TypeScript + Tailwind）で動くMVP**（課金/サーバー連携なし）  
更新: 2026-01-09

---

## 0. この仕様書の使い方（Codex/実装者向け）
- **ここに書かれていることだけ**を実装対象とする（未記載の機能は入れない）。
- 迷う点が出た場合は **「v1.1ではやらない」** を優先し、将来拡張の余地としてコメントに残す。
- ブラウザ保存（localStorage/IndexedDB）が前提のため、**データの破損/容量不足**に備えたエラーを必ず実装する。

---

## 1. ゴール（Done Definition）
以下が **すべて**満たされたらDone：

### 1.1 起動・画面
- `npm install` → `npm run dev` でローカル起動できる
- ルーティングが動作し、以下のページにアクセスできる
  - `/sim/:templateKey`
  - `/admin/templates`
  - `/admin/designs`

### 1.2 テンプレート登録（管理）
- `/admin/templates` で `template.json + 背景画像` を **D&D** で登録できる
- ステータス `draft/tested/published` を一覧で切り替えられる
- `published` 以外のテンプレで `/sim/:templateKey` にアクセスした場合、**エラー画面**が表示される

### 1.3 お客様フロー
- `/sim/:templateKey` にて、以下が一連で動く
  1) ロゴアップロード（5MB、PNG/JPEG/WEBP）
  2) トリミング（任意範囲）
  3) 背景透過（弱/中/強）+ モノクロ（ON/OFF）
  4) 刻印枠内に配置（ドラッグ/拡大縮小）
  5) Design ID を生成し、確認用PDFをダウンロードできる

### 1.4 デザイン履歴（管理）
- `/admin/designs` に発行済み履歴が残り、PDF（確認用/刻印用）を再ダウンロードできる
- ページリロードしても履歴が消えない

---

## 2. 非目標（v1.1では実装しない）
- 認証、決済、サーバー保存、メール送信
- 画像のAI切り抜き、外部API
- 複数画像、テキスト刻印（ロゴ画像のみ）
- 回転（rotate）
- 印刷会社向けのCMYK変換やベクタ化

---

## 3. 技術要件（固定）
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router（v6）
- PDF生成: `pdf-lib`
- 画像処理: Canvas API（2D）
- 永続化:
  - JSON: localStorage
  - 画像/PDF: IndexedDB（Blob）※推奨・v1.1では採用する
- 状態管理: React Context + hooks（Zustand等は不要）

---

## 4. 画面一覧・URL・権限
| 区分 | URL | ページ名 | アクセス |
|---|---|---|---|
| お客様 | `/sim/:templateKey` | シミュレーター | templateが`tested/published`のみ |
| 管理 | `/admin/templates` | テンプレ管理 | 常に可（ローカル運用想定） |
| 管理 | `/admin/designs` | デザイン履歴 | 常に可（ローカル運用想定） |

> v1.1では管理画面のアクセス制限はしない（認証なし）。

---

## 5. データ設計（永続化）

### 5.1 Storageキー（localStorage）
- `ksim:appVersion` … `"1.1.0"`
- `ksim:commonSettings` … 共通ヘッダー/フッター設定（JSON）
- `ksim:templates:index` … テンプレ一覧（軽量）
- `ksim:template:{templateKey}` … テンプレ詳細（JSON）
- `ksim:designs:index` … デザイン一覧（軽量）
- `ksim:design:{designId}` … デザイン詳細（JSON）

### 5.2 IndexedDB（必須採用）
#### 5.2.1 DB名/バージョン
- DB名: `ksim_db`
- version: `1`

#### 5.2.2 ObjectStore
- `assets`
  - keyPath: `id`（string）
  - indices: `type`（'templateBg'|'logoOriginal'|'logoEdited'|'pdfConfirm'|'pdfEngrave'）
  - value:
    - `id: string`（例: `asset:templateBg:certificate_cover_a4_v1`）
    - `type: string`
    - `blob: Blob`
    - `createdAt: string (ISO)`

#### 5.2.3 アセットID命名規則（固定）
- テンプレ背景: `asset:templateBg:{templateKey}`
- ロゴ原本: `asset:logoOriginal:{designId}`
- ロゴ編集後: `asset:logoEdited:{designId}`
- PDF確認用: `asset:pdfConfirm:{designId}`
- PDF刻印用: `asset:pdfEngrave:{designId}`

### 5.3 Template（JSON）スキーマ（v1.1）
```json
{
  "templateKey": "certificate_cover_a4_v1",
  "name": "証書カバーA4（右下刻印）",
  "status": "draft",
  "updatedAt": "2026-01-09T10:00:00.000+09:00",
  "background": {
    "fileName": "bg.png",
    "canvasWidthPx": 1200,
    "canvasHeightPx": 1600
  },
  "engravingArea": {
    "label": "内枠（刻印可能範囲）",
    "x": 820,
    "y": 1220,
    "w": 280,
    "h": 180
  },
  "placementRules": {
    "allowRotate": false,
    "keepInsideEngravingArea": true,
    "minScale": 0.1,
    "maxScale": 6.0
  },
  "pdf": {
    "pageSize": "A4",
    "orientation": "portrait",
    "dpi": 300
  }
}
```

### 5.4 Design（発行済み）スキーマ（v1.1）
```json
{
  "designId": "260109_K7M3Q9XR",
  "templateKey": "certificate_cover_a4_v1",
  "createdAt": "2026-01-09T10:12:34.000+09:00",
  "logo": {
    "fileName": "logo.png",
    "mimeType": "image/png",
    "sizeBytes": 123456,
    "crop": { "x": 0.12, "y": 0.08, "w": 0.76, "h": 0.81 },
    "transparentLevel": "medium",
    "monochrome": true
  },
  "placement": {
    "x": 860,
    "y": 1260,
    "w": 180,
    "h": 90
  },
  "pdf": {
    "confirmAssetId": "asset:pdfConfirm:260109_K7M3Q9XR",
    "engraveAssetId": "asset:pdfEngrave:260109_K7M3Q9XR"
  }
}
```

### 5.5 座標系ルール（重要）
- `template.background.canvasWidthPx/HeightPx` を **基準座標系（px）** とする
- `engravingArea` と `placement` は **必ずこの基準座標系**で保存する
- 画面表示（レスポンシブ）では、表示上のスケール `viewScale` を計算し、描画時に変換する

---

## 6. 共通ヘッダー/フッター（全ページ）

### 6.1 UI配置
- 管理画面 `/admin/templates` の最上部に設定パネルを表示
- 設定は全ページに反映（Sim/管理共通）

### 6.2 設定項目（v1.1固定）
- `logoImage`（任意）: 画像アップロード（D&D/クリック）
- `headerText`（任意）: 説明文（1～2行想定）
- `footerText`（任意）: フッター文言
- `logoAlign`: `left|center|right`
- `headerTextAlign`: `left|center|right`
- `footerTextAlign`: `left|center|right`
- `logoSize`: `sm|md|lg`
- `headerTextSize`: `sm|md|lg`
- `footerTextSize`: `sm|md|lg`

### 6.3 保存タイミング
- 入力変更時に自動保存（デバウンス300ms）
- ロゴ画像は `IndexedDB assets` に `type=commonLogo` を作りたいが、v1.1では **assets.typeに追加しない**  
  → `commonLogo` は localStorage Base64で保存（最大2MB警告）でもよい。  
  **ただし容量超過時は警告して保存中止**。

（※将来: commonLogoもIndexedDB化）

---

## 7. お客様画面（/sim/:templateKey）詳細仕様

### 7.1 画面レイアウト（PC）
- 左カラム（幅 360px～420px）: ステップUI
- 右カラム（残り）: プレビュー（背景 + 刻印枠 + ロゴ）
- 下部固定（または左カラム末尾）: 「発行」ボタン

### 7.2 レスポンシブ（スマホ）
- 1カラム縦積み
  - 上: プレビュー
  - 下: 操作（ステップ）
- トリミングモーダルは **高さ80vh以内**、操作ボタンは常に見える

### 7.3 ステップ状態管理（状態機械）
`simState` を以下で管理（UIの表示/活性を制御）

- `EMPTY`（未アップロード）
- `UPLOADED`（画像読み込み済み）
- `EDITING`（トリミング/透過/モノクロ調整中）
- `PLACEMENT`（配置調整中）
- `READY_TO_ISSUE`（発行可能）
- `ISSUING`（発行処理中）
- `ISSUED`（発行完了：PDFダウンロード済）
- `ERROR`（致命エラー）

遷移ルール（要点）
- `EMPTY -> UPLOADED`（画像読込成功）
- `UPLOADED -> EDITING`（自動）
- `EDITING -> PLACEMENT`（「配置へ」ボタン）
- `PLACEMENT -> READY_TO_ISSUE`（ロゴが枠内に収まったら自動）
- `READY_TO_ISSUE -> ISSUING`（発行押下）
- `ISSUING -> ISSUED`（成功） / `ERROR`（失敗）

### 7.4 ファイル入力仕様（ロゴ）
- 形式: PNG/JPEG/WEBP
- サイズ上限: 5MB（5,242,880 bytes）
- 読み込み:
  - `FileReader.readAsArrayBuffer` → `Blob` → `createImageBitmap`（推奨）
- 失敗時:
  - `simState=ERROR`ではなく、`EMPTY`に戻してエラー表示（復帰可能に）

### 7.5 トリミング仕様
#### 7.5.1 UI
- モーダルで実施
- 操作:
  - ドラッグで範囲移動
  - 角/辺ハンドルで範囲変更
  - 拡大縮小スライダー（画像ズーム）
- 出力:
  - 画像編集の結果は「編集後ロゴ画像（透過/モノクロ前のベース）」としてCanvasで生成

#### 7.5.2 数学的定義（保存するcrop）
- `crop` は **元画像に対する正規化座標（0～1）**
  - `x,y,w,h` は全て0～1
- UI側のピクセル座標は、元画像サイズに換算して保存

### 7.6 背景透過（簡易）仕様（v1.1固定アルゴリズム）
> 目的: 「白背景のロゴ」を刻印用に使いやすくする。完璧な切り抜きは狙わない。

#### 7.6.1 背景色推定
- トリミング後画像の **四隅4点** のRGB平均を背景色 `bgColor` とする
  - 右上/左上/右下/左下の各ピクセルをサンプル
  - `bgR = avg(Ri)` など

#### 7.6.2 しきい値（3段階）
- `weak`: 24
- `medium`: 40
- `strong`: 64
（値はRGB距離の閾値）

#### 7.6.3 透明化処理
- 各ピクセルについて
  - `d = sqrt((r-bgR)^2 + (g-bgG)^2 + (b-bgB)^2)`
  - `d < threshold` の場合、`alpha = 0`
  - それ以外は `alpha` を保持（元alphaがある場合は乗算）
- 端のギザギザ軽減（簡易）
  - `d` が閾値付近（threshold～threshold+12）の場合、線形で `alpha` を 0～元alpha に補間してもよい（任意）

### 7.7 モノクロ（任意）仕様
- ONの場合：グレースケール化し、二値化する
  - `gray = 0.299*r + 0.587*g + 0.114*b`
  - 二値化閾値: 160（固定）
  - `gray >= 160` → 白（r=g=b=255、alpha維持）
  - `gray < 160` → 黒（r=g=b=0、alpha維持）

### 7.8 配置（ドラッグ/拡大縮小）仕様
#### 7.8.1 表示要件
- 背景画像を canvas 全面に描画
- `engravingArea` をガイド表示（枠 + 薄い塗り）
- ロゴは編集済み画像を描画
- ロゴ選択中のみ、バウンディングボックス + リサイズハンドル表示

#### 7.8.2 操作
- ドラッグ移動
  - Pointer Events使用（mouse/touch統一）
- リサイズ
  - 右下ハンドルのみ（v1.1固定）
  - 縦横比は固定（元画像比）
  - 最小サイズ: 幅/高さともに **10px以上**（基準座標系）
  - 最大サイズ: `placementRules.maxScale` に従う

#### 7.8.3 枠内制約（必須）
- `keepInsideEngravingArea=true` の場合、ロゴ矩形が枠からはみ出ないようにする
- 実装方式（固定）: **クランプ**
  - `x` の範囲: `[engrave.x, engrave.x + engrave.w - logo.w]`
  - `y` の範囲: `[engrave.y, engrave.y + engrave.h - logo.h]`
- リサイズ時も同様にクランプ
  - サイズ変更後に `x,y` をクランプ
  - もし `logo.w > engrave.w` または `logo.h > engrave.h` になった場合
    - 自動で縮小して枠内に収める（推奨）
    - その上で `READY_TO_ISSUE` にならない状態を回避

#### 7.8.4 初期配置（固定）
- 編集完了後、初回配置は以下で計算
  - ロゴを枠内に収まる最大サイズ（枠の90%）で初期化
  - 中央寄せ
  - 例:
    - `scale = min((engrave.w*0.9)/logoW, (engrave.h*0.9)/logoH)`
    - `w = logoW*scale`, `h = logoH*scale`
    - `x = engrave.x + (engrave.w - w)/2`
    - `y = engrave.y + (engrave.h - h)/2`

### 7.9 発行（Design ID + PDF）仕様
- 発行ボタンは `READY_TO_ISSUE` の時のみ有効
- 押下で以下を同期的に実行（途中でUIロック）
  1) Design ID生成
  2) ロゴ原本BlobをIndexedDBへ保存（`asset:logoOriginal:{designId}`）
  3) 編集後ロゴBlobをIndexedDBへ保存（`asset:logoEdited:{designId}`）
  4) PDF 2種生成（confirm/engrave）→ Blob保存（IndexedDB）
  5) Design JSONをlocalStorageへ保存（index更新含む）
  6) confirm PDF を自動ダウンロード（ブラウザ）
- 途中失敗時:
  - 生成したIndexedDBアセットを可能な範囲でロールバック（削除）
  - エラートースト表示
  - `READY_TO_ISSUE` に戻す（再試行可能）

---

## 8. Design ID仕様（厳密）

### 8.1 フォーマット
- `YYMMDD_XXXXXXXX`
- `XXXXXXXX`: 8文字、英大文字 + 数字（除外あり）

### 8.2 使用可能文字集合（固定）
- 数字: `2 3 4 5 6 7 8 9`
- 英大文字: `A B C D E F G H J K M N P Q R S T U V W X Y Z`
（除外: `0 1 I L O` と、紛らわしい小文字は使わない）

### 8.3 生成方法（固定）
- `crypto.getRandomValues` で乱数生成
- 既存IDと衝突したら再生成（最大10回、超えたらエラー）

---

## 9. PDF仕様（pdf-lib）

### 9.1 ページサイズ（固定）
- `template.pdf.pageSize = "A4"` の場合
  - portrait: 595.28pt × 841.89pt
  - landscape: 841.89pt × 595.28pt
- v1.1ではportrait固定でよい（templateに従う）

### 9.2 解像度（DPI）
- `template.pdf.dpi = 300` を採用
- 背景画像をPDFに埋め込む際、Canvas出力は **基準座標（canvasWidthPx/HeightPx）** と一致させる

### 9.3 confirm PDF（お客様用）
- 内容（順）
  1) 背景画像（全面）
  2) 刻印枠（ガイド枠）
  3) ロゴ（編集後、配置反映）
  4) Design ID（下部右寄せ・8pt相当）
- ガイド枠の見た目
  - 枠線: 1pt
  - 透明塗り: なし（または非常に薄い）

### 9.4 engrave PDF（管理者用）
- 内容（順）
  1) 白背景
  2) 刻印枠（任意・薄線）
  3) ロゴ（編集後、枠座標に反映）
  4) Design ID / templateKey / createdAt（10pt相当）
- 目的: 刻印担当が迷わず扱える「作業用」

### 9.5 座標変換（厳密）
- `scaleX = pageWidthPt / canvasWidthPx`
- `scaleY = pageHeightPt / canvasHeightPx`
- 変換:
  - `ptX = pxX * scaleX`
  - `ptY = pageHeightPt - (pxY + pxH) * scaleY`
    - PDF座標は左下原点のため、Y方向を反転して配置する
- ロゴ描画:
  - `drawImage(image, { x: ptX, y: ptY, width: pxW*scaleX, height: pxH*scaleY })`
- ガイド枠:
  - 同様に矩形描画

### 9.6 PDF保存/ダウンロード
- 生成後 `Blob` に変換し、IndexedDBへ保存
- `confirm` は自動ダウンロード
- `engrave` は保存のみ（管理画面から取得）でよい

---

## 10. 管理画面（/admin/templates）詳細仕様

### 10.1 一覧テーブル
表示列（固定）
- Template名（name）
- templateKey
- status（バッジ + セレクト）
- updatedAt
- 操作
  - 「スマホ表示」
  - 「削除」

### 10.2 新規登録（D&D）
- ドロップ領域に以下を同時投入できること
  - `template.json`（必須、1つ）
  - 背景画像（必須、1つ）
- ルール（固定）
  - `template.json.background.fileName` と一致するファイル名の画像を背景として採用
  - 一致しない場合はエラー（登録拒否）

### 10.3 バリデーション（固定）
- templateKey:
  - 必須、正規表現: `^[a-zA-Z0-9_-]{3,64}$`
  - 既存と重複禁止
- canvasWidthPx/HeightPx:
  - 200～5000 の整数
- engravingArea:
  - `x,y,w,h` は整数
  - `w>0,h>0`
  - 枠がキャンバス外に出ないこと（`x+w<=canvasWidthPx` 等）

### 10.4 ステータス操作
- 遷移制限なし（draft/tested/publishedを自由に変更）
- `published -> draft` のときは確認ダイアログ（警告文）を表示

### 10.5 スマホ表示ボタン
- クリックで `/sim/:templateKey` を新規ウィンドウで開く
- window features（目安）: `width=390,height=844`

### 10.6 テンプレ削除
- 削除対象:
  - localStorageのtemplateデータ
  - IndexedDBの背景アセット
- 参照されるDesignが存在する場合
  - v1.1では削除許可するが、警告表示
  - Design側は残す（templateKeyが参照切れになるので、design一覧で「テンプレなし」表示）

---

## 11. 管理画面（/admin/designs）詳細仕様

### 11.1 一覧テーブル
表示列（固定）
- designId
- templateKey（存在しない場合は「削除済みテンプレ」表示）
- createdAt
- PDF（確認用）: ダウンロード
- PDF（刻印用）: ダウンロード
- 操作: 削除

### 11.2 検索/絞り込み（v1.1）
- `designId` 部分一致検索（入力即時反映）
- `templateKey` セレクト（存在するテンプレのみ）

### 11.3 PDF再生成ルール
- IndexedDBにPDFが存在すればそれをダウンロード
- 存在しない場合は、Design情報 + template背景から再生成して保存 → ダウンロード

### 11.4 デザイン削除
- localStorageのDesign JSON削除
- designs:indexから除去
- IndexedDBアセット（logoOriginal/logoEdited/pdfConfirm/pdfEngrave）を削除

---

## 12. UI/UX仕様（Tailwind）

### 12.1 トーン
- シンプルで業務ツール寄り（装飾少なめ）
- 色は Tailwind標準（青/オレンジ/緑のアクセント程度）

### 12.2 コンポーネント要件
- Dropzone: クリック選択 + D&D、進捗表示（ファイル名/サイズ）
- Toast: 成功/失敗/警告
- Modal: トリミング用（Escで閉じる、フォーカストラップ）
- Button: disabled状態が明確
- Form: 入力はlabel付き

### 12.3 アクセシビリティ（最低限）
- ボタンに `aria-label`
- モーダルは開いたらフォーカス移動、閉じたら元に戻す
- キーボード操作は「閉じる」「発行」程度に対応（詳細なドラッグは対象外）

---

## 13. エラー仕様（必須実装）

### 13.1 エラー表示ルール
- 画面上部トースト + ステップ内にも短文表示（重複可）
- メッセージは「原因 + 次の行動」を含む

### 13.2 主なエラー
- テンプレなし/非公開
  - 「このページは現在ご利用いただけません（テンプレートが未公開です）。」
- 画像形式不正/容量超過
  - 「画像形式はPNG/JPEG/WEBP、5MB以内でお試しください。」
- IndexedDB保存失敗（容量）
  - 「保存容量が不足しています。不要なデザインを削除してください。」
- PDF生成失敗
  - 「PDFの生成に失敗しました。画像サイズを小さくして再度お試しください。」

---

## 14. 実装設計（ディレクトリ/主要関数）

### 14.1 推奨ディレクトリ
- `src/`
  - `app/`
    - `router.tsx`
    - `layout/AppLayout.tsx`（Header/Footer適用）
  - `pages/`
    - `sim/SimPage.tsx`
    - `admin/AdminTemplatesPage.tsx`
    - `admin/AdminDesignsPage.tsx`
  - `components/`
    - `common/Toast.tsx`
    - `common/Modal.tsx`
    - `common/Dropzone.tsx`
    - `sim/CropModal.tsx`
    - `sim/StageCanvas.tsx`
    - `sim/StepsPanel.tsx`
  - `domain/`
    - `types.ts`
    - `id/designId.ts`
    - `image/processLogo.ts`（透過/モノクロ）
    - `pdf/generateConfirmPdf.ts`
    - `pdf/generateEngravePdf.ts`
    - `storage/local.ts`
    - `storage/idb.ts`

### 14.2 主要関数（必須）
- `validateTemplate(json): {ok:boolean, errors:string[]}`
- `saveTemplate(template, bgBlob)`
- `listTemplates(): TemplateSummary[]`
- `generateDesignId(): string`
- `processLogo(imageBitmap, crop, transparentLevel, monochrome): Blob`
- `clampPlacement(placement, engravingArea): placement`
- `generateConfirmPdf(template, bgBlob, logoBlob, placement, designId): Blob`
- `generateEngravePdf(template, logoBlob, placement, meta): Blob`
- `saveDesign(design, assets)`
- `listDesigns(): DesignSummary[]`

---

## 15. テスト観点（手動）

### 15.1 テンプレ登録
- 正常: template.json + bg.png をD&D → 一覧に表示
- 異常: bgファイル名が一致しない → 登録拒否
- 異常: engravingAreaがキャンバス外 → 登録拒否

### 15.2 お客様フロー
- 5MB超 → 受付不可
- トリミング後、透過weak/medium/strongの見え方が変わる
- ロゴを枠外へドラッグ → 自動で枠内に戻る
- ロゴを枠より大きく拡大 → 自動縮小して枠内に収まる
- 発行 → confirm PDFがDLされ、/admin/designsに履歴が出る
- リロード → 履歴が残る、再DLできる

### 15.3 容量不足
- IndexedDB保存失敗を擬似的に起こし（大量保存）、エラーメッセージが出る
- 不完全なデザインが残らない（途中失敗時にロールバック）

---

## 16. 付録：最小テンプレサンプル
`template.json`
```json
{
  "templateKey": "sample_a4_rightbottom_v1",
  "name": "サンプルA4（右下）",
  "status": "draft",
  "updatedAt": "2026-01-09T00:00:00.000+09:00",
  "background": { "fileName": "bg.png", "canvasWidthPx": 1200, "canvasHeightPx": 1600 },
  "engravingArea": { "label": "刻印枠", "x": 820, "y": 1220, "w": 280, "h": 180 },
  "placementRules": { "allowRotate": false, "keepInsideEngravingArea": true, "minScale": 0.1, "maxScale": 6.0 },
  "pdf": { "pageSize": "A4", "orientation": "portrait", "dpi": 300 }
}
```
