#!/bin/bash
# 開発環境クリーンスタートスクリプト

echo "🔄 開発環境をクリーンな状態で起動します..."

# 既存プロセスの停止
echo "📋 既存プロセスを停止中..."
pkill -f "vite dev" 2>/dev/null || true
lsof -ti:3002 2>/dev/null | xargs kill -9 2>/dev/null || true

# キャッシュクリア
echo "🗑️ キャッシュをクリア中..."
rm -rf node_modules/.vite 2>/dev/null || true
rm -rf .svelte-kit 2>/dev/null || true

# 少し待機
sleep 2

# 開発サーバー起動
echo "🚀 開発サーバーを起動中..."
npm run dev