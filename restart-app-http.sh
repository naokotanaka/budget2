#!/bin/bash

# 予算管理システムv2 HTTPモード再起動スクリプト
# Usage: ./restart-app-http.sh

set -e

PROJECT_DIR="/home/tanaka/projects/nagaiku-budget-v2"
APP_PORT=3002

echo "=== 予算管理システムv2 HTTPモード再起動 ==="

cd "$PROJECT_DIR"

# 現在のプロセス確認・停止
echo "1. 現在のプロセス確認..."
EXISTING_PID=$(ps aux | grep "node build" | grep -v grep | awk '{print $2}' | head -1)

if [ -n "$EXISTING_PID" ]; then
    echo "既存プロセス (PID: $EXISTING_PID) を停止中..."
    kill "$EXISTING_PID" 2>/dev/null || true
    sleep 3
    
    # 強制終了が必要な場合
    if kill -0 "$EXISTING_PID" 2>/dev/null; then
        echo "強制終了実行..."
        kill -9 "$EXISTING_PID" 2>/dev/null || true
        sleep 2
    fi
    echo "プロセス停止完了"
else
    echo "実行中のプロセスなし"
fi

# vite.config.tsをHTTPモードに設定
echo "2. 設定ファイル更新中..."
if [ -f "vite.config.prod.ts" ]; then
    cp vite.config.ts vite.config.ts.backup.$(date +%Y%m%d_%H%M%S)
    cp vite.config.prod.ts vite.config.ts
    echo "HTTPモード設定に切り替え完了"
else
    echo "警告: vite.config.prod.ts が見つかりません"
fi

# アプリケーション再ビルド
echo "3. アプリケーション再ビルド中..."
npm run build

# HTTPモードで起動
echo "4. HTTPモードで起動中..."
PORT=$APP_PORT nohup node build > app.log 2>&1 &
APP_PID=$!

# 起動確認
sleep 3
if kill -0 $APP_PID 2>/dev/null; then
    echo "✅ アプリケーション起動成功 (PID: $APP_PID)"
    echo "ポート $APP_PORT で HTTPモード実行中"
    
    # 動作確認
    echo "5. 動作確認中..."
    if curl -s --max-time 10 "http://localhost:$APP_PORT/budget2/" > /dev/null; then
        echo "✅ HTTP接続確認: OK"
    else
        echo "❌ HTTP接続確認: NG - アプリケーションがまだ起動中の可能性があります"
    fi
    
    echo ""
    echo "=== 起動完了 ==="
    echo "アクセスURL:"
    echo "- http://localhost:$APP_PORT/budget2/"
    echo "- http://160.251.170.97/budget2/ (nginx設定後)"
    echo ""
    echo "ログ確認: tail -f $PROJECT_DIR/app.log"
    echo "プロセス確認: ps aux | grep 'node build'"
    
else
    echo "❌ アプリケーション起動失敗"
    echo "ログ確認: cat $PROJECT_DIR/app.log"
    exit 1
fi