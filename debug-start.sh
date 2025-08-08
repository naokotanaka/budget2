#!/bin/bash

echo "=== 助成金管理システム デバッグ起動スクリプト ==="
echo ""

# ポートチェック
echo "1. ポート3002の状態確認..."
if lsof -i:3002 > /dev/null 2>&1; then
    echo "   警告: ポート3002が使用中です"
    echo "   使用中のプロセス:"
    lsof -i:3002
    echo ""
    echo "   既存プロセスを終了しています..."
    pkill -f "vite dev" 2>/dev/null || true
    sleep 2
fi

# データベースチェック
echo "2. データベースファイル確認..."
DB_PATH="/home/tanaka/projects/nagaiku-budget-v2/database.sqlite"
if [ -f "$DB_PATH" ]; then
    echo "   データベースファイル存在: $DB_PATH"
    echo "   ファイルサイズ: $(ls -lh $DB_PATH | awk '{print $5}')"
else
    echo "   データベースファイルが存在しません。作成中..."
    touch "$DB_PATH"
    chmod 666 "$DB_PATH"
    echo "   データベースファイル作成完了"
fi

# node_modules確認
echo "3. 依存関係確認..."
if [ ! -d "node_modules" ]; then
    echo "   node_modulesが存在しません。インストール中..."
    npm install
else
    echo "   node_modules存在確認OK"
fi

# better-sqlite3確認
echo "4. better-sqlite3モジュール確認..."
if npm ls better-sqlite3 > /dev/null 2>&1; then
    echo "   better-sqlite3インストール済み"
else
    echo "   better-sqlite3が見つかりません。再インストール中..."
    npm install better-sqlite3
fi

echo ""
echo "5. 開発サーバー起動..."
echo "   URL: http://localhost:3002/budget2/"
echo "   終了するには Ctrl+C を押してください"
echo ""
echo "=== サーバーログ開始 ==="
echo ""

# 開発サーバー起動（詳細ログ付き）
npm run dev