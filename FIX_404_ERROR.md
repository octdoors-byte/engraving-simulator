# 404エラー修正手順

## 問題
GitHub Pagesでアセット（JS、CSS、faviconなど）が404エラーで読み込まれない。

## 原因
baseパスが正しく設定されていない可能性があります。

## 解決方法

### ステップ1: ワークフローファイルの変更をコミット・プッシュ

```bash
cd "C:\Users\owner\OneDrive\ドキュメント\ラクリプ専用フォルダ\【NEW】名入れ刻印シミュレーター"

git add .github/workflows/deploy.yml
git commit -m "ビルド時のbaseパス確認を追加"
git push origin master
```

### ステップ2: ワークフローを実行してログを確認

1. GitHub Actionsタブでワークフローを実行
2. ビルドログで以下を確認：
   - "Building with base path: /engraving-simulator/"
   - "Base path /engraving-simulator/ found in index.html"

### ステップ3: 問題が続く場合の追加修正

もしbaseパスが正しく適用されていない場合、`.env.production`ファイルを作成する方法に切り替えます。
