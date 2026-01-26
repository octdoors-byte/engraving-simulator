# GitHub Pagesデプロイ - 次の工程

## 現在の状態
- ✅ リモートリポジトリは設定済み（origin）
- ✅ `.github/workflows/deploy.yml` は作成済み
- ⚠️ 未コミットの変更と未追跡ファイルが多数ある

## 次の工程（順番に実行）

### ステップ1: 必要なファイルをコミット

GitHub Pagesデプロイに必要なファイルを追加してコミットします：

```bash
# 1. GitHub Pages関連のファイルを追加
git add .github/workflows/deploy.yml
git add GITHUB_PAGES_DEPLOY.md
git add CHATGPT_AGENT_PROMPT.txt
git add CHATGPT_AGENT_SETUP.md
git add README.md

# 2. コミット
git commit -m "GitHub Pagesデプロイ設定を追加"
```

### ステップ2: GitHubにプッシュ

認証が必要な場合は、Personal Access Token (PAT) を準備してください。

```bash
git push -u origin master
```

**認証方法の選択肢：**

#### 方法A: Personal Access Token（推奨）
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 「Generate new token (classic)」をクリック
3. スコープで以下を選択：
   - ✅ `repo` (すべてのリポジトリへのアクセス)
   - ✅ `workflow` (GitHub Actionsワークフローの更新)
4. トークンを生成してコピー
5. プッシュ時に：
   - Username: `octdoors-byte`
   - Password: [生成したトークンを貼り付け]

#### 方法B: SSH認証
```bash
# SSHキーを生成（まだ持っていない場合）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 公開鍵をコピー
cat ~/.ssh/id_ed25519.pub

# GitHubに公開鍵を登録
# Settings → SSH and GPG keys → New SSH key

# リモートURLをSSHに変更
git remote set-url origin git@github.com:octdoors-byte/engraving-simulator.git

# プッシュ
git push -u origin master
```

### ステップ3: GitHub Pagesの有効化

プッシュが成功したら：

1. GitHubリポジトリのページにアクセス
   - `https://github.com/octdoors-byte/engraving-simulator`

2. **Settings** → **Pages** に移動

3. **Source** セクションで：
   - **GitHub Actions** を選択
   - 設定を保存

### ステップ4: デプロイの確認

1. **Actions** タブを開く
   - ワークフロー「Deploy to GitHub Pages」が自動的に開始されます

2. ワークフローの実行状況を確認
   - ✅ 緑色のチェックマーク = 成功
   - ❌ 赤色の× = 失敗（ログを確認）

3. デプロイが成功したら：
   - **Settings** → **Pages** に戻る
   - 公開URLが表示されます（例: `https://octdoors-byte.github.io/engraving-simulator/`）

4. ブラウザでURLにアクセスして、サイトが正しく表示されることを確認

## トラブルシューティング

### プッシュ時の認証エラー
- PATの権限（`repo`と`workflow`）を確認
- トークンの有効期限を確認
- SSH認証に切り替える

### デプロイが失敗する場合
- Actionsタブでログを確認
- Node.jsのバージョンが正しいか確認（20以上23未満）
- ビルドエラーがないか確認

### 404エラーが発生する場合
- GitHub Pagesの設定で「GitHub Actions」が選択されているか確認
- baseパスが正しいか確認（`/engraving-simulator/`）

## 完了後の確認事項

- [ ] コードがGitHubにプッシュされた
- [ ] GitHub Pagesが有効化された（Settings → Pages）
- [ ] ワークフローが正常に実行された（Actionsタブ）
- [ ] サイトが公開URLで表示される
