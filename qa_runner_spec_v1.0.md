# QA Runner Spec v1.0（Codex向け テスト実行フロー仕様書）

## 0. 目的
- コアフロー（管理→お客様→発行→履歴）を自動テストで再現できる形に落とし込む
- Codexがテストを回しながら不具合を直せる運用ループを作る

## 1. 対象範囲（テスト対象のコアフロー）
### 1.1 画面・ルート（固定）
- お客様: `/sim/:templateKey`（templateがtested/publishedのみ）
- 管理: `/admin/templates`（テンプレ管理）
- 管理: `/admin/designs`（デザイン履歴）

### 1.2 管理者コア
- template.json + 背景画像の同時D&D登録（ファイル名一致必須）
- status（draft/tested/published）の変更

### 1.3 お客様コア
- simState（状態機械）に沿ってステップ進行
- ロゴ入力仕様（PNG/JPEG/WEBP、5MB上限）
- 発行: Design ID生成 → confirm PDF自動DL

### 1.4 PDFコア
- confirm PDF内容（背景/枠/ロゴ/Design ID）
- engrave PDF内容（白背景/ロゴ/Design ID）
- 座標変換（px→pt、Y反転）

### 1.5 永続化コア
- JSONはlocalStorage、画像/PDFはIndexedDB（assets store、命名規則固定）

参照仕様書: `engraving-simulator-local-spec_v1.2.md`

## 2. 非対象（v1.0ではテストしない）
- 画面デザインの美観（見た目の細かなズレ）
- 印刷品質の主観評価（PDF生成の有無・ID記載は検証する）
- ブラウザ差異の網羅（まずはChromium基準）

## 3. テスト戦略（層別）
- Unit: ロジックの正しさ（Vitest）
  - Design ID、座標変換、枠内クランプ、バリデーション
- Integration: ブラウザAPI含む結合（Vitest + jsdom + 一部Playwright）
  - IndexedDB保存、PDF生成（Blob）、localStorage
- E2E: 実操作の再現（Playwright）
  - 管理D&D→公開→simでアップロード→配置→発行→履歴

## 4. 追加構成（必須）
- `tests/`
  - `unit/`
  - `integration/`
  - `e2e/`
- `test-assets/`
  - `template/`
    - `template.json`
    - `bg.png`
  - `logo/`
    - `logo_ok.png`
    - `logo_large_6mb.png`
    - `logo_bad.txt`
- `playwright.config.ts`
- `vitest.config.ts`

## 5. テストデータ（固定）
### 5.1 正常系テンプレ
- `test-assets/template/template.json`
  - templateKey: `test_template_a4`
  - background.fileName: `bg.png`
  - canvasWidthPx/HeightPx: 妥当値
  - engravingArea: キャンバス内に収まる
- `test-assets/template/bg.png`（template.jsonとファイル名一致が必須）

### 5.2 正常系ロゴ
- `test-assets/logo/logo_ok.png`（小さめ、透過あり/なし可）

### 5.3 異常系ロゴ
- `logo_large_6mb.png`（容量超過）
- `logo_bad.txt`（形式不正）

## 6. E2Eテストケース（最小セット）
### TC-E2E-01 管理：テンプレ登録（D&D）
手順
- `/admin/templates` を開く
- template.json と bg.png を同時にドロップ

期待結果
- テンプレが一覧に追加される
- statusが初期値で表示される

### TC-E2E-02 管理：公開制御
手順
- statusがdraftのまま `/sim/test_template_a4` を開く

期待結果
- 利用不可のエラー表示（アクセスブロック）

### TC-E2E-03 お客様：正常フロー
前提
- テンプレstatusをtestedまたはpublishedに変更

手順
- `/sim/test_template_a4` を開く
- `logo_ok.png` をアップロード
- 編集ステップを進め、配置で枠内に収める
- 「発行」押下

期待結果
- simStateが ISSUING→ISSUED に遷移
- Design IDが表示される（YYMMDD_XXXXXXXX）
- confirm PDFが自動ダウンロードされる

### TC-E2E-04 管理：履歴に残りPDF再取得
手順
- `/admin/designs` を開く
- 直前に発行したdesignIdが一覧にあることを確認
- confirm/engrave をダウンロード

期待結果
- confirm/engrave が取得できる

### TC-E2E-05 異常：容量超過
手順
- `/sim/test_template_a4` で `logo_large_6mb.png` をアップロード

期待結果
- エラー表示しつつ復帰可能（EMPTYに戻る）

## 7. Unitテスト項目（必須）
- UT-01 Design ID生成
  - フォーマット `YYMMDD_XXXXXXXX`
  - 使用可能文字集合（0/1/I/L/O除外）
- UT-02 座標変換（px→pt、Y反転）
- UT-03 テンプレD&D検証（ファイル名一致）

## 8. テスト実行コマンド（固定）
- `pnpm test`：unit + integration
- `pnpm test:e2e`：Playwright E2E（Chromium）
- `pnpm qa`：上記を順に実行し、レポート出力

## 9. レポート出力仕様
### 9.1 出力ファイル
- `qa-report/summary.json`
- `qa-report/summary.md`
- `qa-report/artifacts/`（スクショ、動画、DLしたPDFなど）

### 9.2 summary.json 例
```json
{
  "timestamp": "2026-01-11T13:00:00Z",
  "results": {
    "unit": {"passed": 42, "failed": 0},
    "integration": {"passed": 12, "failed": 1},
    "e2e": {"passed": 4, "failed": 1}
  },
  "failedTests": [
    {
      "id": "TC-E2E-03",
      "title": "issue generates confirm pdf",
      "error": "download did not start within 10s",
      "artifacts": ["artifacts/TC-E2E-03.png", "artifacts/TC-E2E-03.webm"]
    }
  ]
}
```

## 10. 「Codexにテスト実行させる」運用フロー
### 10.1 1サイクルの手順（固定）
- 人間: `pnpm qa` を実行
- 人間: `qa-report/summary.md` と失敗ログ全文・スクショを貼付
- Codex: 失敗原因を「テスト観点/実装修正観点」で整理
- Codex: 変更ファイル単位のdiffを提示
- 人間: パッチ適用
- 人間: 再度 `pnpm qa`

### 10.2 Codexへの入力テンプレ
あなたは修正担当のCodexです。以下の制約で動いてください。

【制約】
- 仕様は `engraving-simulator-local-spec_v1.2.md` に厳密準拠
- 失敗テストを直すための「最小変更」のみ実施
- リファクタ/設計変更/追加機能は禁止
- 変更は必ず diff で提示し、変更理由を1行で添える

【入力】
1) `qa-report/summary.md`
2) 失敗テストのログ全文
3) 関連ファイルの該当箇所（必要なら後で貼る）

【依頼】
- 原因仮説を最大2つに絞る
- それぞれの検証方法（どのログを見る/どの値を出す）を提示
- 最終的に修正diffを提示

## 11. Done Definition（完了条件）
- `pnpm qa` が3回連続で全緑（環境ブレ除外）
- E2E最小5ケース（6章）がすべて成功
- Design IDとPDF要件に関するUnitが成功
