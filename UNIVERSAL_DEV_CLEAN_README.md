# 汎用開発環境クリーンスタートスクリプト

## 概要
あらゆるフロントエンド開発環境に対応した、開発サーバーのクリーン起動スクリプトです。

## 対応フレームワーク
- ✅ **Vite** (React, Vue, Svelte等)
- ✅ **Next.js**  
- ✅ **SvelteKit**
- ✅ **Nuxt.js**
- ✅ **Vue CLI**
- ✅ **Create React App**
- ✅ **その他のNode.js開発環境**

## 対応パッケージマネージャー
- ✅ **npm**
- ✅ **yarn** 
- ✅ **pnpm**

## インストール方法

### 1. プロジェクトごとにインストール
```bash
# プロジェクトルートで実行
curl -O https://raw.githubusercontent.com/your-repo/universal-dev-clean.sh
chmod +x universal-dev-clean.sh

# package.jsonに追加
"scripts": {
  "dev:clean": "./universal-dev-clean.sh"
}
```

### 2. グローバルインストール（推奨）
```bash
# グローバルディレクトリにコピー
sudo cp universal-dev-clean.sh /usr/local/bin/dev-clean
sudo chmod +x /usr/local/bin/dev-clean

# どこからでも実行可能
cd any-project
dev-clean
```

## 使用方法

### 基本的な使用
```bash
# プロジェクトルートで実行
./universal-dev-clean.sh

# または package.json経由
npm run dev:clean

# グローバルインストール済みなら
dev-clean
```

### 自動で実行される処理

1. **プロジェクトタイプ自動検出**
   - 設定ファイルから自動判別
   - 適切な起動コマンド選択

2. **プロセス停止**
   - 既存の開発サーバープロセス停止
   - 複数ポートの占有プロセス解放

3. **キャッシュクリア**
   - フレームワーク固有のキャッシュ削除
   - ビルド成果物の削除

4. **開発サーバー起動**
   - パッケージマネージャー自動検出
   - 適切なコマンドで起動

## トラブルシューティング

### よくある問題と解決策

| 問題 | 解決方法 |
|------|----------|
| 変更が反映されない | `dev-clean` を実行 |
| Port already in use | `dev-clean` を実行 |
| ビルドエラーが残る | `dev-clean` を実行 |
| HMRが動かない | `dev-clean` を実行 |

### 高度なカスタマイズ

プロジェクト固有の設定が必要な場合：

```bash
# プロジェクトルートに .dev-clean.config を作成
echo 'CUSTOM_PORT=8080' > .dev-clean.config
echo 'EXTRA_CACHE_DIRS=".custom-cache"' >> .dev-clean.config
```

## CI/CD統合

GitHub Actionsでの使用例：

```yaml
# .github/workflows/dev-test.yml
name: Development Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Clean Start Dev Server
        run: |
          chmod +x universal-dev-clean.sh
          timeout 60s ./universal-dev-clean.sh || true
```

## チーム導入のベストプラクティス

### 1. 標準化
```bash
# すべてのプロジェクトで統一
npm run dev:clean  # 標準コマンド
```

### 2. ドキュメント化
```markdown
## 開発環境のトラブル時
1. `npm run dev:clean` を実行
2. それでも解決しない場合はSlackで相談
```

### 3. onboarding時の説明
新メンバーには最初に教える重要コマンドとして位置づけ

## よくある質問

### Q: 既存のスクリプトと競合しませんか？
A: 既存の`dev`コマンドは変更せず、`dev:clean`として追加するため安全です。

### Q: Dockerコンテナ内でも動作しますか？  
A: はい、コンテナ内でも正常に動作します。

### Q: 他の開発者と共有するには？
A: GitリポジトリにコミットしてTeamで共有、またはgistで公開がお勧めです。

## ライセンス
MIT License - 自由にカスタマイズ・配布可能

## 貢献
改善提案やバグ報告は Issue または PR でお願いします。