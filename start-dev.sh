#!/bin/bash
# 開発サーバー起動スクリプト

# プロジェクトディレクトリに移動
cd /home/tanaka/projects/nagaiku-budget-v2

# 既存のプロセスを停止
echo "既存のプロセスを停止中..."
lsof -i :3002 -t | xargs -r kill -15 2>/dev/null
sleep 2

# 強制終了が必要な場合
lsof -i :3002 -t | xargs -r kill -9 2>/dev/null
sleep 1

# 開発サーバーを起動
echo "開発サーバーを起動中..."
npm run dev &
DEV_PID=$!

# サーバーの起動を待つ
sleep 5

# 状態を確認
if ps -p $DEV_PID > /dev/null; then
    echo "✅ 開発サーバーが正常に起動しました (PID: $DEV_PID)"
    echo "   URL: http://nagaiku.top:3002/budget2"
    echo "   ローカル: http://localhost:3002/budget2"
else
    echo "❌ 開発サーバーの起動に失敗しました"
    exit 1
fi