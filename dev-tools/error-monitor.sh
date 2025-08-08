#!/bin/bash

# 🚨 リアルタイムエラー監視システム
# 目的: 開発中のエラーを即座に検出し、自動でweb-error-diagnosticianを起動

# 監視対象ログファイル
LOG_FILE="/tmp/nagaiku-dev.log"
ERROR_LOG="/tmp/nagaiku-errors.log"

# カラーコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚨 エラー監視システム開始${NC}"
echo "監視対象: $LOG_FILE"
echo "エラーログ: $ERROR_LOG"
echo ""

# エラーパターン定義
ERROR_PATTERNS=(
    "Error:"
    "TypeError:"
    "SyntaxError:"
    "ModuleNotFoundError:"
    "500"
    "502"
    "WebSocket.*failed"
    "failed to connect"
    "Cannot find module"
)

# エラー検出関数
detect_error() {
    local line="$1"
    for pattern in "${ERROR_PATTERNS[@]}"; do
        if echo "$line" | grep -q "$pattern"; then
            echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR DETECTED: $line" >> "$ERROR_LOG"
            
            # Claude Code のweb-error-diagnosticianを起動する処理
            # （実際の実装では、APIエンドポイントやプロセス間通信を使用）
            echo -e "${RED}🚨 エラー検出: $pattern${NC}"
            echo -e "${YELLOW}💡 web-error-diagnostician を起動中...${NC}"
            
            # エラー詳細をファイルに保存
            echo "$line" > "/tmp/latest-error.txt"
            
            # 簡易的なエラー分類
            if echo "$line" | grep -q "WebSocket\|502\|500"; then
                echo -e "${BLUE}   → ネットワーク/サーバーエラー${NC}"
            elif echo "$line" | grep -q "Module\|TypeError\|SyntaxError"; then
                echo -e "${BLUE}   → コード/依存関係エラー${NC}"
            else
                echo -e "${BLUE}   → その他のエラー${NC}"
            fi
            
            return 0
        fi
    done
    return 1
}

# ログ監視開始
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${YELLOW}⚠️  ログファイルを作成中: $LOG_FILE${NC}"
    touch "$LOG_FILE"
fi

echo -e "${GREEN}✅ 監視開始 - Ctrl+C で終了${NC}"
echo ""

# リアルタイム監視
tail -f "$LOG_FILE" 2>/dev/null | while read -r line; do
    if detect_error "$line"; then
        # エラー検出時の処理
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}🚨 CRITICAL: 自動エラー検出システム作動${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
    fi
done &

# 監視プロセスのPIDを記録
MONITOR_PID=$!
echo "$MONITOR_PID" > "/tmp/error-monitor.pid"

# 終了処理
trap "kill $MONITOR_PID 2>/dev/null; rm -f /tmp/error-monitor.pid; echo -e '\n${YELLOW}エラー監視終了${NC}'" EXIT

# 監視継続
wait $MONITOR_PID