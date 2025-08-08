#!/bin/bash

# 🔧 自動修復システム
# 目的: ヘルスチェックで検出された問題を自動修復

set -e

echo "🔧 === 自動修復システム開始 ==="
echo "時刻: $(date)"
echo ""

# カラーコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FIXED_COUNT=0

# 1. データベースファイル修復
echo "🗃️  1. データベースファイル修復..."
if [ ! -f "database.sqlite" ] || [ ! -s "database.sqlite" ]; then
    echo "   データベースファイルを初期化中..."
    touch database.sqlite
    # 基本テーブル作成
    sqlite3 database.sqlite << 'EOF'
CREATE TABLE IF NOT EXISTS grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grantCode TEXT UNIQUE,
  totalAmount INTEGER,
  startDate TEXT,
  endDate TEXT,
  status TEXT CHECK(status IN ('in_progress', 'completed', 'reported')) DEFAULT 'in_progress',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  budgetedAmount INTEGER,
  usedAmount INTEGER DEFAULT 0,
  note TEXT,
  grantId INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grantId) REFERENCES grants (id) ON DELETE SET NULL
);
EOF
    echo -e "${GREEN}   ✅ データベース初期化完了${NC}"
    FIXED_COUNT=$((FIXED_COUNT + 1))
else
    echo -e "${GREEN}   ✅ データベースファイル正常${NC}"
fi

# 2. 必要パッケージの自動インストール
echo "📦 2. パッケージ依存関係修復..."
REQUIRED_PACKAGES=("better-sqlite3" "tabulator-tables" "zod")
MISSING_PACKAGES=()

for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if ! npm list "$pkg" >/dev/null 2>&1; then
        MISSING_PACKAGES+=("$pkg")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo "   不足パッケージをインストール中: ${MISSING_PACKAGES[*]}"
    npm install "${MISSING_PACKAGES[@]}"
    echo -e "${GREEN}   ✅ パッケージインストール完了${NC}"
    FIXED_COUNT=$((FIXED_COUNT + 1))
else
    echo -e "${GREEN}   ✅ 全パッケージインストール済み${NC}"
fi

# 3. ポート解放（必要時）
echo "🔌 3. ポート状態修復..."
if ss -tlnp | grep -q ":3002"; then
    PID=$(ss -tlnp | grep ":3002" | awk '{print $6}' | grep -o '[0-9]*' | head -1)
    # プロセスが生きているかチェック
    if ! curl -s --max-time 3 http://localhost:3002/budget2/ >/dev/null 2>&1; then
        echo "   応答しないプロセス($PID)を終了中..."
        kill -9 "$PID" 2>/dev/null || true
        sleep 2
        echo -e "${GREEN}   ✅ 不正プロセス終了完了${NC}"
        FIXED_COUNT=$((FIXED_COUNT + 1))
    else
        echo -e "${GREEN}   ✅ サーバー正常応答中${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  ポート3002未使用（サーバー起動が必要）${NC}"
fi

# 4. ビルドキャッシュクリア
echo "🔨 4. ビルドキャッシュクリア..."
if [ -d ".svelte-kit" ]; then
    rm -rf .svelte-kit
    echo -e "${GREEN}   ✅ ビルドキャッシュクリア完了${NC}"
    FIXED_COUNT=$((FIXED_COUNT + 1))
fi

# 5. Node.js プロセスクリーンアップ
echo "🧹 5. プロセスクリーンアップ..."
ZOMBIE_PROCESSES=$(ps aux | grep -E "node.*vite|node.*3002" | grep -v grep | wc -l)
if [ "$ZOMBIE_PROCESSES" -gt 1 ]; then
    echo "   余剰なNode.jsプロセスを終了中..."
    pkill -f "vite.*3002" 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}   ✅ プロセスクリーンアップ完了${NC}"
    FIXED_COUNT=$((FIXED_COUNT + 1))
else
    echo -e "${GREEN}   ✅ プロセス状態正常${NC}"
fi

# 修復結果
echo ""
echo "📊 === 自動修復結果 ==="
if [ $FIXED_COUNT -gt 0 ]; then
    echo -e "${GREEN}🎉 ${FIXED_COUNT}件の問題を修復しました${NC}"
    echo ""
    echo -e "${BLUE}🚀 次のステップ:${NC}"
    echo "   1. npm run dev でサーバー起動"
    echo "   2. ブラウザで https://nagaiku.top/budget2/grants にアクセス"
    echo "   3. 青い「CSVインポート（新UI）」ボタンをテスト"
else
    echo -e "${GREEN}✅ 修復の必要な問題はありませんでした${NC}"
fi

echo ""
echo "⏰ 修復完了: $(date)"
echo ""

# 修復後の再チェック推奨
echo -e "${YELLOW}💡 修復後の確認: ./dev-tools/health-check.sh${NC}"

exit 0