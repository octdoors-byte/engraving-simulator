# デザインシミュレーター 最終仕様書
spec_id: engraving-simulator-local-final-v1.2
対象: ローカル環境 (Vite + React + TypeScript + Tailwind)
更新日: 2026-01-09
方針: MVPの確実性 + 高精度要素（座標・PDF）
## 0. 実装ルール
- 仕様書に書かれている内容だけ実装する
- 迷ったら v1.2 は最小構成を優先する
- localStorage / IndexedDB の容量不足や破損はエラーで案内する

---
## 1. 目的
- ロゴを読み込み、トリミング・背景透過・配置を行う
- 枠内に配置した結果を確認用PDFとして発行する
- デザインIDを発行して履歴に残す
- 管理画面でテンプレート登録と履歴確認を行う

### 1.5 刻印特化（目的・非目的・制約）
#### 1.5.1 位置づけ（Purpose / Non-Purpose）
**Purpose（本ツールが解決すること）**
- 刻印工程に投入する前の「位置確認・確定（合意形成）」を行う
- 支給ロゴを刻印可能範囲内で位置・サイズ調整し、確定データ（PNG/PDF + 位置情報）を発行する
- 位置確認・サイズ確認・確認画像送付の往復を減らす

**Non-Purpose（本ツールがやらないこと）**
- デザイン生成（AI生成含む）
- デザイン提案・自動レイアウト
- 色変更、装飾（影・縁・フィルタ等）
- 入稿用データ作成（Illustrator形式必須の工程）
- カラーバリエーションの厳密再現（表示は参考）

#### 1.5.2 入力データの前提
- お客様は支給データ（ロゴ原稿・設計図・画像）を持っている前提
- 支給データの作成自体は責務外

#### 1.5.3 刻印工程の制約
- 刻印可能範囲を表示し、範囲外への配置はエラーにする
- 出力は「制作指示として再現可能」であることを優先する
- 確定操作を必須にし、確定前後で状態を分離する

#### 1.5.4 表示の扱い（色の注意）
- 画面表示は参考であり、色味の厳密再現は行わない

#### 1.5.5 成功条件
- お客様が配置を確定でき、追加のメール確認なしで制作工程に進められること
- 出力画像（PNG）と必要に応じてPDF、位置・サイズ情報、参照IDが取得できること

#### 1.5.6 呼称の推奨
- 刻印配置確認ツール
- 刻印前確認シミュレーター
- ロゴ配置確定ツール

---
## 2. Done Definition（成功条件）
### 2.1 起動
- `npm install` → `npm run dev` で起動できる
- `/top`, `/sim/:templateKey`, `/admin/templates`, `/admin/designs` にアクセスできる

### 2.2 テンプレ登録
- template.json + 背景画像を同時に登録できる
- 状態は draft/tested/published を切り替えられる
- 公開前テンプレは /sim で利用不可

### 2.3 お客様フロー
- ロゴ読込 → トリミング → 背景透過 → 配置 → PDF発行 が一連で完了する

### 2.4 履歴
- 発行履歴が残り、PDFを再ダウンロードできる

---
## 3. 非目標
- 認証、課金、サーバ保存、メール送信
- 外部API、AI切り抜き
- テキスト刻印、回転、CMYK変換
- PWAは範囲外

---
## 4. 技術スタック
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router v6
- PDF生成: pdf-lib
- 画像処理: Canvas API
- 永続化: localStorage / IndexedDB

---
## 5. 画面とURL
- `/top` : トップ
- `/sim/:templateKey` : シミュレーター（tested/published のみ）
- `/admin/templates` : テンプレート管理
- `/admin/designs` : デザイン発行履歴

---
## 6. 永続化
### 6.1 localStorage
- `ksim:appVersion` : "1.1.0"
- `ksim:commonSettings` : 共通ヘッダー/フッター設定
- `ksim:templates:index` : テンプレ一覧
- `ksim:template:{templateKey}` : テンプレ詳細
- `ksim:designs:index` : デザイン一覧
- `ksim:design:{designId}` : デザイン詳細
- `ksim:templateBgFallback:{templateKey}` : 背景画像のフォールバック

### 6.2 IndexedDB
- DB名: ksim_db
- version: 11
- stores: assets / backups

---
## 7. データモデル
### 7.1 Template（台紙）
#### 7.1.1 Templateレコード（IndexedDB/templates）
```json
{
  "id": "uuid-v4",
  "templateKey": "certificate_cover_a4_v1",
  "name": "証書カバー A4 右下刻印",
  "status": "draft",
  "updatedAt": "2026-01-09T10:00:00.000+09:00",
  "background": {
    "fileName": "certificate-cover-a4.png",
    "canvasWidthPx": 1200,
    "canvasHeightPx": 1600
  },
  "engravingArea": {
    "label": "右下刻印枠",
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
  "logoSettings": {
    "monochrome": false
  },
  "pdf": {
    "pageSize": "A4",
    "orientation": "portrait",
    "dpi": 300
  }
}
```

#### 7.1.2 engravingArea（px座標）
- engravingArea は background.canvasWidthPx/HeightPx に対するピクセル座標
- x,y,w,h は整数で指定する

### 7.2 Design（お客様が発行したデザイン）
#### 7.2.1 Designレコード（IndexedDB/designs）
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
    "transparentColor": { "r": 255, "g": 255, "b": 255 },
    "monochrome": false
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

### 7.3 Asset（Blob保管）
#### 7.3.1 Assetレコード（IndexedDB/assets）
```json
{
  "id": "asset:pdfConfirm:260109_K7M3Q9XR",
  "type": "pdfConfirm",
  "refId": "260109_K7M3Q9XR",
  "mimeType": "application/pdf",
  "blob": "<Blob>",
  "createdAt": "2026-01-09T10:12:40.000+09:00"
}
```

#### 7.3.2 Assetのtype一覧
- `templateBg`
- `logoOriginal`
- `logoEdited`
- `pdfConfirm`
- `pdfEngrave`

#### 7.3.3 Asset ID命名規則
- 背景: `asset:templateBg:{templateKey}`
- ロゴ原本: `asset:logoOriginal:{designId}`
- ロゴ加工: `asset:logoEdited:{designId}`
- PDF確認用: `asset:pdfConfirm:{designId}`
- PDF刻印用: `asset:pdfEngrave:{designId}`

---

## 8. 座標系のルール
### 8.1 基準座標
- template.background.canvasWidthPx/HeightPx を基準座標系とする
- engravingArea（px）はピクセル座標
- placement は基準座標で保存する

### 8.2 画面表示（レスポンシブ）
- viewScale = min(viewW / background.canvasWidthPx, viewH / background.canvasHeightPx)
- 表示座標: displayPx = basePx * viewScale

---

## 9. 共通ヘッダー/フッター
### 9.1 設定UI配置
- /admin/templates の最上部に設定パネルを表示
- sim/管理画面で共通表示

### 9.2 設定項目
- logoImage: 任意
- headerText: 任意
- footerText: 任意
- logoAlign / headerTextAlign / footerTextAlign
- logoSize / headerTextSize / footerTextSize

### 9.3 保存ルール
- 設定は localStorage（`ksim:commonSettings`）に保存
- ロゴ画像は localStorage に dataURL で保存

---

## 10. お客様画面（/sim/:templateKey）
### 10.1 レイアウト
#### PC
- 左: 操作パネル
- 右: プレビュー（背景 + 刻印枠 + ロゴ）

#### スマホ
- 1カラム（上: プレビュー / 下: 操作）
- トリミングモーダルは `max-h-[80vh]`

### 10.2 ステップ
- Step 1: ロゴ読込
- Step 2: トリミング / 背景透過（色クリック指定）
- Step 3: 配置調整
- Step 4: 発行（確認PDF）

### 10.3 状態管理（simState）
- `EMPTY` / `UPLOADED` / `EDITING` / `PLACEMENT` / `READY_TO_ISSUE` / `ISSUING` / `ISSUED` / `ERROR`

### 10.4 ロゴ入力
- PNG/JPEG/WEBP、5MB以内
- File を IndexedDB に保存（logoOriginal）

### 10.5 トリミング
- 独自のトリミングUI
- crop は正規化座標（0-1）で保存

### 10.6 背景透過（色クリック指定）
- クリックした色を透過
- 閾値は固定

### 10.7 モノクロ二値化
- 有効/無効はテンプレート管理で設定
- 閾値は固定

### 10.8 配置
- ドラッグ移動 / 右下ハンドルでサイズ変更
- 枠外は発行不可、枠より大きい場合は発行時にエラー

---

## 11. Design ID 仕様
- フォーマット: `YYMMDD_XXXXXXXX`
- 文字集合: 数字 2-9、英大文字（I/L/O除外）
- 生成: `crypto.getRandomValues`

---

## 12. PDF仕様
### 12.1 重要方針
- UI表示と同じ見え方になるように描画する

### 12.2 サイズ
- template.background.canvasWidthPx/HeightPx を基準
- template.pdf.dpi が 300 の場合: 3508px / 2480px を目安

### 12.3 確認用PDF
- 背景 + 枠 + ロゴ + 位置/サイズ(mm) + デザインID

### 12.4 刻印用PDF
- 白背景 + 枠 + ロゴ + 位置/サイズ(mm) + デザインID

### 12.5 px→mm
- mm = px * (25.4 / dpi)
- 小数第1位まで

---

## 13. 管理画面（/admin/templates）
- template.json + 背景画像を同時に登録
- 状態の切り替え（下書き / テスト済み / 公開中）
- テスト / スマホ / PC 表示の確認

## 14. デザイン発行履歴（/admin/designs）
- 履歴一覧を表示
- PDFプレビュー → ダウンロード
- 選択削除は確認ダイアログ付き

## 15. エラー表示
- 原因 + 次の行動が分かる文言にする

## 16. UI/UX
- 業務用途の落ち着いたデザイン

## 17. ディレクトリの目安
- `src/pages` : 画面
- `src/domain` : ロジック
- `src/storage` : 永続化

## 18. 手動テスト
- テンプレ登録 → シミュレーター → PDF発行 → 履歴確認

---
## テストチェックリスト
- 実行用のチェック項目は `test_checklist.md` を参照

