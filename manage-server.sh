#!/bin/bash

# ==================================================
# SvelteKit Server Management Script
# 高度なプロセス管理、ヘルスチェック、自動復旧機能付き
# ==================================================

PROJECT_NAME="nagaiku-budget-v2"
PROJECT_DIR="/home/tanaka/projects/nagaiku-budget-v2"
SESSION_NAME="budget-ssl"
PORT=3002
HEALTH_CHECK_URL="https://localhost:${PORT}/budget2/"
LOG_FILE="${PROJECT_DIR}/logs/server.log"
PID_FILE="${PROJECT_DIR}/tmp/server.pid"

# ディレクトリ作成
mkdir -p "${PROJECT_DIR}/logs" "${PROJECT_DIR}/tmp"

# 色付きメッセージ関数
print_message() {
    local type=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $type in
        "info")    echo -e "\e[32m[INFO]\e[0m  [$timestamp] $message" ;;
        "warn")    echo -e "\e[33m[WARN]\e[0m  [$timestamp] $message" ;;
        "error")   echo -e "\e[31m[ERROR]\e[0m [$timestamp] $message" ;;
        "success") echo -e "\e[36m[OK]\e[0m    [$timestamp] $message" ;;
    esac
}

# PIDファイルからプロセスIDを取得
get_server_pid() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "$pid"
        else
            rm -f "$PID_FILE"
        fi
    fi
}

# サーバーのヘルスチェック
health_check() {
    local timeout=${1:-10}
    local response_code
    
    response_code=$(timeout $timeout curl -k -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" 2>/dev/null)
    
    if [ "$response_code" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# サーバー状態チェック
check_status() {
    local pid=$(get_server_pid)
    
    print_message "info" "サーバー状態をチェックしています..."
    
    if [ -n "$pid" ]; then
        print_message "info" "プロセス (PID: $pid) が実行中です"
        
        if health_check 5; then
            print_message "success" "サーバーは正常に動作しています"
            print_message "info" "アクセス可能URL:"
            print_message "info" "  - $HEALTH_CHECK_URL"
            print_message "info" "  - https://nagaiku.top/budget2/"
            return 0
        else
            print_message "warn" "プロセスは実行中ですが、ヘルスチェックに失敗しました"
            return 1
        fi
    else
        print_message "warn" "サーバープロセスが実行されていません"
        return 1
    fi
}

# サーバー起動
start_server() {
    local pid=$(get_server_pid)
    
    if [ -n "$pid" ]; then
        print_message "info" "サーバーは既に実行中です (PID: $pid)"
        check_status
        return
    fi
    
    print_message "info" "サーバーを起動しています..."
    
    # ビルドの実行
    print_message "info" "アプリケーションをビルドしています..."
    cd "$PROJECT_DIR"
    if ! npm run build >> "$LOG_FILE" 2>&1; then
        print_message "error" "ビルドに失敗しました。詳細はログを確認してください: $LOG_FILE"
        return 1
    fi
    print_message "success" "ビルド完了"
    
    # 既存のtmuxセッションを停止
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
    
    # 新しいtmuxセッションでサーバーを起動
    tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR" \
        "PORT=$PORT node server.js 2>&1 | tee -a '$LOG_FILE'"
    
    sleep 3
    
    # PIDを取得して保存
    local server_pid=$(pgrep -f "node server.js")
    if [ -n "$server_pid" ]; then
        echo "$server_pid" > "$PID_FILE"
        print_message "success" "サーバーが起動しました (PID: $server_pid)"
        
        # ヘルスチェック実行
        print_message "info" "ヘルスチェックを実行しています..."
        sleep 2
        
        if health_check 15; then
            print_message "success" "サーバーは正常に動作しています"
            print_message "info" "アクセス可能URL:"
            print_message "info" "  - $HEALTH_CHECK_URL"
            print_message "info" "  - https://nagaiku.top/budget2/"
            print_message "info" "ログ表示: tmux attach -t $SESSION_NAME"
            return 0
        else
            print_message "error" "ヘルスチェックに失敗しました"
            return 1
        fi
    else
        print_message "error" "サーバーの起動に失敗しました"
        return 1
    fi
}

# サーバー停止
stop_server() {
    local pid=$(get_server_pid)
    
    if [ -z "$pid" ]; then
        print_message "info" "サーバーは実行されていません"
        return 0
    fi
    
    print_message "info" "サーバーを停止しています... (PID: $pid)"
    
    # Graceful shutdown
    kill -TERM "$pid" 2>/dev/null
    
    # 最大10秒待機
    local count=0
    while [ $count -lt 10 ] && kill -0 "$pid" 2>/dev/null; do
        sleep 1
        count=$((count + 1))
    done
    
    # まだ実行中の場合は強制終了
    if kill -0 "$pid" 2>/dev/null; then
        print_message "warn" "Graceful shutdownに失敗、強制終了を実行します"
        kill -KILL "$pid" 2>/dev/null
    fi
    
    # tmuxセッションも停止
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
    
    # PIDファイル削除
    rm -f "$PID_FILE"
    
    print_message "success" "サーバーを停止しました"
}

# サーバー再起動
restart_server() {
    print_message "info" "サーバーを再起動しています..."
    stop_server
    sleep 2
    start_server
}

# 連続ヘルスチェック（監視モード）
monitor_server() {
    local interval=${1:-30}
    local max_failures=${2:-3}
    local failure_count=0
    
    print_message "info" "サーバー監視を開始しています (間隔: ${interval}秒, 最大失敗回数: ${max_failures})"
    print_message "info" "監視停止: Ctrl+C"
    
    while true; do
        if health_check 10; then
            failure_count=0
            print_message "success" "ヘルスチェック OK"
        else
            failure_count=$((failure_count + 1))
            print_message "error" "ヘルスチェック失敗 ($failure_count/$max_failures)"
            
            if [ $failure_count -ge $max_failures ]; then
                print_message "error" "連続失敗回数が上限に達しました。サーバーを再起動します"
                restart_server
                failure_count=0
                sleep 30  # 再起動後の安定化待機
            fi
        fi
        
        sleep $interval
    done
}

# ログ表示
show_logs() {
    local lines=${1:-50}
    
    if [ -f "$LOG_FILE" ]; then
        print_message "info" "最新 $lines 行のログを表示します:"
        echo "=============================================="
        tail -n $lines "$LOG_FILE"
        echo "=============================================="
    else
        print_message "warn" "ログファイルが見つかりません: $LOG_FILE"
    fi
}

# tmuxセッションに接続
attach_session() {
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        print_message "info" "tmuxセッションに接続しています..."
        tmux attach -t "$SESSION_NAME"
    else
        print_message "warn" "tmuxセッション '$SESSION_NAME' が見つかりません"
    fi
}

# 使用方法表示
show_usage() {
    echo "使用方法: $0 {start|stop|restart|status|monitor|logs|attach|help}"
    echo ""
    echo "コマンド:"
    echo "  start     - サーバーを起動"
    echo "  stop      - サーバーを停止"
    echo "  restart   - サーバーを再起動"
    echo "  status    - サーバーの状態確認"
    echo "  monitor   - 継続的な監視モード (デフォルト30秒間隔)"
    echo "  logs      - ログを表示 (デフォルト50行)"
    echo "  attach    - tmuxセッションに接続"
    echo "  help      - このヘルプを表示"
    echo ""
    echo "オプション例:"
    echo "  $0 monitor 60     # 60秒間隔で監視"
    echo "  $0 logs 100       # 最新100行のログを表示"
}

# メイン処理
case "${1:-help}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        check_status
        ;;
    monitor)
        monitor_server "${2:-30}" "${3:-3}"
        ;;
    logs)
        show_logs "${2:-50}"
        ;;
    attach)
        attach_session
        ;;
    help|*)
        show_usage
        ;;
esac