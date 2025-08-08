#!/bin/bash
# 502 Bad Gateway自動防止・復旧スクリプト v2.0
# 開発環境の安定性を確保し、502エラーを自動的に検知・復旧

# 設定
PORT=3002
CHECK_URL="http://localhost:${PORT}/budget2"
LOG_FILE="logs/502-guardian.log"
MAX_RETRIES=3
CHECK_INTERVAL=30  # 秒
MEMORY_THRESHOLD=80  # メモリ使用率閾値（%）

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ログディレクトリ作成
mkdir -p logs

# ログ関数
log_message() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# メモリ使用率チェック
check_memory() {
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$mem_usage" -gt "$MEMORY_THRESHOLD" ]; then
        log_message "${YELLOW}⚠️ メモリ使用率が高い: ${mem_usage}%${NC}"
        # Viteキャッシュをクリア
        rm -rf node_modules/.vite 2>/dev/null
        rm -rf .svelte-kit 2>/dev/null
        log_message "${GREEN}✓ キャッシュをクリアしました${NC}"
        return 1
    fi
    return 0
}

# プロセスヘルスチェック
check_process_health() {
    local pid=$(lsof -ti:${PORT} 2>/dev/null)
    if [ -z "$pid" ]; then
        return 1
    fi
    
    # CPU使用率チェック（プロセスが暴走していないか）
    local cpu_usage=$(ps -p $pid -o %cpu= 2>/dev/null | xargs)
    if [ ! -z "$cpu_usage" ]; then
        cpu_int=${cpu_usage%.*}
        if [ "$cpu_int" -gt 90 ]; then
            log_message "${YELLOW}⚠️ CPU使用率が高い: ${cpu_usage}%${NC}"
            return 1
        fi
    fi
    
    return 0
}

# HTTPステータスチェック
check_http_status() {
    local status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$CHECK_URL" 2>/dev/null)
    
    case "$status" in
        200|301|302|304|308)
            return 0
            ;;
        502|503|504)
            log_message "${RED}✗ 502/503/504エラー検出: HTTP ${status}${NC}"
            return 1
            ;;
        000)
            log_message "${RED}✗ 接続タイムアウト${NC}"
            return 1
            ;;
        *)
            log_message "${YELLOW}⚠️ 予期しないHTTPステータス: ${status}${NC}"
            return 1
            ;;
    esac
}

# サーバー再起動
restart_server() {
    log_message "${BLUE}🔄 サーバーを再起動中...${NC}"
    
    # 既存プロセスを停止
    pkill -f "vite dev" 2>/dev/null
    lsof -ti:${PORT} | xargs kill -9 2>/dev/null
    
    # キャッシュクリア
    rm -rf node_modules/.vite 2>/dev/null
    rm -rf .svelte-kit 2>/dev/null
    
    sleep 2
    
    # サーバー起動
    nohup npm run dev > logs/dev-server.log 2>&1 &
    local new_pid=$!
    
    sleep 5
    
    # 起動確認
    if check_http_status; then
        log_message "${GREEN}✓ サーバー再起動成功 (PID: ${new_pid})${NC}"
        return 0
    else
        log_message "${RED}✗ サーバー再起動失敗${NC}"
        return 1
    fi
}

# 自動復旧
auto_recover() {
    local retry_count=0
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        retry_count=$((retry_count + 1))
        log_message "${YELLOW}復旧試行 ${retry_count}/${MAX_RETRIES}${NC}"
        
        if restart_server; then
            log_message "${GREEN}✓ 自動復旧成功${NC}"
            return 0
        fi
        
        sleep 5
    done
    
    log_message "${RED}✗ 自動復旧失敗 - 手動介入が必要${NC}"
    return 1
}

# メイン監視ループ
main() {
    log_message "${BLUE}=== 502 Guardian 起動 ===${NC}"
    log_message "監視URL: ${CHECK_URL}"
    log_message "チェック間隔: ${CHECK_INTERVAL}秒"
    
    local consecutive_failures=0
    
    while true; do
        # メモリチェック
        if ! check_memory; then
            consecutive_failures=$((consecutive_failures + 1))
        fi
        
        # プロセスヘルスチェック
        if ! check_process_health; then
            log_message "${YELLOW}⚠️ プロセス異常検出${NC}"
            consecutive_failures=$((consecutive_failures + 1))
        else
            # HTTPステータスチェック
            if check_http_status; then
                if [ $consecutive_failures -gt 0 ]; then
                    log_message "${GREEN}✓ 正常状態に回復${NC}"
                fi
                consecutive_failures=0
            else
                consecutive_failures=$((consecutive_failures + 1))
                log_message "${YELLOW}連続エラー回数: ${consecutive_failures}${NC}"
            fi
        fi
        
        # 連続エラーが2回以上で自動復旧
        if [ $consecutive_failures -ge 2 ]; then
            log_message "${RED}⚠️ 連続エラー検出 - 自動復旧開始${NC}"
            if auto_recover; then
                consecutive_failures=0
            else
                # 復旧失敗時は監視を継続するが、間隔を長くする
                sleep 60
            fi
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# トラップ設定（スクリプト終了時のクリーンアップ）
trap 'log_message "${BLUE}502 Guardian 停止${NC}"; exit 0' SIGINT SIGTERM

# デーモンモードチェック
if [ "$1" = "-d" ] || [ "$1" = "--daemon" ]; then
    # バックグラウンドで実行
    nohup "$0" > /dev/null 2>&1 &
    echo "502 Guardian をバックグラウンドで起動しました (PID: $!)"
    echo "ログ: $LOG_FILE"
else
    # フォアグラウンドで実行
    main
fi