# package-lock.json の更新手順

## 問題
`package.json`と`package-lock.json`が同期していないため、GitHub Actionsで`npm ci`が失敗しています。

## 解決方法

### ステップ1: ローカルで依存関係を更新

ターミナルまたはコマンドプロンプトで以下を実行：

```bash
cd "C:\Users\owner\OneDrive\ドキュメント\ラクリプ専用フォルダ\【NEW】名入れ刻印シミュレーター"

# package-lock.jsonを更新
npm install

# 変更を確認
git status
```

### ステップ2: 変更をコミット・プッシュ

```bash
# package-lock.jsonを追加
git add package-lock.json

# コミット
git commit -m "package-lock.jsonを更新してpackage.jsonと同期"

# プッシュ
git push origin master
```

### ステップ3: ワークフローを再実行

プッシュ後、GitHub Actionsが自動的に実行されます。または、手動で「Run workflow」をクリックしてください。
