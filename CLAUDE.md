# nagaiku-budget-v2 プロジェクト設定

## プロジェクト概要
**nagaiku-budget-v2** - NPO法人ながいくの予算管理システム改良版
- 1対多予算項目割当機能を持つ財務管理システム
- freee API連携による取引データ自動同期

## 環境設定

### ポート設定
- **開発環境**: PORT 3002
- **本番環境**: PORT 3002
- **ポート変更禁止** - Nginx設定と連動しているため

### URL設定
- **本番URL**: https://nagaiku.top/budget2/
- **開発URL**: https://localhost:3002
- **HTTPSアクセス必須** - HTTPは使用不可

### tmuxセッション
- **開発用セッション名**: 
  - `nagaiku-dev`
  - `dev-budget`
- **開発サーバー起動**: `PORT=3002 npm run dev`

## データベース設定

### PostgreSQL
- **開発DB**: nagaiku_budget_v2_dev
- **本番DB**: nagaiku_budget_v2_prod
- **ユーザー**: nagaiku_user
- **パスワード**: 環境変数で管理

### データベース操作
```bash
# 開発DBアクセス（パスワードは環境変数から取得）
PGPASSWORD=$DB_PASSWORD psql -h localhost -U nagaiku_user -d nagaiku_budget_v2_dev

# バックアップ
./scripts/pg_backup.sh
```

## 開発ルール

### 開発モード
- **必ずtmux使用** - systemctlは本番環境のみ
- **起動コマンド**: 
  ```bash
  tmux new-session -d -s nagaiku-dev
  tmux send-keys -t nagaiku-dev "cd /home/tanaka/projects/nagaiku-budget-v2 && PORT=3002 npm run dev" Enter
  ```

### 本番モード
- **systemd管理**: 
  ```bash
  sudo systemctl start nagaiku-budget-v2
  sudo systemctl status nagaiku-budget-v2
  ```

### テストコマンド
```bash
# 本番環境テスト（VPSから実行）
timeout 10 curl -k https://nagaiku.top/budget2/grants

# ローカル開発テスト
timeout 10 curl -k https://localhost:3002/grants
```

## 技術スタック

### フロントエンド
- **Framework**: SvelteKit 2.x
- **Language**: TypeScript 5.x
- **UI Library**: SVAR Svelte DataGrid
- **Styling**: Tailwind CSS 3.x

### バックエンド
- **Runtime**: Node.js 18+
- **ORM**: Prisma 6.x
- **Validation**: Zod 4.x
- **Database**: PostgreSQL 13+

### 外部連携
- **freee API**: OAuth2認証による会計データ連携
- **CSV Import**: freeeエクスポートデータ対応

## プロジェクト固有のエージェント指示

### エージェント使用時の必須情報
以下の情報を**必ずエージェントに伝える**：

1. **環境について**
   - 開発はtmux使用（systemctlではない）
   - ポートは必ず3002
   - HTTPSアクセスのみ（https://nagaiku.top/budget2/）

2. **データベースについて**
   - PostgreSQL使用
   - 開発DB: nagaiku_budget_v2_dev
   - Prisma ORM使用

3. **freee API連携について**
   - OAuth2認証フロー実装済み
   - 【事】【管】勘定科目フィルタリング必須

## ファイル構成

### 重要ディレクトリ
```
/home/tanaka/projects/nagaiku-budget-v2/
├── src/
│   ├── routes/        # SvelteKitルート
│   ├── lib/          # 共有ライブラリ
│   │   ├── components/  # UIコンポーネント
│   │   ├── server/     # サーバーサイドロジック
│   │   └── utils/      # ユーティリティ関数
│   └── app.html       # HTMLテンプレート
├── prisma/
│   └── schema.prisma  # データベーススキーマ
├── scripts/          # 管理スクリプト
└── logs/            # ログファイル
```

### 設定ファイル
- `vite.config.ts` - Vite設定
- `svelte.config.js` - SvelteKit設定
- `tailwind.config.js` - Tailwind CSS設定
- `prisma/schema.prisma` - データベーススキーマ

## セキュリティ

### 認証・認可
- freee OAuth2トークンは環境変数で管理
- CSRF対策はSvelteKitビルトイン機能使用
- セッション管理はサーバーサイド

### HTTPS設定
- 開発環境: 自己署名証明書（certs/ディレクトリ）
- 本番環境: Let's Encrypt証明書（Nginx管理）

## トラブルシューティング

### よくある問題
1. **502エラー**: 
   - 開発サーバーが起動していない → tmuxセッション確認
   - ポート競合 → `sudo ss -tlnp | grep 3002`

2. **データベース接続エラー**:
   - PostgreSQLサービス確認 → `sudo systemctl status postgresql`
   - 認証情報確認 → 環境変数確認

3. **freee API エラー**:
   - トークン期限切れ → 再認証フロー実行
   - レート制限 → 待機後リトライ

## メモ

### 開発時の注意事項
- **絶対にポート3002を変更しない**
- VPSからlocalhostへのアクセスは不可
- 開発時もHTTPS必須（自己署名証明書使用）
- tmuxセッションは明示的に停止するまで継続

### デプロイ時の確認事項
1. `npm run build` 実行
2. 本番DBマイグレーション確認
3. systemdサービス再起動
4. Nginxリロード（設定変更時のみ）