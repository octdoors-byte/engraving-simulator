# GitHub Pages デプロイ手順

このプロジェクトをGitHub Pagesにデプロイする手順です。

## 前提条件

- GitHubアカウントを持っていること
- リポジトリがGitHubにプッシュされていること

## リモートリポジトリの設定（初回のみ）

GitHubリポジトリがまだ作成されていない場合、またはリモートが設定されていない場合：

### 1. GitHubでリポジトリを作成

1. GitHubにログイン
2. 右上の「+」→「New repository」をクリック
3. リポジトリ名を入力（例: `engraving-simulator`）
4. 「Create repository」をクリック

### 2. リモートリポジトリを設定

```bash
# リモートを追加（YOUR_USERNAMEとYOUR_REPO_NAMEを実際の値に置き換えてください）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# またはSSHを使用する場合
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

### 3. 初回プッシュ

```bash
git push -u origin master
```

**注意**: ブランチ名が `main` の場合は `master` を `main` に置き換えてください。

## デプロイ手順

### 1. GitHub Pagesの有効化

1. GitHubリポジトリのページにアクセス
2. **Settings** → **Pages** に移動
3. **Source** で **GitHub Actions** を選択
4. 設定を保存

### 2. 自動デプロイの設定

`.github/workflows/deploy.yml` が既に作成されているため、以下のいずれかの方法でデプロイが開始されます：

- **main** または **master** ブランチにプッシュしたとき
- GitHubのActionsタブから手動でワークフローを実行

### 3. デプロイの確認

1. GitHubリポジトリの **Actions** タブを開く
2. ワークフローの実行状況を確認
3. デプロイが完了すると、**Settings** → **Pages** に表示されるURLでサイトにアクセスできます

通常のURL形式：
- `https://[ユーザー名].github.io/[リポジトリ名]/`

## Baseパスの設定

### プロジェクトページ（デフォルト）

リポジトリ名がURLに含まれる場合（例: `https://username.github.io/repository-name/`）:
- デフォルトで `/リポジトリ名/` がbaseパスとして設定されます
- 変更不要です

### カスタムドメインまたはルートパス

ルートパス（`/`）でデプロイしたい場合:

1. `.github/workflows/deploy.yml` を編集
2. `VITE_BASE_PATH` の値を `/` に変更:

```yaml
- name: Build
  env:
    VITE_BASE_PATH: '/'
  run: npm run build
```

### 手動でbaseパスを設定する場合

`.github/workflows/deploy.yml` の `VITE_BASE_PATH` 環境変数を変更してください。

## トラブルシューティング

### 404エラーが発生する場合

- baseパスの設定を確認してください
- ビルドが正常に完了しているか確認してください
- GitHub Pagesの設定で **GitHub Actions** が選択されているか確認してください

### アセット（画像、CSSなど）が読み込まれない場合

- baseパスの設定が正しいか確認してください
- ブラウザの開発者ツールでネットワークタブを確認し、リクエストURLを確認してください

### デプロイが失敗する場合

1. GitHub Actionsのログを確認
2. ビルドエラーがないか確認
3. Node.jsのバージョンが正しいか確認（package.jsonで `>=20 <23` を指定）

## 手動デプロイ（オプション）

自動デプロイを使わず、手動でデプロイする場合:

```bash
# 依存関係のインストール
npm install

# ビルド（baseパスを指定）
VITE_BASE_PATH=/リポジトリ名/ npm run build

# gh-pagesパッケージを使用する場合（事前にインストールが必要）
npx gh-pages -d dist
```

## 注意事項

- GitHub Pagesは静的サイトホスティングサービスのため、サーバーサイドの機能（`server.js`など）は使用できません
- すべての機能はクライアントサイド（ブラウザ）で動作する必要があります
- このプロジェクトは `localStorage` と `IndexedDB` を使用しているため、GitHub Pagesでも正常に動作します
