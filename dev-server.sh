#!/bin/bash

# ==================================================
# 開発サーバー統合管理スクリプト
# ポート競合自動解決、開発/本番モード切り替え対応
# ==================================================

PROJECT_NAME="nagaiku-budget-v2"
PROJECT_DIR="/home/tanaka/projects/nagaiku-budget-v2"
DEV_PORT=3002
PROD_PORT=3002
SESSION_NAME_DEV="budget-dev"
SESSION_NAME_PROD="budget-ssl"
PID_FILE_DEV="${PROJECT_DIR}/tmp/dev-server.pid"
PID_FILE_PROD="${PROJECT_DIR}/tmp/server.pid"
LOG_DIR="${PROJECT_DIR}/logs"

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
        "debug")   echo -e "\e[35m[DEBUG]\e[0m [$timestamp] $message" ;;
    esac
}

# ポート使用状況の確認と解放
clean_port() {
    local port=$1
    local force=$2
    
    print_message "info" "ポート $port の使用状況を確認中..."
    
    # ポートを使用中のプロセスを取得
    local pids=$(lsof -ti :$port 2>/dev/null)
    
    if [ -z "$pids" ]; then
        print_message "success" "ポート $port は利用可能です"
        return 0
    fi
    
    print_message "warn" "ポート $port は以下のプロセスが使用中:"
    lsof -i :$port | grep LISTEN
    
    if [ "$force" = "force" ]; then
        print_message "info" "強制的にポートを解放します..."
        for pid in $pids; do
            # プロセス情報を表示
            local proc_info=$(ps -p $pid -o comm= 2>/dev/null)
            print_message "debug" "終了するプロセス: PID=$pid ($proc_info)"
            
            # Graceful shutdown
            kill -TERM $pid 2>/dev/null
            sleep 2
            
            # まだ実行中なら強制終了
            if kill -0 $pid 2>/dev/null; then
                kill -KILL $pid 2>/dev/null
            fi
        done
        
        # tmuxセッションもクリーンアップ
        tmux kill-session -t "$SESSION_NAME_DEV" 2>/dev/null || true
        tmux kill-session -t "$SESSION_NAME_PROD" 2>/dev/null || true
        
        # PIDファイル削除
        rm -f "$PID_FILE_DEV" "$PID_FILE_PROD"
        
        print_message "success" "ポート $port を解放しました"
        return 0
    else
        print_message "error" "ポート $port が使用中です。--force オプションで強制解放できます"
        return 1
    fi
}

# 開発サーバー起動（Vite）
start_dev() {
    local force=${1:-""}
    
    print_message "info" "=== 開発サーバー起動準備 ==="
    
    # ポートチェックと解放
    if ! clean_port $DEV_PORT "$force"; then
        print_message "error" "ポート解放に失敗しました"
        print_message "info" "使用方法: $0 dev --force"
        return 1
    fi
    
    # 依存関係の確認とインストール
    print_message "info" "依存関係を確認中..."
    cd "$PROJECT_DIR"
    
    if [ ! -d "node_modules" ]; then
        print_message "info" "依存関係をインストール中..."
        npm install
    fi
    
    # 既存セッションを削除
    tmux kill-session -t "$SESSION_NAME_DEV" 2>/dev/null || true
    
    # 新しいtmuxセッションで開発サーバーを起動
    print_message "info" "Vite開発サーバーを起動中..."
    tmux new-session -d -s "$SESSION_NAME_DEV" -c "$PROJECT_DIR" \
        "npm run dev -- --port $DEV_PORT --host 2>&1 | tee -a '$LOG_DIR/dev-server.log'"
    
    # 起動確認
    sleep 3
    
    # PIDを取得
    local dev_pid=$(lsof -ti :$DEV_PORT 2>/dev/null | head -1)
    if [ -n "$dev_pid" ]; then
        echo "$dev_pid" > "$PID_FILE_DEV"
        print_message "success" "開発サーバーが起動しました (PID: $dev_pid)"
        print_message "info" "==================================="
        print_message "info" "開発サーバー: http://localhost:$DEV_PORT"
        print_message "info" "ログ表示: tmux attach -t $SESSION_NAME_DEV"
        print_message "info" "==================================="
        
        # ブラウザを自動で開く（オプション）
        if command -v xdg-open &> /dev/null; then
            sleep 2
            xdg-open "http://localhost:$DEV_PORT" 2>/dev/null &
        fi
        
        return 0
    else
        print_message "error" "開発サーバーの起動に失敗しました"
        return 1
    fi
}

# 本番サーバー起動（SSL対応）
start_prod() {
    local force=${1:-""}
    
    print_message "info" "=== 本番サーバー起動準備 ==="
    
    # ポートチェックと解放
    if ! clean_port $PROD_PORT "$force"; then
        print_message "error" "ポート解放に失敗しました"
        print_message "info" "使用方法: $0 prod --force"
        return 1
    fi
    
    # 既存のmanage-server.shを使用
    if [ -f "${PROJECT_DIR}/manage-server.sh" ]; then
        print_message "info" "本番サーバーを起動中..."
        bash "${PROJECT_DIR}/manage-server.sh" start
    else
        print_message "error" "manage-server.sh が見つかりません"
        return 1
    fi
}

# サーバー停止
stop_all() {
    print_message "info" "すべてのサーバーを停止中..."
    
    # 開発サーバー停止
    if [ -f "$PID_FILE_DEV" ]; then
        local dev_pid=$(cat "$PID_FILE_DEV")
        if kill -0 "$dev_pid" 2>/dev/null; then
            print_message "info" "開発サーバーを停止中 (PID: $dev_pid)"
            kill -TERM "$dev_pid" 2>/dev/null
            rm -f "$PID_FILE_DEV"
        fi
    fi
    
    # 本番サーバー停止
    if [ -f "${PROJECT_DIR}/manage-server.sh" ]; then
        bash "${PROJECT_DIR}/manage-server.sh" stop
    fi
    
    # tmuxセッションをクリーンアップ
    tmux kill-session -t "$SESSION_NAME_DEV" 2>/dev/null || true
    tmux kill-session -t "$SESSION_NAME_PROD" 2>/dev/null || true
    
    # ポート解放を確認
    clean_port $DEV_PORT "force" > /dev/null 2>&1
    
    print_message "success" "すべてのサーバーを停止しました"
}

# ステータス確認
check_status() {
    print_message "info" "=== サーバーステータス ==="
    
    # 開発サーバー
    if [ -f "$PID_FILE_DEV" ]; then
        local dev_pid=$(cat "$PID_FILE_DEV")
        if kill -0 "$dev_pid" 2>/dev/null; then
            print_message "success" "開発サーバー: 稼働中 (PID: $dev_pid, Port: $DEV_PORT)"
        else
            print_message "warn" "開発サーバー: 停止中"
            rm -f "$PID_FILE_DEV"
        fi
    else
        print_message "info" "開発サーバー: 未起動"
    fi
    
    # 本番サーバー
    if [ -f "$PID_FILE_PROD" ]; then
        local prod_pid=$(cat "$PID_FILE_PROD")
        if kill -0 "$prod_pid" 2>/dev/null; then
            print_message "success" "本番サーバー: 稼働中 (PID: $prod_pid, Port: $PROD_PORT)"
        else
            print_message "warn" "本番サーバー: 停止中"
        fi
    else
        print_message "info" "本番サーバー: 未起動"
    fi
    
    # ポート使用状況
    print_message "info" ""
    print_message "info" "ポート $DEV_PORT の使用状況:"
    lsof -i :$DEV_PORT 2>/dev/null | grep LISTEN || echo "  未使用"
}

# クイックスタート（開発モード）
quick_start() {
    print_message "info" "=== クイックスタート（開発モード）==="
    
    # すべてのサーバーを停止
    stop_all > /dev/null 2>&1
    
    # 開発サーバーを起動
    start_dev "force"
}

# 使用方法表示
show_usage() {
    echo ""
    echo "使用方法: $0 {quick|dev|prod|stop|status|clean|help} [options]"
    echo ""
    echo "コマンド:"
    echo "  quick         - クイックスタート（既存プロセスを自動停止して開発サーバー起動）"
    echo "  dev [--force] - 開発サーバー起動（Vite）"
    echo "  prod [--force]- 本番サーバー起動（SSL対応）"
    echo "  stop          - すべてのサーバーを停止"
    echo "  status        - サーバーステータス確認"
    echo "  clean         - ポート強制解放とクリーンアップ"
    echo "  help          - このヘルプを表示"
    echo ""
    echo "推奨使用例:"
    echo "  $0 quick      # 開発を即座に開始（最も簡単）"
    echo "  $0 dev --force # 開発サーバーを強制起動"
    echo "  $0 status     # 現在の状態を確認"
    echo ""
    echo "Tips:"
    echo "  - 'quick' コマンドは最も簡単に開発を開始できます"
    echo "  - ポート競合時は --force オプションを使用してください"
    echo "  - tmux attach -t budget-dev でログを確認できます"
}

# メイン処理
case "${1:-help}" in
    quick)
        quick_start
        ;;
    dev)
        start_dev "$2"
        ;;
    prod)
        start_prod "$2"
        ;;
    stop)
        stop_all
        ;;
    status)
        check_status
        ;;
    clean)
        clean_port $DEV_PORT "force"
        ;;
    help|*)
        show_usage
        ;;
esac