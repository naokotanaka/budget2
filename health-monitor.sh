#!/bin/bash

# ==================================================
# Health Monitor & Auto Recovery System
# SvelteKit Server 自動監視・復旧システム
# ==================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/monitor.conf"
LOCK_FILE="/tmp/nagaiku-budget-monitor.lock"
LOG_FILE="${SCRIPT_DIR}/logs/monitor.log"

# デフォルト設定
DEFAULT_CHECK_INTERVAL=60
DEFAULT_HEALTH_URL="https://localhost:3002/budget2/"
DEFAULT_MAX_FAILURES=3
DEFAULT_RESTART_COOLDOWN=300
DEFAULT_NOTIFICATION_WEBHOOK=""

# ログ関数
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# 設定ファイル読み込み
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
    fi
    
    # デフォルト値設定
    CHECK_INTERVAL=${CHECK_INTERVAL:-$DEFAULT_CHECK_INTERVAL}
    HEALTH_URL=${HEALTH_URL:-$DEFAULT_HEALTH_URL}
    MAX_FAILURES=${MAX_FAILURES:-$DEFAULT_MAX_FAILURES}
    RESTART_COOLDOWN=${RESTART_COOLDOWN:-$DEFAULT_RESTART_COOLDOWN}
    NOTIFICATION_WEBHOOK=${NOTIFICATION_WEBHOOK:-$DEFAULT_NOTIFICATION_WEBHOOK}
}

# Slack/Discord通知送信
send_notification() {
    local title=$1
    local message=$2
    local color=$3
    
    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        local payload
        if [[ "$NOTIFICATION_WEBHOOK" =~ discord ]]; then
            # Discord Webhook
            payload="{\"embeds\": [{\"title\": \"$title\", \"description\": \"$message\", \"color\": $color, \"timestamp\": \"$(date -Iseconds)\"}]}"
        else
            # Slack Webhook
            payload="{\"text\": \"$title\", \"attachments\": [{\"color\": \"$color\", \"text\": \"$message\", \"ts\": $(date +%s)}]}"
        fi
        
        curl -X POST -H "Content-Type: application/json" -d "$payload" "$NOTIFICATION_WEBHOOK" &>/dev/null || true
    fi
}

# ヘルスチェック実行
perform_health_check() {
    local response_code
    local response_time
    
    # HTTPステータスとレスポンス時間を取得
    local curl_output
    curl_output=$(timeout 30 curl -k -s -w "%{http_code}:%{time_total}" -o /dev/null "$HEALTH_URL" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$curl_output" ]; then
        response_code=$(echo "$curl_output" | cut -d: -f1)
        response_time=$(echo "$curl_output" | cut -d: -f2)
        
        if [ "$response_code" = "200" ]; then
            log_message "INFO" "ヘルスチェック成功 (${response_time}s)"
            return 0
        else
            log_message "ERROR" "ヘルスチェック失敗: HTTP $response_code"
            return 1
        fi
    else
        log_message "ERROR" "ヘルスチェック失敗: 接続エラー"
        return 1
    fi
}

# サーバー再起動
restart_server() {
    log_message "WARN" "サーバー再起動を実行中..."
    send_notification "🔄 Server Restart" "Nagaiku Budget v2 サーバーを再起動しています" "16776960"
    
    if "${SCRIPT_DIR}/manage-server.sh" restart; then
        log_message "INFO" "サーバー再起動成功"
        send_notification "✅ Server Restarted" "Nagaiku Budget v2 サーバーの再起動が完了しました" "65280"
        return 0
    else
        log_message "ERROR" "サーバー再起動失敗"
        send_notification "❌ Restart Failed" "Nagaiku Budget v2 サーバーの再起動に失敗しました" "16711680"
        return 1
    fi
}

# メイン監視ループ
main_monitor_loop() {
    local failure_count=0
    local last_restart_time=0
    local consecutive_success=0
    
    log_message "INFO" "ヘルスモニター開始 (間隔: ${CHECK_INTERVAL}秒, 最大失敗: $MAX_FAILURES)"
    send_notification "🚀 Monitor Started" "Nagaiku Budget v2 ヘルスモニターを開始しました" "65280"
    
    while true; do
        if perform_health_check; then
            failure_count=0
            consecutive_success=$((consecutive_success + 1))
            
            # 復旧後の初回成功通知
            if [ $consecutive_success -eq 1 ] && [ $last_restart_time -gt 0 ]; then
                local current_time=$(date +%s)
                local downtime=$((current_time - last_restart_time))
                send_notification "🎉 Service Recovered" "サーバーが復旧しました (ダウンタイム: ${downtime}秒)" "65280"
            fi
        else
            failure_count=$((failure_count + 1))
            consecutive_success=0
            
            log_message "ERROR" "連続失敗回数: $failure_count/$MAX_FAILURES"
            
            if [ $failure_count -ge $MAX_FAILURES ]; then
                local current_time=$(date +%s)
                local time_since_restart=$((current_time - last_restart_time))
                
                if [ $time_since_restart -ge $RESTART_COOLDOWN ]; then
                    log_message "WARN" "最大失敗回数に達しました。再起動を実行します"
                    
                    if restart_server; then
                        last_restart_time=$current_time
                        failure_count=0
                        
                        # 再起動後の安定化待機
                        log_message "INFO" "再起動後の安定化を待機中... (60秒)"
                        sleep 60
                    else
                        log_message "ERROR" "再起動に失敗しました。次のチェックまで待機します"
                    fi
                else
                    local remaining_cooldown=$((RESTART_COOLDOWN - time_since_restart))
                    log_message "WARN" "再起動クールダウン中です (残り: ${remaining_cooldown}秒)"
                fi
            fi
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# 既存プロセスチェック
check_existing_process() {
    if [ -f "$LOCK_FILE" ]; then
        local existing_pid=$(cat "$LOCK_FILE")
        if kill -0 "$existing_pid" 2>/dev/null; then
            log_message "ERROR" "監視プロセスは既に実行中です (PID: $existing_pid)"
            exit 1
        else
            rm -f "$LOCK_FILE"
        fi
    fi
}

# シグナルハンドラー
cleanup() {
    log_message "INFO" "ヘルスモニターを停止しています..."
    send_notification "🛑 Monitor Stopped" "Nagaiku Budget v2 ヘルスモニターを停止しました" "16776960"
    rm -f "$LOCK_FILE"
    exit 0
}

# デフォルト設定ファイル作成
create_default_config() {
    cat > "$CONFIG_FILE" << EOF
# Nagaiku Budget v2 ヘルスモニター設定

# チェック間隔（秒）
CHECK_INTERVAL=60

# ヘルスチェック URL
HEALTH_URL="https://localhost:3002/budget2/"

# 最大連続失敗回数
MAX_FAILURES=3

# 再起動後のクールダウン時間（秒）
RESTART_COOLDOWN=300

# 通知Webhook URL（Slack/Discord）
# NOTIFICATION_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
# NOTIFICATION_WEBHOOK="https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"
NOTIFICATION_WEBHOOK=""

# ログレベル（DEBUG, INFO, WARN, ERROR）
LOG_LEVEL="INFO"
EOF
    
    log_message "INFO" "デフォルト設定ファイルを作成しました: $CONFIG_FILE"
}

# 使用方法表示
show_usage() {
    echo "使用方法: $0 {start|stop|status|config|help}"
    echo ""
    echo "コマンド:"
    echo "  start   - ヘルスモニターを開始"
    echo "  stop    - ヘルスモニターを停止"
    echo "  status  - 監視状態を確認"
    echo "  config  - デフォルト設定ファイルを作成"
    echo "  help    - このヘルプを表示"
    echo ""
    echo "設定ファイル: $CONFIG_FILE"
    echo "ログファイル: $LOG_FILE"
}

# メイン処理
main() {
    # ディレクトリ作成
    mkdir -p "$(dirname "$LOG_FILE")"
    
    case "${1:-help}" in
        start)
            check_existing_process
            load_config
            
            # PIDファイル作成
            echo $$ > "$LOCK_FILE"
            
            # シグナルハンドラー設定
            trap cleanup INT TERM
            
            main_monitor_loop
            ;;
        stop)
            if [ -f "$LOCK_FILE" ]; then
                local pid=$(cat "$LOCK_FILE")
                if kill -0 "$pid" 2>/dev/null; then
                    kill -TERM "$pid"
                    echo "ヘルスモニターを停止しました (PID: $pid)"
                else
                    echo "ヘルスモニタープロセスが見つかりません"
                    rm -f "$LOCK_FILE"
                fi
            else
                echo "ヘルスモニターは実行されていません"
            fi
            ;;
        status)
            if [ -f "$LOCK_FILE" ]; then
                local pid=$(cat "$LOCK_FILE")
                if kill -0 "$pid" 2>/dev/null; then
                    echo "ヘルスモニターは実行中です (PID: $pid)"
                    load_config
                    echo "設定: チェック間隔=${CHECK_INTERVAL}秒, URL=$HEALTH_URL"
                else
                    echo "PIDファイルは存在しますが、プロセスが見つかりません"
                    rm -f "$LOCK_FILE"
                fi
            else
                echo "ヘルスモニターは実行されていません"
            fi
            ;;
        config)
            create_default_config
            ;;
        help|*)
            show_usage
            ;;
    esac
}

main "$@"