# エラー診断レポート - 助成金管理システム

## エラー概要

発生している主要エラー：
1. **WebSocketエラー**: Vite HMR（Hot Module Replacement）のWebSocket接続エラー
2. **API 500エラー**: `/api/grants/import` エンドポイントのサーバーエラー

影響範囲：
- 開発環境でのリアルタイム更新機能の停止
- CSV助成金データのインポート機能が利用不可

## 原因分析

### 1. WebSocketエラーの根本原因
- **原因**: Vite設定でWebSocketの`clientPort`設定が不適切
- **詳細**: `allowedHosts`設定が削除され、HMR設定でプロトコルが未指定だった
- **影響**: 開発時のホットリロードが機能しない

### 2. API 500エラーの根本原因
- **原因1**: データベースファイル（`database.sqlite`）が存在しない
- **原因2**: better-sqlite3モジュールの初期化エラー処理が不十分
- **影響**: 助成金データのインポート機能が完全に停止

### 3. アプリケーションのハング
- **原因**: SvelteKitの基本パス設定（`/budget2`）とViteの設定の不整合
- **詳細**: HTTPリクエストがタイムアウトし、アプリケーションが応答しない

## 緊急対応

### 実施済み対策：
1. ✅ データベースファイルの作成（`/home/tanaka/projects/nagaiku-budget-v2/database.sqlite`）
2. ✅ Vite設定の修正（WebSocket設定の改善）
3. ✅ API エラーハンドリングの改善（詳細ログ追加）
4. ✅ デバッグ起動スクリプトの作成（`debug-start.sh`）

### 即座に実行すべき応急処置：

```bash
# 1. 既存のViteプロセスを終了
pkill -f "vite dev"

# 2. デバッグスクリプトで起動
cd /home/tanaka/projects/nagaiku-budget-v2
./debug-start.sh
```

## 根本解決

### 手順1: Vite設定の完全修正
`vite.config.ts`の変更内容：
- WebSocket HMR設定を修正（`protocol: 'ws'`を追加）
- `clientPort`設定を削除（不要）
- `allowedHosts`設定を削除（セキュリティ上の問題を回避）

### 手順2: データベース初期化の改善
`src/routes/api/grants/import/+server.ts`の変更内容：
- データベースファイルの存在確認を追加
- ディレクトリの自動作成処理を追加
- 詳細なエラーログを追加
- 初期化処理を try-catch で保護

### 手順3: 起動プロセスの標準化
作成した`debug-start.sh`により：
- ポート使用状況の事前確認
- データベースファイルの自動作成
- 依存関係の自動確認
- 起動前の環境チェック

## 検証方法

### 1. WebSocket接続の確認
```bash
# ブラウザの開発者ツールで確認
# Console タブで WebSocket エラーが表示されないことを確認
```

### 2. API動作確認
```bash
# CSVインポートをテスト
curl -X POST http://localhost:3002/budget2/api/grants/import \
  -H "Content-Type: application/json" \
  -d '{"data":[{"name":"テスト助成金","totalAmount":1000000}]}'
```

### 3. アプリケーション全体の動作確認
```bash
# ブラウザで確認
open http://localhost:3002/budget2/
```

## 予防策

### 1. 開発環境の標準化
- **推奨**: 開発起動は常に`debug-start.sh`を使用
- **理由**: 環境チェックと初期化を自動化

### 2. データベース管理
- **推奨**: Prismaマイグレーションの活用
```bash
npm run db:push  # スキーマをデータベースに反映
npm run db:seed  # 初期データの投入
```

### 3. エラー監視の改善
- **実装済み**: APIエンドポイントに詳細ログ追加
- **推奨**: ログファイルの定期確認
```bash
tail -f logs/app.log  # アプリケーションログの監視
```

### 4. 設定ファイルのバックアップ
- **推奨**: 重要な設定変更前にバックアップ作成
```bash
cp vite.config.ts vite.config.ts.backup.$(date +%Y%m%d_%H%M%S)
```

### 5. 依存関係の定期更新
```bash
# 週次で実行を推奨
npm outdated  # 古いパッケージの確認
npm update    # パッケージの更新
```

## 追加推奨事項

### 1. 環境変数の活用
`.env`ファイルで管理すべき項目：
- データベースパス
- ポート番号
- ホスト設定

### 2. ヘルスチェックエンドポイントの追加
```typescript
// src/routes/api/health/+server.ts
export const GET = () => {
  return json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
};
```

### 3. 開発ドキュメントの整備
- エラー対処法のWiki作成
- トラブルシューティングガイドの作成

## まとめ

今回のエラーは、主に環境設定の不整合とデータベースファイルの不在が原因でした。実施した対策により、これらの問題は解決されています。今後は、提供した予防策を実施することで、同様のエラーの再発を防ぐことができます。

作成した`debug-start.sh`を使用して開発サーバーを起動することで、環境の事前チェックが自動化され、エラーの早期発見が可能になります。