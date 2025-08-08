# nginx設定修正手順書

## 問題の概要
- 外部IPアクセス（160.251.170.97）で404エラー
- ドメインアクセス（nagaiku.top/budget2/）で502 Bad Gateway
- nginx設定にIPアクセス用のserver設定が不足

## 修正手順

### 1. アプリケーションをHTTPモードで起動

現在のアプリケーションを停止：
```bash
# 現在のプロセス確認
ps aux | grep "node build"

# プロセス停止（PIDを確認して実行）
kill 2078567
```

HTTPモード用の設定でアプリケーションを再起動：
```bash
cd /home/tanaka/projects/nagaiku-budget-v2

# vite.config.tsを一時的にバックアップ
cp vite.config.ts vite.config.ts.backup

# HTTPモード設定に置き換え
cp vite.config.prod.ts vite.config.ts

# アプリケーション再ビルド
npm run build

# HTTPモードで起動
PORT=3002 node build &
```

### 2. nginx設定ファイルの配置（管理者権限必要）

```bash
# 管理者として実行する必要があります：

# エラーページを配置
sudo cp /home/tanaka/projects/nagaiku-budget-v2/50x.html /var/www/html/

# 完全なnginx設定を配置
sudo cp /home/tanaka/projects/nagaiku-budget-v2/budget2-complete-nginx.conf /etc/nginx/sites-available/budget2-complete

# 既存の設定を無効化（バックアップ）
sudo mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup 2>/dev/null || true

# 新しい設定を有効化
sudo ln -sf /etc/nginx/sites-available/budget2-complete /etc/nginx/sites-enabled/default

# nginx設定テスト
sudo nginx -t

# nginx再起動
sudo systemctl reload nginx
```

### 3. 検証方法

設定後、以下のアクセスが正常動作することを確認：

```bash
# 1. IPアクセス（ルート → /budget2/ にリダイレクト）
curl -I http://160.251.170.97/
# 期待結果: 301 Moved Permanently, Location: http://160.251.170.97/budget2/

# 2. IPアクセス（/budget2/）
curl -I http://160.251.170.97/budget2/
# 期待結果: 200 OK

# 3. ドメインアクセス（HTTPS対応）
curl -I -k https://nagaiku.top/budget2/
# 期待結果: 200 OK（SSL証明書が設定済みの場合）
```

## 設定のポイント

### 1. IPアクセス対応
- `default_server`でIPアクセスを受け付け
- `/` → `/budget2/` 自動リダイレクト
- プロキシ先をHTTPに変更（SSL終端はnginx側）

### 2. エラーハンドリング
- 502/503/504エラー用のカスタムページ
- タイムアウト設定の最適化

### 3. パフォーマンス最適化
- 静的ファイルのキャッシュ設定
- WebSocketサポート

## トラブルシューティング

### アプリケーションが応答しない場合
```bash
# アプリケーションの状態確認
ss -tlnp | grep :3002

# アプリケーション再起動
cd /home/tanaka/projects/nagaiku-budget-v2
PORT=3002 node build &
```

### nginxエラーが発生する場合
```bash
# nginx設定テスト
sudo nginx -t

# nginxログ確認
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/budget2-error.log
```