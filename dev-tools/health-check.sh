#!/bin/bash

# 🏥 開発環境ヘルスチェックシステム
# 目的: 開発開始前の環境問題を自動検出・修復

set -e

echo "🏥 === 開発環境ヘルスチェック開始 ==="
echo "時刻: $(date)"
echo ""

# カラーコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ヘルスチェック結果
HEALTH_SCORE=100
ISSUES=()

# 1. ポート状態チェック
echo "🔍 1. ポート3002状態チェック..."
if ss -tlnp | grep -q ":3002"; then
    PID=$(ss -tlnp | grep ":3002" | awk '{print $6}' | grep -o '[0-9]*' | head -1)
    echo -e "${GREEN}✅ ポート3002稼働中 (PID: $PID)${NC}"
else
    echo -e "${YELLOW}⚠️  ポート3002未使用${NC}"
    HEALTH_SCORE=$((HEALTH_SCORE - 20))
    ISSUES+=("ポート3002が未使用")
fi

# 2. データベースファイルチェック
echo "🗃️  2. データベース状態チェック..."
if [ -f "database.sqlite" ]; then
    SIZE=$(stat -c%s "database.sqlite")
    if [ $SIZE -gt 0 ]; then
        echo -e "${GREEN}✅ データベース正常 (${SIZE}バイト)${NC}"
    else
        echo -e "${YELLOW}⚠️  データベースファイルが空${NC}"
        HEALTH_SCORE=$((HEALTH_SCORE - 15))
        ISSUES+=("データベースファイルが空")
    fi
else
    echo -e "${RED}❌ データベースファイル不在${NC}"
    HEALTH_SCORE=$((HEALTH_SCORE - 30))
    ISSUES+=("データベースファイル不在")
fi

# 3. 依存関係チェック
echo "📦 3. 重要パッケージチェック..."
REQUIRED_PACKAGES=("better-sqlite3" "tabulator-tables" "zod")
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if npm list "$pkg" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $pkg インストール済み${NC}"
    else
        echo -e "${RED}❌ $pkg 未インストール${NC}"
        HEALTH_SCORE=$((HEALTH_SCORE - 10))
        ISSUES+=("$pkg未インストール")
    fi
done

# 4. ビルド状態チェック
echo "🔨 4. ビルド状態チェック..."
if [ -d ".svelte-kit" ]; then
    echo -e "${GREEN}✅ ビルド済み${NC}"
else
    echo -e "${YELLOW}⚠️  ビルドが必要${NC}"
    HEALTH_SCORE=$((HEALTH_SCORE - 5))
    ISSUES+=("ビルドが必要")
fi

# 5. 構文エラーチェック（簡易）
echo "📝 5. 基本構文チェック..."
SYNTAX_ERRORS=0
find src -name "*.svelte" -exec grep -l "{/if}.*{/if}" {} \; 2>/dev/null | while read file; do
    if [ -n "$file" ]; then
        echo -e "${RED}❌ 構文エラーの疑い: $file${NC}"
        SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
    fi
done

if [ $SYNTAX_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ 基本構文OK${NC}"
else
    echo -e "${RED}❌ 構文エラー検出 ($SYNTAX_ERRORS件)${NC}"
    HEALTH_SCORE=$((HEALTH_SCORE - 25))
    ISSUES+=("構文エラー検出")
fi

# 6. ネットワーク接続チェック
echo "🌐 6. ネットワーク接続チェック..."
if curl -s --max-time 5 http://localhost:3002/budget2/ >/dev/null 2>&1; then
    echo -e "${GREEN}✅ アプリケーション応答OK${NC}"
else
    echo -e "${YELLOW}⚠️  アプリケーション応答なし${NC}"
    HEALTH_SCORE=$((HEALTH_SCORE - 20))
    ISSUES+=("アプリケーション応答なし")
fi

echo ""
echo "📊 === ヘルスチェック結果 ==="

# スコア判定
if [ $HEALTH_SCORE -ge 90 ]; then
    echo -e "${GREEN}🎉 優秀 (${HEALTH_SCORE}/100): 開発開始可能${NC}"
elif [ $HEALTH_SCORE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  注意 (${HEALTH_SCORE}/100): 軽微な問題あり${NC}"
else
    echo -e "${RED}🚨 危険 (${HEALTH_SCORE}/100): 修復が必要${NC}"
fi

# 問題リスト表示
if [ ${#ISSUES[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}🔧 検出された問題:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo "   • $issue"
    done
    echo ""
    echo -e "${BLUE}💡 修復コマンド: ./dev-tools/auto-fix.sh${NC}"
fi

echo ""
echo "⏰ チェック完了: $(date)"
echo "🚀 問題なければ開発開始: npm run dev"
echo ""

exit 0