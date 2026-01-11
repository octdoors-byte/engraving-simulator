# 🛠 高精度・ローカル完結型 刻印デザインシミュレーター（完全版・最終仕様書）
spec_id: engraving-simulator-local-final-v1.2  
対象: **ローカル環境（Vite + React + TypeScript + Tailwind）で確実に動くMVP**（サーバー/課金/認証なし）  
更新日: 2026-01-09  
方針: **「MVPの確実性」＋「後戻りしにくい高精度要素（Dexie/比率座標/mm変換/オフスクリーン高解像度）」を先に採用**

---

## 0. 実装者向けの約束（重要）
- 本書に**記載された仕様のみ**を実装する（推測の拡張は禁止）。
- 迷ったら「**v1.2ではやらない**」を優先し、TODOコメントで将来拡張候補として残す。
- ブラウザ完結（localStorage / IndexedDB）ゆえ、**容量不足・破損・部分失敗**に対するハンドリングを必須とする。

---

## 1. 目的（何を解決するツールか）
- お客様が **刻印用ロゴ画像**を取り込み、
  - トリミング
  - 背景透過（Tolerance調整）
  - モノクロ二値化（刻印向け）
  - 刻印可能範囲（枠）内への配置（ドラッグ＆拡大縮小）
  - **確認用PDF**の発行
  - **デザインID**の生成
  を、**ブラウザだけで完結**して行う。
- 管理者がテンプレート（台紙）を登録し、発行履歴を確認し、**刻印作業用PDF**を再取得できる。

---

## 2. Done Definition（成功条件）
以下がすべて成立したらDone。

### 2.1 開発/起動
- `npm install` → `npm run dev` でローカル起動できる
- ルーティングで以下URLが表示される
  - `/sim/:templateKey`
  - `/admin/templates`
  - `/admin/designs`

### 2.2 管理：テンプレ登録・管理
- `/admin/templates` で `template.json` と背景画像（PNG/WebP/JPEG）を **同時D&D** で登録できる
- テンプレのステータスを `draft/tested/published` で切り替え可能
- `published` 以外のテンプレは `/sim/:templateKey` で**利用不可**（明確なエラー画面）
- テンプレ背景に対して、管理画面で**刻印枠（矩形）をドラッグ指定**できる（比率座標で保存）

### 2.3 お客様：一連フロー（必須）
- `/sim/:templateKey` で、次が一連で成立する
  1) ロゴアップロード（PNG/JPEG/WEBP、5MB以内）
  2) トリミング（任意範囲）
  3) 背景透過（弱/中/強 + 連続スライダーTolerance）
  4) モノクロ二値化（ON/OFF）
  5) 刻印枠内に配置（ドラッグ/拡大縮小、枠外不可）
  6) Design ID 発行 → **確認用PDF（Type A）** を自動DL

### 2.4 管理：履歴・再DL（必須）
- `/admin/designs` に発行履歴が永続化される（リロード後も残る）
- 履歴から **確認用PDF（Type A）** と **刻印用PDF（Type B）** を再ダウンロードできる
- PDFがIndexedDBに存在しない場合は、データから再生成して保存→DLできる

---

## 3. 非目標（v1.2では実装しない）
- 認証、課金、サーバー保存、メール送信
- 外部API（切り抜きAI等）
- 複数画像配置、テキスト刻印
- 回転（rotation）
- ベクタ化、CMYK変換、印刷所向け特殊色対応
- PWA（オフラインキャッシュ）※付録で将来対応案のみ

---

## 4. 技術スタック（固定）
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router v6
- PDF生成: `pdf-lib`
- 画像処理: Canvas API（2D）
- 永続化:
  - 設定（小さなJSON）: localStorage
  - 画像/PDF（Blob）: IndexedDB（**Dexie.js採用**）
- 状態管理: React Context + hooks（外部Stateライブラリは不要）

---

## 5. 画面/URL/権限
| 区分 | URL | ページ | アクセス |
|---|---|---|---|
| お客様 | `/sim/:templateKey` | シミュレーター | template.status が `tested` または `published` |
| 管理 | `/admin/templates` | テンプレ管理 | 常に可（ローカル運用） |
| 管理 | `/admin/designs` | デザイン履歴 | 常に可（ローカル運用） |

> v1.2では管理画面の認証は行わない。

---

## 6. 永続化設計（localStorage / IndexedDB）

### 6.1 localStorage キー（固定）
- `ksim:appVersion` … `"1.2.0"`
- `ksim:commonSettings` … 共通ヘッダー/フッター設定（JSON）
- `ksim:uiSettings` … UI状態（折りたたみなど軽微なもの）

> テンプレ一覧・デザイン一覧は **IndexedDB側のindex** を正とする（localStorageに重複保存しない）。

### 6.2 IndexedDB（Dexie.js）
#### 6.2.1 DB名/バージョン（固定）
- DB名: `ksim_db`
- version: `1`

#### 6.2.2 テーブル（Dexie）
- `templates`
- `designs`
- `assets`

#### 6.2.3 スキーマ（Dexie定義）
- templates: `id, key, status, updatedAt`
- designs: `designId, templateId, templateKey, createdAt`
- assets: `id, type, refId, createdAt`

※補足  
- 検索や一覧表示に必要な索引だけを貼る（Blob自体は各テーブル内に保持してよいが、v1.2は **assetsにBlobを集約** する）。

---

## 7. データモデル（厳密）

### 7.1 Template（台紙）
#### 7.1.1 Templateレコード（IndexedDB/templates）
```json
{
  "id": "uuid-v4",
  "key": "certificate-a4-rightbottom-v1",
  "name": "証書カバーA4（右下刻印）",
  "status": "draft",
  "updatedAt": "2026-01-09T10:00:00.000+09:00",
  "dpi": 300,
  "baseImageAssetId": "asset:templateBg:certificate-a4-rightbottom-v1",
  "canvas": {
    "widthPx": 1200,
    "heightPx": 1600
  },
  "engravingAreaRatio": {
    "x": 0.68,
    "y": 0.76,
    "w": 0.23,
    "h": 0.12
  },
  "rules": {
    "keepInsideEngravingArea": true,
    "allowRotate": false,
    "minLogoSizePx": 10
  },
  "pdf": {
    "pageSize": "A4",
    "orientation": "portrait",
    "typeA": {
      "showEngravingGuide": true,
      "showHeaderFooter": true
    },
    "typeB": {
      "showEngravingGuide": true,
      "showMetaText": true,
      "units": "mm"
    }
  }
}
```

#### 7.1.2 engravingAreaRatio（比率座標の定義）
- 背景画像の**表示基準キャンバス（canvas.widthPx/heightPx）**に対する比率（0.0〜1.0）
- 実座標px変換:
  - `xPx = ratio.x * canvas.widthPx`
  - `yPx = ratio.y * canvas.heightPx`
  - `wPx = ratio.w * canvas.widthPx`
  - `hPx = ratio.h * canvas.heightPx`

> **比率保存**により、将来 canvasサイズを変えても刻印枠が崩れない。

### 7.2 Design（お客様が発行したデザイン）
#### 7.2.1 Designレコード（IndexedDB/designs）
```json
{
  "designId": "260109_K7M3Q9XR",
  "templateId": "uuid-v4",
  "templateKey": "certificate-a4-rightbottom-v1",
  "createdAt": "2026-01-09T10:12:34.000+09:00",
  "logoOriginalAssetId": "asset:logoOriginal:260109_K7M3Q9XR",
  "logoProcessedAssetId": "asset:logoProcessed:260109_K7M3Q9XR",
  "processParams": {
    "crop": { "x": 0.12, "y": 0.08, "w": 0.76, "h": 0.81 },
    "bgTransparent": { "enabled": true, "tolerance": 40 },
    "mono": { "enabled": true, "threshold": 128 }
  },
  "placementPx": {
    "x": 860,
    "y": 1260,
    "w": 180,
    "h": 90
  },
  "pdf": {
    "typeAAssetId": "asset:pdfA:260109_K7M3Q9XR",
    "typeBAssetId": "asset:pdfB:260109_K7M3Q9XR"
  }
}
```

### 7.3 Asset（Blob保管）
#### 7.3.1 Assetレコード（IndexedDB/assets）
```json
{
  "id": "asset:pdfA:260109_K7M3Q9XR",
  "type": "pdfA",
  "refId": "260109_K7M3Q9XR",
  "mimeType": "application/pdf",
  "blob": "<Blob>",
  "createdAt": "2026-01-09T10:12:40.000+09:00"
}
```

#### 7.3.2 Assetのtype一覧（固定）
- `templateBg`
- `logoOriginal`
- `logoProcessed`
- `pdfA`（確認用）
- `pdfB`（刻印用）
- `commonLogo`（共通ヘッダー用ロゴ）※v1.2でIndexedDBに入れる（localStorageにBase64は使わない）

#### 7.3.3 Asset ID命名規則（固定）
- 背景: `asset:templateBg:{templateKey}`
- ロゴ原本: `asset:logoOriginal:{designId}`
- ロゴ加工済: `asset:logoProcessed:{designId}`
- PDF A: `asset:pdfA:{designId}`
- PDF B: `asset:pdfB:{designId}`
- 共通ロゴ: `asset:commonLogo:global`

---

## 8. 座標系のルール（最重要）

### 8.1 基準座標（px）
- `template.canvas.widthPx/heightPx` を **基準座標系（px）** とする
- `engravingAreaRatio` は比率
- `placementPx` は **必ず基準座標（px）**で保存する

### 8.2 画面表示（レスポンシブ）
- 表示用キャンバスは可変サイズ（CSS）
- 描画時に `viewScale` を計算
  - `viewScale = min(viewW / canvas.widthPx, viewH / canvas.heightPx)`
- 表示座標は `displayPx = basePx * viewScale`

---

## 9. 共通ヘッダー/フッター（全ページ）
### 9.1 設定UI配置
- `/admin/templates` の最上部に「共通ヘッダー/フッター設定」を表示
- 以後、全ページ（Sim/管理）で同一表示

### 9.2 設定項目（固定）
- `logoAssetId`（任意）: `asset:commonLogo:global`
- `headerText`（任意）: 説明文（1〜2行）
- `footerText`（任意）: フッター文言
- `logoAlign`: `left|center|right`
- `headerTextAlign`: `left|center|right`
- `footerTextAlign`: `left|center|right`
- `logoSize`: `sm|md|lg`
- `headerTextSize`: `sm|md|lg`
- `footerTextSize`: `sm|md|lg`

### 9.3 保存ルール
- テキスト設定は localStorage（`ksim:commonSettings`）
- ロゴ画像は IndexedDB/assets に Blob保存（type=`commonLogo`）
- 入力はデバウンス300msで自動保存（保存失敗時はトーストで通知）

---

## 10. お客様画面（/sim/:templateKey）詳細仕様

### 10.1 レイアウト
#### PC
- 左：操作パネル（360〜420px）
- 右：プレビュー（背景+刻印枠+ロゴ）
- 発行ボタンは操作パネル末尾に固定

#### スマホ
- 1カラム縦積み（上：プレビュー / 下：操作）
- トリミングモーダルは高さ `max-h-[80vh]` を守る
- 主要操作ボタン（適用/戻る）は常に表示される

### 10.2 ステップ（アコーディオン形式）
- Step 1: ロゴ読込
- Step 2: 加工（トリミング / 背景透過 / 二値化）
- Step 3: 配置調整
- Step 4: 発行（確認PDF）

### 10.3 状態機械（simState）
`simState` は以下のいずれか（固定）
- `EMPTY`
- `UPLOADED`
- `EDITING`
- `PLACEMENT`
- `READY_TO_ISSUE`
- `ISSUING`
- `ISSUED`
- `ERROR`（致命的。原則復帰不能だが「リセット」で`EMPTY`へ戻せる）

遷移（固定）
- `EMPTY -> UPLOADED`（ファイル読込成功）
- `UPLOADED -> EDITING`（自動）
- `EDITING -> PLACEMENT`（「配置へ」）
- `PLACEMENT -> READY_TO_ISSUE`（ロゴが枠内に収まっている）
- `READY_TO_ISSUE -> ISSUING`（発行押下）
- `ISSUING -> ISSUED`（成功）
- 失敗時は `ERROR` ではなく、可能なら直前状態に戻して再試行可能にする（IndexedDB容量不足など）

### 10.4 ロゴ入力仕様
- 対応: PNG/JPEG/WEBP
- サイズ: 5MB以内（5,242,880 bytes）
- 取り込み:
  - `File` をそのままBlobで IndexedDB（logoOriginal）に保存する（発行時）
  - 編集中は `createImageBitmap(file)` を利用して描画する

### 10.5 トリミング
- 実装: `react-easy-crop` 採用（ローカルにバンドル）
- 保存するcrop: **正規化座標（0〜1）**
  - `crop = {x,y,w,h}`（元画像に対する比率）
- トリミングの出力は Canvasで切り出したBitmapを次工程に渡す

### 10.6 背景透過（Tolerance）
#### 10.6.1 背景色推定（固定）
- トリミング後画像の四隅4点をサンプルし平均RGBを `bgColor` とする

#### 10.6.2 透過判定（固定）
- 各ピクセルで距離 `d` を計算
  - `d = sqrt((r-bgR)^2 + (g-bgG)^2 + (b-bgB)^2)`
- `d < tolerance` の場合 `alpha = 0`

#### 10.6.3 tolerance UI
- スライダー: 0〜96（整数）
- 推奨プリセット（ボタン）
  - 弱: 24
  - 中: 40
  - 強: 64

#### 10.6.4 境界の滑らか化（固定）
- `d` が `tolerance〜tolerance+12` の範囲は線形補間でalphaを残す（ギザギザ軽減）

### 10.7 モノクロ二値化（刻印向け）
- 有効時、RGB→輝度へ変換後、二値化する
  - `Y = 0.299R + 0.587G + 0.114B`
- threshold:
  - スライダー: 0〜255（整数）
  - 初期値: 128
- `Y >= threshold` → 白（255）
- `Y < threshold` → 黒（0）
- Alphaは保持する（透過済み領域は透過のまま）

### 10.8 配置（ドラッグ＆拡大縮小）
#### 10.8.1 操作
- 移動: Pointer Eventsでドラッグ
- リサイズ: **右下ハンドルのみ**（v1.2固定）
- 縦横比固定（ロゴ画像比）
- 最小サイズ:
  - `rules.minLogoSizePx`（初期10px）以上
- 回転は実装しない

#### 10.8.2 枠内制約（固定：クランプ）
- `keepInsideEngravingArea=true` の場合、ロゴ矩形が枠外へ出ない
- 計算:
  - `x` は `[engraveX, engraveX + engraveW - logoW]`
  - `y` は `[engraveY, engraveY + engraveH - logoH]`
- リサイズ時も同様にクランプ
- もし `logoW > engraveW` または `logoH > engraveH` になった場合、**自動縮小して枠内へ収める**

#### 10.8.3 初期配置（固定）
- 編集完了後、最初の配置は「枠の90%に収まる最大サイズ」で中央配置
  - `scale = min((engraveW*0.9)/logoW, (engraveH*0.9)/logoH)`
  - `w = logoW*scale`, `h = logoH*scale`
  - `x = engraveX + (engraveW - w)/2`
  - `y = engraveY + (engraveH - h)/2`

---

## 11. Design ID 仕様（厳密）

### 11.1 フォーマット
- `YYMMDD_XXXXXXXX`（例: `260109_K7M3Q9XR`）

### 11.2 文字集合（固定）
- 数字: `2 3 4 5 6 7 8 9`
- 英大文字: `A B C D E F G H J K M N P Q R S T U V W X Y Z`
- 除外: `0 1 I L O`（視認性のため）

### 11.3 生成方法（固定）
- `crypto.getRandomValues` を利用
- 既存designIdと衝突した場合は再生成（最大10回、超えたらエラー）

---

## 12. PDF仕様（pdf-lib）

### 12.1 重要方針（高精度要素）
- UI表示キャンバスとは別に、**PDF生成専用のオフスクリーンCanvas**を使用する
- これにより、UIが小さくても出力が荒れにくい

### 12.2 オフスクリーンCanvasのサイズ（固定）
- `template.canvas.widthPx/heightPx` を基準とする
- ただし、`template.dpi=300` と `template.pdf.pageSize` がA4の場合、推奨は以下（任意）
  - 縦: 3508px、横: 2480px（A4 300dpi）
- v1.2では **テンプレ登録時に canvasサイズを指定**する方式とし、A4固定の自動計算は行わない

### 12.3 Type A（お客様確認用）
内容（順）
1) 背景画像（全面）
2) 刻印枠（ガイド枠：表示）
3) ロゴ（加工済 + 配置反映）
4) ヘッダー/フッター（共通設定があれば表示）
5) Design ID（右下、8pt相当）

### 12.4 Type B（管理者刻印用：mm座標を明確化）
内容（順）
1) 白背景（背景画像なし）
2) 刻印枠（薄線・任意、v1.2では表示する）
3) ロゴ（加工済 + 配置反映）
4) メタ情報（Design ID / templateKey / createdAt）
5) **刻印座標（mm）**を記載（必須）

#### 12.4.1 px→mm変換（固定）
- `mm = px * (25.4 / dpi)`
- 変換対象:
  - ロゴ矩形（x,y,w,h）
  - 刻印枠（x,y,w,h）
- 記載するmmは小数第1位まで（四捨五入）

#### 12.4.2 mmの原点（固定）
- 原点は **テンプレ基準キャンバスの左上**（UIと同じ）
- PDF描画は左下原点のため、描画時はY反転する（後述）
- 表示テキストとしてのmmは「左上原点」で表記する（作業者が理解しやすい）

### 12.5 PDF座標変換（厳密）
- PDFページ（pt）と基準キャンバス（px）の対応
  - `scaleX = pageWidthPt / canvasWidthPx`
  - `scaleY = pageHeightPt / canvasHeightPx`
- 変換:
  - `ptX = pxX * scaleX`
  - `ptY = pageHeightPt - (pxY + pxH) * scaleY`
    - PDFは左下原点のため、Yを反転して「矩形の下端」を基準に置く
- ロゴ描画:
  - `drawImage(img, { x: ptX, y: ptY, width: pxW*scaleX, height: pxH*scaleY })`
- 枠描画も同様

### 12.6 PDF保存/ダウンロード（固定）
- 生成したPDFはBlob化し、IndexedDB/assetsへ保存
- 発行直後は Type A を自動ダウンロード
- Type B は保存のみ（管理画面でDL）

---

## 13. 管理画面：テンプレ管理（/admin/templates）

### 13.1 一覧テーブル（表示列固定）
- name
- key
- status（バッジ + セレクト）
- updatedAt
- 操作:
  - プレビュー（/sim/:key を別ウィンドウで開く）
  - 編集（刻印枠設定）
  - 削除

### 13.2 新規登録（D&D）
- ドロップ領域に以下を同時投入
  - `template.json`（必須1つ）
  - 背景画像（必須1つ）

#### 13.2.1 template.jsonの最小仕様（v1.2固定）
```json
{
  "key": "certificate-a4-rightbottom-v1",
  "name": "証書カバーA4（右下刻印）",
  "dpi": 300,
  "canvas": { "widthPx": 1200, "heightPx": 1600 },
  "status": "draft"
}
```

#### 13.2.2 登録ルール（固定）
- keyはURLに使用するため、正規表現に合致必須（後述）
- 背景画像は `assets` に `asset:templateBg:{key}` で保存
- templateレコードには `baseImageAssetId` を保存
- `engravingAreaRatio` は登録時点では `null` でもよい（ただし公開には必要）

### 13.3 刻印枠（矩形）指定ツール（必須）
- テンプレ編集モーダル/ページで、背景画像プレビュー上に矩形をドラッグ作成
- 作成した矩形を移動・リサイズできる（角ハンドル）
- 保存時は **比率座標**として `engravingAreaRatio` に保存
- 0〜1の範囲にクランプして保存する

### 13.4 バリデーション（固定）
- `key`:
  - 必須
  - `^[a-z0-9][a-z0-9_-]{2,63}$`（3〜64文字、先頭は英小文字/数字）
  - 重複禁止
- `dpi`: 72〜600（整数）
- `canvas.widthPx/heightPx`: 200〜6000（整数）
- `engravingAreaRatio`（保存時に必須チェック）
  - `x,y,w,h` すべて 0〜1
  - `w>0,h>0`
  - `x+w<=1`、`y+h<=1`

### 13.5 ステータス運用（固定）
- `draft`: 作成中（お客様利用不可）
- `tested`: テスト済（お客様利用可）
- `published`: 公開中（お客様利用可）
- `draft` のまま `tested/published` に変更する際、以下を満たさない場合は拒否
  - 背景画像が存在
  - engravingAreaRatioが存在

### 13.6 プレビュー（スマホ想定）
- 「プレビュー」ボタンは `/sim/:key` を新規ウィンドウで開く
- 目安: `width=390,height=844`

### 13.7 削除（固定）
- テンプレ削除時に削除するもの
  - templatesレコード
  - 背景asset（templateBg）
- ただし designsは削除しない（履歴保全）
  - design一覧でテンプレ欠損を「削除済みテンプレ」と表示する

---

## 14. 管理画面：デザイン履歴（/admin/designs）

### 14.1 一覧テーブル（表示列固定）
- designId
- templateKey（欠損時は「削除済みテンプレ」）
- createdAt
- PDF（Type A）ダウンロード
- PDF（Type B）ダウンロード
- 操作（削除）

### 14.2 検索/絞り込み（v1.2固定）
- designId 部分一致検索（即時反映）
- templateKey セレクト（存在するテンプレのみ）

### 14.3 PDF再生成ルール（固定）
- assetsにPDFが存在 → そのBlobでDL
- 存在しない → 以下で再生成し保存してDL
  - template（背景）＋ design（logoProcessed + placementPx）

### 14.4 デザイン削除（固定）
- designsレコード削除
- assets削除:
  - logoOriginal / logoProcessed / pdfA / pdfB

---

## 15. 発行処理（トランザクション的手順）
発行ボタン押下時に以下を順に行う（固定）。途中失敗時はロールバックを行う。

1) `designId` 生成  
2) `logoOriginal` Blob を assets に保存  
3) 加工済ロゴ（logoProcessed）Blob を assets に保存  
4) PDF Type A 生成 → assetsへ保存  
5) PDF Type B 生成 → assetsへ保存  
6) designs レコード保存（参照assetIdを保持）  
7) Type A を自動ダウンロード  
8) simState を `ISSUED`

ロールバック（失敗時）
- 保存済みassetを可能な限り削除し、designレコードは作らない
- エラーをトースト表示し、`READY_TO_ISSUE` に戻す（再試行可能）

---

## 16. エラー/メッセージ仕様（必須）
### 16.1 表示ルール
- 画面上部トースト（成功/警告/失敗）
- 操作パネル内にも短文で補足（必要時）
- 文面は「原因 + 次の行動」を含む

### 16.2 代表エラー（固定文例）
- テンプレ未公開:
  - 「このページは現在ご利用いただけません（テンプレートが未公開です）。」
- 画像形式/容量:
  - 「画像はPNG/JPEG/WEBP、5MB以内でお試しください。」
- 保存容量不足（IndexedDB）:
  - 「保存容量が不足しています。不要なデザインを削除してください。」
- PDF生成失敗:
  - 「PDFの生成に失敗しました。画像サイズを小さくして再度お試しください。」

---

## 17. UI仕様（Tailwind）
### 17.1 トーン
- 業務ツール寄り、装飾は最小
- Tailwind標準のニュートラル + アクセント（青/緑/橙）程度

### 17.2 必須コンポーネント
- Dropzone（クリック選択 + D&D、ファイル名/サイズ表示）
- Toast（成功/警告/失敗）
- Modal（トリミング / テンプレ枠編集）
- Canvasステージ（背景・枠・ロゴ・ハンドル表示）
- Form（label付き）

### 17.3 アクセシビリティ最低限
- ボタンに `aria-label`
- モーダルはフォーカストラップ、Escで閉じる
- 主要ボタンはTab移動可能

---

## 18. 実装設計（ディレクトリ/主要モジュール）

### 18.1 推奨ディレクトリ構成
- `src/`
  - `app/`
    - `router.tsx`
    - `layout/AppLayout.tsx`（Header/Footer + Outlet）
  - `pages/`
    - `sim/SimPage.tsx`
    - `admin/AdminTemplatesPage.tsx`
    - `admin/AdminDesignsPage.tsx`
  - `components/`
    - `common/Toast.tsx`
    - `common/Modal.tsx`
    - `common/Dropzone.tsx`
    - `common/Header.tsx`
    - `common/Footer.tsx`
    - `sim/CropModal.tsx`
    - `sim/StepsPanel.tsx`
    - `sim/StageCanvas.tsx`
    - `admin/TemplateEditor.tsx`（刻印枠編集）
  - `domain/`
    - `types.ts`
    - `id/designId.ts`
    - `image/`
      - `crop.ts`
      - `transparent.ts`
      - `monochrome.ts`
      - `processLogo.ts`（統合）
    - `pdf/`
      - `generatePdfA.ts`
      - `generatePdfB.ts`
      - `coord.ts`
    - `storage/`
      - `db.ts`（Dexie初期化）
      - `assets.ts`
      - `templates.ts`
      - `designs.ts`

### 18.2 主要関数（必須）
- `validateTemplateDraft(input): { ok: boolean; errors: string[] }`
- `saveTemplateWithBg(templateDraft, bgBlob): Promise<Template>`
- `updateTemplateEngravingArea(key, engravingAreaRatio): Promise<void>`
- `listTemplates(): Promise<Template[]>`
- `generateDesignId(): string`
- `processLogo(params): Promise<Blob>`（crop→透過→二値化）
- `clampPlacement(placementPx, engravingAreaPx): placementPx`
- `generatePdfA(args): Promise<Blob>`
- `generatePdfB(args): Promise<Blob>`
- `saveDesignAndAssets(args): Promise<void>`（発行手順の統合）
- `listDesigns(): Promise<Design[]>`
- `downloadBlob(blob, filename): void`

---

## 19. 手動テスト項目（最低限）

### 19.1 テンプレ登録/枠編集
- template.json + 背景画像D&D → 追加される
- 枠をドラッグ作成→保存→再読込して残る
- 枠なしでtested/publishedにできない

### 19.2 お客様フロー
- 5MB超で拒否される
- tolerance/thresholdで見た目が変わる
- ロゴを枠外に動かせない（常に枠内へクランプ）
- 発行→PDF A が自動DL→履歴に残る

### 19.3 管理履歴
- PDF A/B が再DLできる
- PDFが欠損した場合、再生成してDLできる

### 19.4 容量不足
- 大量保存してIndexedDBが失敗 → 明確なエラー表示
- 途中失敗でゴミデータ（半端なdesign）が残らない

---

## 20. 付録A：テンプレサンプル（配布用）
`template.json`
```json
{
  "key": "sample-a4-rightbottom-v1",
  "name": "サンプルA4（右下刻印）",
  "dpi": 300,
  "canvas": { "widthPx": 1200, "heightPx": 1600 },
  "status": "draft"
}
```

---

## 21. 付録B：PWA（将来対応）※v1.2では実装しない
- 目的: オフラインでもURLアクセス時に確実に動作させる
- 方針:
  - 外部CDNは使わず、全依存はnode_modulesからバンドル
  - ViteのPWAプラグインで `assets` をキャッシュ
- 注意:
  - IndexedDBのデータそのものはキャッシュ対象ではない（ブラウザ領域）
  - PWAは「読み込み安定化」であり「データ永続の保証」ではない

---

## 22. 実装フェーズ（タスクリスト）
- [ ] Phase 1: 基盤構築（Vite + React + TS + Tailwind + Router + Dexie）
- [ ] Phase 2: 画像加工コア（crop + tolerance透過 + 二値化）
- [ ] Phase 3: 配置シミュレーター（枠内制約 + ハンドル）
- [ ] Phase 4: PDFエンジン（pdf-lib + オフスクリーンCanvas + Type A/B）
- [ ] Phase 5: 管理機能（テンプレD&D + 枠指定 + 履歴/再DL/削除）

---

# 最終注意
- v1.2は「ロゴ1点」「枠内配置」「PDF2種」「履歴管理」を最小確実セットとして固定する。
- Fabric.jsや回転などの拡張は、v1.2の安定稼働後に別バージョンで行う。
