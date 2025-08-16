# nagaiku-budget-v2 プロジェクト設定

## プロジェクト概要
**nagaiku-budget-v2** - NPO法人ながいくの予算管理システム改良版
- 1対多予算項目割当機能を持つ財務管理システム
- freee API連携による取引データ自動同期

### システムの基本的な仕組み
**重要な概念の理解：**
1. **取引データ（Transaction）**
   - freee APIから取得される、すでに支払い済みの実績データ
   - これらは「使った」お金の記録

2. **割当（AllocationSplit）**
   - 支払い済みの取引を、どの助成金・予算項目から出したことにするかの割り振り
   - 1つの取引を複数の予算項目に分割して割り当て可能

3. **使用額の意味**
   - 「使用額」= AllocationSplitの合計額
   - つまり、実際に支払い済みの金額がどの予算に割り当てられたかの結果
   - 「割当額」と「使用額」は同じ意味（すでに支払い済みだから）

4. **残額の計算**
   - 予算額 - 使用額（割当額）
   - 助成金全体の残額 = 助成金総額 - 全予算項目の使用額合計

## 環境設定

### 【重要】VPS環境での制約
- **VPS環境**：localhostは外部からアクセス不可
- **開発・本番どちらも**：Nginx経由でアクセスする
- **開発・本番どちらも**：`/budget2/`パス必須

### ポート設定
- **開発環境**: PORT 3002
- **本番環境**: PORT 3002
- **ポート変更禁止** - Nginx設定と連動しているため

### アクセス構成
#### 開発時
```
外部 → Nginx → Vite開発サーバー（localhost:3002）
URL: https://nagaiku.top/budget2/
```

#### 本番時
```
外部 → Nginx → Node.js（ビルド済み、localhost:3002）
URL: https://nagaiku.top/budget2/
```

### URL設定
- **両環境共通URL**: https://nagaiku.top/budget2/
- **HTTPSアクセス必須** - HTTPは使用不可
- **重要**：開発時も本番時も同じURL・同じパス

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

### 作業フロー管理
- **作業前確認**: すべての作業（実装・修正・削除・調査・設定変更など）について、タスクを書き出して、ユーザーの確認を得てから作業する
- **作業内容の明確化**: 「何を変更するか」「どのエージェントを使うか」を必ず伝える
- **TodoWriteツール使用**: 複雑なタスクは必ずTodoWriteで管理する

### 作業開始のトリガーワード
**作業を開始する承認ワード:**
- 「はい」「OK」「お願い」「進めて」「実装して」「やって」「修正して」「直して」
- これらの明確な承認があった場合のみ作業実行

**調査のみ（コード変更しない）:**
- 「何故？」「なぜ？」「どうして？」「原因は？」
- 「調査して」「確認して」「見て」「教えて」
- これらは調査・報告のみ、コード修正はしない

**作業内容の確認が必要なワード:**
- 「〜するね」「〜したい」「〜してほしい」「〜して欲しい」
- 「〜を狭める」「〜を変更」「〜を追加」などの具体的な変更指示
- これらは作業内容と使用エージェントを提示して承認を待つ

**無反応の扱い:**
- 返事がない場合は実行しない（ユーザーが常に監視する必要をなくすため）

### 機能削除ルール
- **削除前確認**: どんな事情があっても、機能削除はタスクとして提示し確認を得てから実行する
- **影響範囲の明示**: 削除による影響を事前に説明する

### エージェント使用ルール（絶対）
**作業開始前に必ず通知する**
- **エージェントを使用しない場合**: 「直接作業します」と明示
- **エージェントを使用する場合**: 「○○エージェントを使用します」と明示
  - 例: 「frontend-desktop-specialistエージェントを使用します」
  - 例: 「general-purposeエージェントを使用します」
- **簡単な作業でも専門エージェントがあれば使用する**

#### 使用するエージェント
- **画面・UI変更** → frontend-desktop-specialist
- **DB・SQL** → postgresql-specialist
- **セキュリティ** → security-audit-specialist
- **CSV処理** → csv-data-specialist
- **Webエラー** → web-error-diagnostician
- **パフォーマンス** → performance-optimizer
- **freee連携** → freee-api-specialist
- **テスト作成** → test-automation-expert
- **リファクタリング** → code-refactor-expert
- **バグ修正** → bug-hunter-pro
- **その他・不明** → general-purpose

※直接コード修正は禁止

### 開発と本番の違い

#### 開発モード（現在）
- **プロセス管理**: tmux使用（systemctl不使用）
- **アプリケーション**: Vite開発サーバー（ホットリロード付き）
- **起動コマンド**: 
  ```bash
  tmux new-session -d -s nagaiku-dev
  tmux send-keys -t nagaiku-dev "cd /home/tanaka/projects/nagaiku-budget-v2 && PORT=3002 npm run dev" Enter
  ```
- **データベース**: nagaiku_budget_v2_dev

#### 本番モード（将来）
- **プロセス管理**: systemd管理
- **アプリケーション**: ビルド済みNode.jsアプリ
- **起動コマンド**: 
  ```bash
  npm run build  # ビルド
  sudo systemctl start nagaiku-budget-v2  # systemdで起動
  sudo systemctl status nagaiku-budget-v2  # 状態確認
  ```
- **データベース**: nagaiku_budget_v2_prod

#### 共通部分
- **ポート**: 3002（変更禁止）
- **URL**: https://nagaiku.top/budget2/
- **Nginx**: リバースプロキシとして動作

### テストコマンド
```bash
# 両環境共通テスト（VPSから実行）
timeout 10 curl -k https://nagaiku.top/budget2/grants

# 注意：localhost直接アクセスは不可（VPS環境のため）
# ❌ timeout 10 curl -k https://localhost:3002/grants
```

### 【重要】開発・本番統一ルール
1. **URLパスは常に `/budget2/`**
2. **アクセスは常に `https://nagaiku.top/budget2/`**  
3. **localhost直接アクセスは使わない**
4. **Vite設定もNginx設定も `/budget2/` で統一**

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
   
### 【重要】freee APIフィールドマッピングルール
**絶対厳守：フィールドの結合・フォールバック・デフォルト値の使用は完全禁止**

#### freee API deals エンドポイントのフィールド構造
```
deal {
  id: 取引ID
  issue_date: 発生日
  amount: 金額  
  partner_id: 取引先ID（数値）
  ref_number: 管理番号
  memo: メモ（省略可能）
  details: [{
    id: 明細ID
    account_item_id: 勘定科目ID（数値）
    item_id: 品目ID（数値、省略可能）
    section_id: 部門ID（数値、省略可能）
    description: 明細の備考（省略可能）
  }]
}
```

#### データベースへのマッピング規則
1. **description（取引内容）**: 
   - freee APIのdeals APIには存在しない → **必ずnullを設定**
   - ❌ 間違い: `partner_name + item_name + detail.description`
   - ✅ 正解: `null`

2. **detailDescription（明細備考）**:
   - freee APIの`details[0].description`をそのまま使用
   - ❌ 間違い: `detail?.description || ''`
   - ✅ 正解: `detail?.description || null`

3. **managementNumber（管理番号）**:
   - freee APIの`ref_number`をそのまま使用
   - ❌ 間違い: `ref_number || '管理番号なし'`
   - ✅ 正解: `deal.ref_number || null`

4. **マスタデータからの変換**:
   - partner_id → supplier（取引先名）: マスタから取得、存在しない場合null
   - account_item_id → account（勘定科目名）: マスタから取得、存在しない場合null
   - item_id → item（品目名）: マスタから取得、存在しない場合null
   - section_id → department（部門名）: マスタから取得、存在しない場合null

5. **フィールド結合の完全禁止**:
   - ❌ `「${partnerName} [${sectionName}] (${accountName})`
   - ❌ `detailDescription || description || ''`
   - ❌ `description || memo || '不明'`
   - ✅ 各フィールドを独立して保存

#### なぜフィールド結合が禁止なのか
1. **データベースの正規性**: 1つのフィールドに複数の情報を混ぜると、元データの追跡が不可能になる
2. **freeeとの整合性**: freeeの画面と異なるデータになり、ユーザーが混乱する
3. **データ分析の阻害**: 結合されたデータは検索・集計・分析ができない
4. **バグの温床**: 「なぜこのデータが表示されているか」が分からなくなる

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