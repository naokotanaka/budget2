#!/bin/bash

# ヘルスチェックスクリプト - 502エラー防止用
# 実行: crontabで1分ごとに実行

LOG_FILE="/home/tanaka/projects/nagaiku-budget-v2/logs/health-check.log"
ERROR_LOG="/home/tanaka/projects/nagaiku-budget-v2/logs/health-error.log"
APP_URL="http://localhost:3002/budget2/"
RESTART_THRESHOLD=3
RESTART_COUNT_FILE="/tmp/nagaiku-budget-v2-restart-count"

# ログ記録関数
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# エラーログ記録関数
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$ERROR_LOG"
}

# 再起動カウンターの初期化
if [ ! -f "$RESTART_COUNT_FILE" ]; then
    echo "0" > "$RESTART_COUNT_FILE"
fi

# アプリケーションの状態確認
check_app_health() {
    # HTTPステータスコードの取得
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$APP_URL")
    
    if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 304 ]; then
        echo "0" > "$RESTART_COUNT_FILE"
        log_message "Health check passed: HTTP $HTTP_STATUS"
        return 0
    else
        log_error "Health check failed: HTTP $HTTP_STATUS"
        return 1
    fi
}

# プロセスの確認
check_process() {
    if systemctl is-active --quiet nagaiku-budget-v2; then
        return 0
    else
        log_error "Service not running"
        return 1
    fi
}

# メモリ使用量の確認
check_memory() {
    PID=$(systemctl show -p MainPID --value nagaiku-budget-v2)
    if [ "$PID" != "0" ]; then
        MEM_USAGE=$(ps -o %mem= -p "$PID" 2>/dev/null | tr -d ' ')
        if [ -n "$MEM_USAGE" ]; then
            MEM_INT=${MEM_USAGE%.*}
            if [ "$MEM_INT" -gt 50 ]; then
                log_error "High memory usage: ${MEM_USAGE}%"
                return 1
            fi
        fi
    fi
    return 0
}

# ポート3002の確認
check_port() {
    if ss -tlnp | grep -q ":3002"; then
        return 0
    else
        log_error "Port 3002 not listening"
        return 1
    fi
}

# サービスの再起動
restart_service() {
    RESTART_COUNT=$(cat "$RESTART_COUNT_FILE")
    RESTART_COUNT=$((RESTART_COUNT + 1))
    echo "$RESTART_COUNT" > "$RESTART_COUNT_FILE"
    
    if [ "$RESTART_COUNT" -gt "$RESTART_THRESHOLD" ]; then
        log_error "Restart threshold exceeded ($RESTART_COUNT > $RESTART_THRESHOLD). Manual intervention required."
        # Slack/メール通知を送信（オプション）
        return 1
    fi
    
    log_message "Attempting service restart (attempt $RESTART_COUNT)"
    sudo systemctl restart nagaiku-budget-v2
    sleep 10  # サービス起動待機
    
    if check_app_health; then
        log_message "Service restarted successfully"
        return 0
    else
        log_error "Service restart failed"
        return 1
    fi
}

# メインチェック処理
main() {
    log_message "Starting health check"
    
    # 1. プロセスチェック
    if ! check_process; then
        log_error "Process check failed"
        restart_service
        exit 1
    fi
    
    # 2. ポートチェック
    if ! check_port; then
        log_error "Port check failed"
        restart_service
        exit 1
    fi
    
    # 3. HTTPヘルスチェック
    if ! check_app_health; then
        log_error "HTTP health check failed"
        restart_service
        exit 1
    fi
    
    # 4. メモリチェック
    if ! check_memory; then
        log_message "Memory usage warning - monitoring"
    fi
    
    log_message "All checks passed"
}

# 実行
main