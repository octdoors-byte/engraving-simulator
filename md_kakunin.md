# 🛠 高精度・ローカル完結型 刻印チE��インシミュレーター�E�完�E版�E最終仕様書�E�Espec_id: engraving-simulator-local-final-v1.2  
対象: **ローカル環墁E��Eite + React + TypeScript + Tailwind�E�で確実に動くMVP**�E�サーバ�E/課釁E認証なし！E 
更新日: 2026-01-09  
方釁E **「MVPの確実性」＋「後戻りしにくい高精度要素�E�Eexie/比率座樁Emm変換/オフスクリーン高解像度�E�」を先に採用**

---

## 0. 実裁E��E��け�E紁E���E�重要E��E- 本書に**記載された仕様�Eみ**を実裁E��る（推測の拡張は禁止�E�、E- 迷ったら、E*v1.2ではめE��なぁE*」を優先し、TODOコメントで封E��拡張候補として残す、E- ブラウザ完結！EocalStorage / IndexedDB�E�ゆえ、E*容量不足・破損�E部刁E��敁E*に対するハンドリングを忁E��とする、E
---

## 1. 目皁E��何を解決するチE�Eルか！E- お客様が **刻印用ロゴ画僁E*を取り込み、E  - トリミング
  - 背景透過（色クリック指定）
  を、E*ブラウザだけで完絁E*して行う、E- 管琁E��E��チE��プレート（台紙）を登録し、発行履歴を確認し、E*刻印作業用PDF**を�E取得できる、E
---

## 2. Done Definition�E��E功条件�E�E以下がすべて成立したらDone、E
### 2.1 開発/起勁E- `npm install` ↁE`npm run dev` でローカル起動できる
- ルーチE��ングで以下URLが表示されめE  - `/sim/:templateKey`
  - `/admin/templates`
  - `/admin/designs`

### 2.2 管琁E��テンプレ登録・管琁E- `/admin/templates` で `template.json` と背景画像！ENG/WebP/JPEG�E�を **同時D&D** で登録できる
- チE��プレのスチE�EタスめE`draft/tested/published` で刁E��替え可能

### 2.4 管琁E��履歴・再DL�E�忁E��！E- `/admin/designs` に発行履歴が永続化される（リロード後も残る�E�E- 履歴から **確認用PDF�E�Eype A�E�E* と **刻印用PDF�E�Eype B�E�E* を�Eダウンロードできる
- PDFがIndexedDBに存在しなぁE��合�E、データから再生成して保存�EDLできる

---

## 3. 非目標！E1.2では実裁E��なぁE��E- 認証、課金、サーバ�E保存、メール送信
- 外部API�E��Eり抜きAI等！E- 褁E��画像�E置、テキスト刻印
- 回転�E�Eotation�E�E- ベクタ化、CMYK変換、印刷所向け特殊色対忁E- PWA�E�オフラインキャチE��ュ�E�※付録で封E��対応案�Eみ

---

## 4. 技術スタチE���E�固定！E- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router v6
- PDF生�E: `pdf-lib`
- 画像�E琁E Canvas API�E�ED�E�E- 永続化:
  - 設定（小さなJSON�E�E localStorage
  - 画僁EPDF�E�Elob�E�E IndexedDB�E�E*Dexie.js採用**�E�E- 状態管琁E React Context + hooks�E�外部Stateライブラリは不要E��E
---

## 5. 画面/URL/権陁E| 区刁E| URL | ペ�Eジ | アクセス |
|---|---|---|---|
| お客槁E| `/sim/:templateKey` | シミュレーター | template.status ぁE`tested` また�E `published` |
| 管琁E| `/admin/templates` | チE��プレ管琁E| 常に可�E�ローカル運用�E�E|
| 管琁E| `/admin/designs` | チE��イン履歴 | 常に可�E�ローカル運用�E�E|

> v1.2では管琁E��面の認証は行わなぁE��E
---

## 6. 永続化設計！EocalStorage / IndexedDB�E�E
### 6.1 localStorage キー�E�固定！E- `ksim:appVersion` … `"1.2.0"`
- `ksim:commonSettings` … 共通�EチE��ー/フッター設定！ESON�E�E- `ksim:uiSettings` … UI状態（折りたたみなど軽微なも�E�E�E
> チE��プレ一覧・チE��イン一覧は **IndexedDB側のindex** を正とする�E�EocalStorageに重褁E��存しなぁE��、E
### 6.2 IndexedDB�E�Eexie.js�E�E#### 6.2.1 DB吁Eバ�Eジョン�E�固定！E- DB吁E `ksim_db`
- version: `1`

#### 6.2.2 チE�Eブル�E�Eexie�E�E- `templates`
- `designs`
- `assets`

#### 6.2.3 スキーマ！Eexie定義�E�E- templates: `id, key, status, updatedAt`
- designs: `designId, templateId, templateKey, createdAt`
- assets: `id, type, refId, createdAt`

※補足  
- 検索めE��覧表示に忁E��な索引だけを貼る！Elob自体�E吁E��ーブル冁E��保持してよいが、v1.2は **assetsにBlobを集紁E* する�E�、E
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
    "background.canvasWidthPx": 1200,
    "background.canvasHeightPx": 1600
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
- engravingArea は背景画像のキャンバスサイズ（background.background.canvasWidthPx/HeightPx）に対するピクセル座標
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

#### 7.3.2 Assetのtype一覧（現仕様）
- `templateBg`
- `logoOriginal`
- `logoEdited`
- `pdfConfirm`
- `pdfEngrave`

#### 7.3.3 Asset ID命名規則（現仕様）
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
- 表示用キャンバスは可変サイズ
- 描画時に viewScale を計算する
  - viewScale = min(viewW / background.background.canvasWidthPx, viewH / background.background.canvasHeightPx)
- 表示座標: displayPx = basePx * viewScale
---

## 9. 共通ヘッダー/フッター
### 9.1 設定UI配置
- `/admin/templates` の最上部に「共通ヘッダー / フッター設定」を表示
- 以後、sim/管理画面で同一表示

### 9.2 設定項目
- `logoAssetId`: 任意（asset:commonLogo:global）
- `headerText`: 任意（説明文、1行）
- `footerText`: 任意（フッター文言）
- `logoAlign`: `left|center|right`
- `headerTextAlign`: `left|center|right`
- `footerTextAlign`: `left|center|right`
- `logoSize`: `sm|md|lg`
- `headerTextSize`: `sm|md|lg`
- `footerTextSize`: `sm|md|lg`

### 9.3 保存ルール
- 設定は localStorage（`ksim:commonSettings`）に保存
- ロゴ画像は localStorage に dataURL で保存
- 入力は 300ms のデバウンスで自動保存（失敗時はトーストで通知）
---

## 10. お客様画面（/sim/:templateKey）
### 10.1 レイアウト
#### PC
- 左: 操作パネル
- 右: プレビュー（背景 + 刻印枠 + ロゴ）
- 発行ボタンは操作パネルの下部

#### スマホ
- 1カラム（上: プレビュー / 下: 操作）
- トリミングモーダルは `max-h-[80vh]`
- 主要ボタン（適用/戻る）は常に表示

### 10.2 ステップ（アコーディオン形式）
- Step 1: ロゴ読込
- Step 2: トリミング / 背景透過（色クリック指定）
- Step 3: 配置調整
- Step 4: 発行（確認PDF）

### 10.3 状態管理（simState）
- `EMPTY`
- `UPLOADED`
- `EDITING`
- `PLACEMENT`
- `READY_TO_ISSUE`
- `ISSUING`
- `ISSUED`
- `ERROR`

### 10.4 ロゴ入力
- 対応: PNG/JPEG/WEBP
- サイズ: 5MB以内
- 取り込み:
  - File をそのまま IndexedDB に保存（logoOriginal）
  - 表示用は createImageBitmap(file) を使う

### 10.5 トリミング
- 独自のトリミングUIを使用
- crop は正規化座標（x,y,w,h を 0-1 で保存）
- 切り出し後の画像を次工程に渡す

### 10.6 背景透過（色クリック指定）
- 透過したい色をロゴ画像上でクリックして選択する
- 許容範囲（閾値）は固定値で処理する（ユーザーのスライダー操作は行わない）
- 端のギザつきを抑えるため、固定のソフト範囲で段階的に透過させる

### 10.7 モノクロ二値化（テンプレート管理の設定のみ）
- 有効/無効の切り替えはテンプレート管理でのみ設定する
- 閾値は固定値で処理する（ユーザーのスライダー操作は行わない）
- 透過済み領域の透明度は保持する

### 10.8 配置（ドラッグ/サイズ変更）
#### 10.8.1 操作
- 移動: ドラッグ
- リサイズ: 右下ハンドルのみ
- 縦横比固定
- サイズ範囲: placementRules.minScale / maxScale

#### 10.8.2 枠内制限
- keepInsideEngravingArea=true の場合、枠外に出ないようにクランプ
- 枠より大きい場合は発行時にエラーで止める

#### 10.8.3 初期配置
- 枠の90%に収まる最大サイズで中央配置
  - scale = min((engraveW*0.9)/logoW, (engraveH*0.9)/logoH)
  - w = logoW*scale, h = logoH*scale
  - x = engraveX + (engraveW - w)/2
  - y = engraveY + (engraveH - h)/2

## 11. Design ID 仕様
### 11.1 フォーマット
- `YYMMDD_XXXXXXXX`

### 11.2 文字集合
- 数字: 2 3 4 5 6 7 8 9
- 英大文字: A B C D E F G H J K M N P Q R S T U V W X Y Z
- 除外: 0 1 I L O

### 11.3 生成方法
- `crypto.getRandomValues` を使用
- 既存IDと衝突した場合は再生成（最大10回）

## 12. PDF仕様
### 12.1 重要方針
- UI表示と同じ見え方になるように、PDF用の座標計算で描画する
- PDFはオフスクリーンで生成する

### 12.2 オフスクリーンCanvasのサイズ
- template.background.canvasWidthPx/HeightPx を基準にする
- template.pdf.dpi と pageSize が A4 の場合の目安: 縦3508px / 横2480px

### 12.3 Type A（確認用）
1) 背景画像を表示
2) 刻印枠のガイドを表示
3) ロゴを配置反映
4) 位置とサイズ（mm）を下部に表示
5) デザインIDを最下部に表示

### 12.4 Type B（刻印用）
1) 白背景（背景画像なし）
2) 刻印枠のガイドを表示
3) ロゴを配置反映
4) 位置とサイズ（mm）を下部に表示
5) デザインIDを最下部に表示

#### 12.4.1 px→mm変換（固定）
- `mm = px * (25.4 / dpi)`
- 変換対象:
  - ロゴ矩形の x,y,w,h
  - 刻印枠の x,y,w,h
- mm表記は小数第1位まで（四捨五入）

#### 12.4.2 mmの原点
- 原点はテンプレ基準キャンバスの左上
- PDF描画は左下原点のため、描画時はYを反転する
- mm表記は「左上原点」で記載する

### 12.5 PDF座標変換
- scaleX = pageWidthPt / background.canvasWidthPx
- scaleY = pageHeightPt / background.canvasHeightPx
- ptX = pxX * scaleX
- ptY = pageHeightPt - (pxY + pxH) * scaleY
- drawImage(img, { x: ptX, y: ptY, width: pxW*scaleX, height: pxH*scaleY })

### 12.6 PDF保存とダウンロード
- 生成したPDFは IndexedDB/assets に保存
- 発行直後は Type A を自動ダウンロード
- Type B は管理画面からダウンロード
------

## 13. 管琁E��面�E�テンプレ管琁E��Eadmin/templates�E�E
### 13.1 一覧チE�Eブル�E�表示列固定！E- name
- key
- status�E�バチE�� + セレクト！E- updatedAt
- 操佁E

### 13.2 新規登録�E�E&D�E�E- ドロチE�E領域に以下を同時投�E
  - `template.json`�E�忁E��Eつ�E�E  - 背景画像（忁E��Eつ�E�E
#### 13.2.1 template.jsonの最小仕様！E1.2固定！E
```json
{
  "templateKey": "certificate_cover_a4_v1",
  "name": "証書カバー A4 右下刻印",
  "status": "draft",
  "updatedAt": "2026-01-09T10:00:00.000+09:00",
  "background": {
    "fileName": "certificate-cover-a4.png",
    "background.canvasWidthPx": 1200,
    "background.canvasHeightPx": 1600
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

#### 13.2.2 登録ルール（現仕様）
- templateKey はURLに使用するため英数字と _- のみ
- background.fileName は背景画像のファイル名と一致させる
- engravingArea と placementRules は必須
- pdf は A4 / 縦横 / dpi を指定する

### 13.4 バリデーション（現仕様）
- templateKey: 英数字と _- の3〜64文字
- name: 必須
- status: draft/tested/published
- updatedAt: 必須
- background.fileName: 必須
- background.background.canvasWidthPx/HeightPx: 200〜20000の整数
- engravingArea.x/y/w/h: 整数、w/hは1以上、キャンバス内
- placementRules: allowRotate/keepInsideEngravingArea/minScale/maxScale は必須
- pdf: pageSize(A4) / orientation / dpi は必須

### 13.5 スチE�Eタス運用�E�固定！E- `draft`: 作�E中�E�お客様利用不可�E�E- `tested`: チE��ト済（お客様利用可�E�E- `published`: 公開中�E�お客様利用可�E�E- `draft` のまま `tested/published` に変更する際、以下を満たさなぁE��合�E拒否
  - 背景画像が存在
  - engravingArea（px）が存在

### 13.6 プレビュー�E�スマ�E想定！E- 「�Eレビュー」�Eタンは `/sim/:key` を新規ウィンドウで開く
- 目宁E `width=390,height=844`

### 13.7 削除�E�固定！E- チE��プレ削除時に削除するも�E
  - templatesレコーチE  - 背景asset�E�EemplateBg�E�E- ただぁEdesignsは削除しなぁE��履歴保�E�E�E  - design一覧でチE��プレ欠損を「削除済みチE��プレ」と表示する

---

## 14. 管琁E��面�E�デザイン履歴�E�Eadmin/designs�E�E
### 14.1 一覧チE�Eブル�E�表示列固定！E- designId
- templateKey�E�欠損時は「削除済みチE��プレ」！E- createdAt
- PDF�E�Eype A�E�ダウンローチE- PDF�E�Eype B�E�ダウンローチE- 操作（削除�E�E
### 14.2 検索/絞り込み�E�E1.2固定！E- designId 部刁E��致検索�E�即時反映�E�E- templateKey セレクト（存在するチE��プレのみ�E�E
### 14.3 PDF再生成ルール�E�固定！E- assetsにPDFが存在 ↁEそ�EBlobでDL
- 存在しなぁEↁE以下で再生成し保存してDL
  - template�E�背景�E�！Edesign�E�EogoProcessed + placement�E�E
### 14.4 チE��イン削除�E�固定！E- designsレコード削除
- assets削除:
  - logoOriginal / logoEdited / pdfA / pdfB

---

## 15. 発行�E琁E��トランザクション皁E��頁E��E発行�Eタン押下時に以下を頁E��行う�E�固定）。途中失敗時はロールバックを行う、E
1) `designId` 生�E  
2) `logoOriginal` Blob めEassets に保孁E 
3) 加工済ロゴ�E�EogoProcessed�E�Blob めEassets に保孁E 
4) PDF Type A 生�E ↁEassetsへ保孁E 
5) PDF Type B 生�E ↁEassetsへ保孁E 
6) designs レコード保存（参照assetIdを保持�E�E 
7) Type A を�E動ダウンローチE 
8) simState めE`ISSUED`

ロールバック�E�失敗時�E�E- 保存済みassetを可能な限り削除し、designレコード�E作らなぁE- エラーをトースト表示し、`READY_TO_ISSUE` に戻す（�E試行可能�E�E
---

## 16. エラー/メチE��ージ仕様（忁E��！E### 16.1 表示ルール
- 画面上部ト�Eスト（�E劁E警呁E失敗！E- 操作パネル冁E��も短斁E��補足�E�忁E��時�E�E- 斁E��は「原因 + 次の行動」を含む

### 16.2 代表エラー�E�固定文例！E- チE��プレ未公閁E
  - 「このペ�Eジは現在ご利用ぁE��だけません�E�テンプレートが未公開です）。、E- 画像形弁E容釁E
  - 「画像�EPNG/JPEG/WEBP、EMB以冁E��お試しください。、E- 保存容量不足�E�EndexedDB�E�E
  - 「保存容量が不足してぁE��す。不要なチE��インを削除してください。、E- PDF生�E失敁E
  - 「PDFの生�Eに失敗しました。画像サイズを小さくして再度お試しください。、E
---

## 17. UI仕様！Eailwind�E�E### 17.1 ト�Eン
- 業務ツール寁E��、裁E��は最封E- Tailwind標準�Eニュートラル + アクセント（青/緁E橙）程度

### 17.3 アクセシビリチE��最低限
- ボタンに `aria-label`
- モーダルはフォーカストラチE�E、Escで閉じめE- 主要�EタンはTab移動可能

---

## 18. 実裁E��計（ディレクトリ/主要モジュール�E�E
### 18.1 推奨チE��レクトリ構�E
- `src/`
  - `app/`
    - `router.tsx`
    - `layout/AppLayout.tsx`�E�Eeader/Footer + Outlet�E�E  - `pages/`
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
    - `types.ts`
    - `id/designId.ts`
    - `image/`
      - `crop.ts`
      - `transparent.ts`
      - `monochrome.ts`
      - `processLogo.ts`�E�統合！E    - `pdf/`
      - `generatePdfA.ts`
      - `generatePdfB.ts`
      - `coord.ts`
    - `storage/`
      - `db.ts`�E�Eexie初期化！E      - `assets.ts`
      - `templates.ts`
      - `designs.ts`

### 18.2 主要E��数�E�忁E��！E- `validateTemplateDraft(input): { ok: boolean; errors: string[] }`
- `saveTemplateWithBg(templateDraft, bgBlob): Promise<Template>`
- `listTemplates(): Promise<Template[]>`
- `generateDesignId(): string`
- `processLogo(params): Promise<Blob>`�E�Erop→透過→二値化！E- `clampPlacement(placement, engravingArea): placement`
- `generatePdfA(args): Promise<Blob>`
- `generatePdfB(args): Promise<Blob>`
- `saveDesignAndAssets(args): Promise<void>`�E�発行手頁E�E統合！E- `listDesigns(): Promise<Design[]>`
- `downloadBlob(blob, filename): void`

---

## 19. 手動チE��ト頁E���E�最低限�E�E
### 19.2 お客様フロー

### 19.3 管琁E��歴
- PDF A/B が�EDLできる
- PDFが欠損した場合、�E生�EしてDLできる

### 19.4 容量不足
- 大量保存してIndexedDBが失敁EↁE明確なエラー表示
- 途中失敗でゴミデータ�E�半端なdesign�E�が残らなぁE
---

## 20. 付録A�E�テンプレサンプル�E��E币E���E�E`template.json`
```json
{
  "templateKey": "sample_a4_rightbottom_v1",
  "name": "サンプルA4 右下刻印",
  "status": "draft",
  "updatedAt": "2026-01-09T10:00:00.000+09:00",
  "background": {
    "fileName": "certificate-cover-a4.png",
    "background.canvasWidthPx": 1200,
    "background.canvasHeightPx": 1600
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

---

## 21. 付録B�E�PWA�E�封E��対応）※v1.2では実裁E��なぁE- 目皁E オフラインでもURLアクセス時に確実に動作させる
- 方釁E
  - 外部CDNは使わず、�E依存�Enode_modulesからバンドル
  - ViteのPWAプラグインで `assets` をキャチE��ュ
- 注愁E
  - IndexedDBのチE�Eタそ�Eも�EはキャチE��ュ対象ではなぁE��ブラウザ領域�E�E  - PWAは「読み込み安定化」であり「データ永続�E保証」ではなぁE
---

- [ ] Phase 5: 管理画面（テンプレD&D + 履歴/再DL/削除）
---

# 最終注愁E- v1.2は「ロゴ1点」「枠冁E�E置」「PDF2種」「履歴管琁E��を最小確実セチE��として固定する、E- Fabric.jsめE��転などの拡張は、v1.2の安定稼働後に別バ�Eジョンで行う、E
---

## �ǋL�iUI�X�V�j
- �e���v���[�g�ꗗ�́u�\�����v�̓_�u���N���b�N�ŕύX�ł���
- ���ʃw�b�_�[ / �t�b�^�[�ݒ�͍ŉ����ɔz�u���A�u�{�v�ŊJ���i�ʏ�͕���j

---

## �ǋL�i�ݒ�ύX�j
- �V�~�����[�^�[���̃��m�N��/�w�i���߂͑���s��
- ���m�N��/�w�i���߂̓e���v���[�g�Ǘ��Őݒ�
- �V�~�����[�^�[�N�����͔w�i��펞�\��

---

## �ǋL�iUI�����j
- ���q�l��ʂ̃X�e�b�v�\����J�[�h�����A�F��������
- �X�e�b�v1/2/3�̃^�C�g���ɐF��t���Ď��F�������

---

## �ǋL�i���쒲���j
- �g���~���O�̓��S�A�b�v���[�h��̂ݑ���\
- ���߂̏����l�́u�Ȃ��v
- �g�O�̂܂ܔ��s�ł��Ȃ��悤�ɐ���
- PDF�������͏c�����ێ�����悤����

---

## 1.5 刻印特化（目的・非目的・制約）
### 1.5.1 位置づけ（Purpose / Non-Purpose）
**Purpose（本ツールが解決すること）**
- 本ツールは「デザインを作る」ためではなく、刻印工程に投入する前の「位置確認・確定（合意形成）」を行う
- お客様が支給するロゴ等の既存データを読み込み、刻印可能範囲内で位置・サイズを調整し、確定データ（PNG/PDF + 位置情報）を発行する
- 位置確認・サイズ確認・確認画像送付の往復を減らし、リードタイム短縮と認識ズレ防止を達成する
**Non-Purpose（本ツールがやらないこと）**
- デザイン生成（AI生成含む）
- デザイン提案・自動レイアウト
- 色変更、装飾（影・縁・フィルタ等）
- 刻印前処理として最低限の画像調整は行う
- 入稿用データ作成（Illustrator形式必須の工程）
- カラーバリエーションの厳密再現（表示は参考）
### 1.5.2 入力データの前提�E�Eustomer Asset First�E�E- お客様�E既に支給チE�Eタ�E�ロゴ原稿・設計図・画像）を持ってぁE��前提とする、E- 本チE�Eルは「支給チE�Eタを刻印工程で使える状態に当てはめて確定する」ことが役割であり、支給チE�Eタ作�Eは責務外とする、E
### 1.5.3 刻印工程に特化した制紁E��Eanufacturing Constraints�E�E- 刻印の物琁E��紁E��最優先する、E- 刻印可能篁E���E�Eounding Box�E�を忁E��表示し、篁E��外への配置は禁止また�E明確に警告する、E- 出力�E「見た目」より「制作指示として再現可能」であることを優先する、E- 刻印は不可送E��あるため、曖昧さを残さないUI/状態を採用する、E- 最終確定操作！Eonfirm�E�を忁E��とし、確定前後で状態を刁E��する、E- 確定後�E、位置・サイズ・入力データのハッシュ等を含めて追跡可能にする�E�既存仕様に合わせてON/OFF�E�、E
### 1.5.4 表示の取り扱ぁE��Eolor & Preview Disclaimer�E�E- 啁E��画像や色味の再現は参老E��示であり、厳寁E��色再現を目皁E��しなぁE��E- プレビューは「刻印位置・サイズ・余白バランス確認」�Eための表示であり、素材差・光源差・モニタ差により実物と差が�Eる可能性がある、E
### 1.5.5 成功条件�E�Eone Definitionに追記！E- お客様がチE�Eル上で配置を確定でき、追加のメール確認なしで制作工程に進められること、E- 確定結果として、以下が取得できること、E  - 出力画像！ENG�E�およ�E忁E��に応じてPDF
  - 位置・サイズ惁E���E�数値�E�E  - チE��プレーチED/チE��インID等�E参�E惁E���E�既存仕様に準拠�E�E
### 1.5.6 仕様書冁E�E名称�E�文書上�E推奨�E�E- 斁E��上�E「デザインシミュレーター」ではなく、以下�EぁE��れかを推奨する、E  - 刻印配置確認ツール
  - 刻印前確認シミュレーター
  - ロゴ配置確定ツール






























---

## テストチェックリスト
- 実行用のチェック項目は `test_checklist.md` を参照
