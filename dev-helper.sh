#!/bin/bash

# ==================================================
# 開発支援ヘルパースクリプト
# 開発時の便利機能を提供
# ==================================================

PROJECT_DIR="/home/tanaka/projects/nagaiku-budget-v2"
TMUX_SESSION="dev-budget"
PORT=3002
LOG_DIR="${PROJECT_DIR}/logs"

# 色付きメッセージ
print_message() {
    local type=$1
    local message=$2
    case $type in
        "info")    echo -e "\e[32m[INFO]\e[0m $message" ;;
        "warn")    echo -e "\e[33m[WARN]\e[0m $message" ;;
        "error")   echo -e "\e[31m[ERROR]\e[0m $message" ;;
        "success") echo -e "\e[36m[OK]\e[0m $message" ;;
        "dev")     echo -e "\e[35m[DEV]\e[0m $message" ;;
    esac
}

# サーバー再起動（tmux内で実行）
restart_dev_server() {
    print_message "dev" "開発サーバーを再起動しています..."
    
    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        print_message "error" "tmuxセッションが見つかりません"
        print_message "info" "開発モードに切り替えてください: ./dev-mode.sh dev"
        return 1
    fi
    
    # Ctrl-Cを送信してサーバーを停止
    tmux send-keys -t "$TMUX_SESSION:server.0" C-c
    sleep 2
    
    # クリアして再起動
    tmux send-keys -t "$TMUX_SESSION:server.0" "clear" Enter
    tmux send-keys -t "$TMUX_SESSION:server.0" "npm run dev" Enter
    
    print_message "success" "開発サーバーを再起動しました"
}

# ログをクリア
clear_logs() {
    print_message "info" "ログをクリアしています..."
    
    if [ -d "$LOG_DIR" ]; then
        rm -f "$LOG_DIR"/*.log
        print_message "success" "ログをクリアしました"
    else
        print_message "warn" "ログディレクトリが見つかりません"
    fi
}

# ポートチェック
check_port() {
    if lsof -i:${PORT} >/dev/null 2>&1; then
        print_message "success" "ポート ${PORT} は使用中です"
        lsof -i:${PORT}
    else
        print_message "warn" "ポート ${PORT} は未使用です"
    fi
}

# 依存関係の更新
update_deps() {
    print_message "info" "依存関係を更新しています..."
    cd "$PROJECT_DIR"
    
    # package-lock.jsonをバックアップ
    cp package-lock.json package-lock.json.backup
    
    if npm update; then
        print_message "success" "依存関係を更新しました"
    else
        print_message "error" "更新に失敗しました"
        print_message "info" "バックアップを復元します"
        mv package-lock.json.backup package-lock.json
        return 1
    fi
    
    rm -f package-lock.json.backup
}

# ビルドテスト
test_build() {
    print_message "info" "ビルドテストを実行しています..."
    cd "$PROJECT_DIR"
    
    if npm run build; then
        print_message "success" "ビルドテストに成功しました"
        
        # ビルドサイズを表示
        print_message "info" "ビルドサイズ:"
        du -sh build/
    else
        print_message "error" "ビルドテストに失敗しました"
        return 1
    fi
}

# 環境変数チェック
check_env() {
    print_message "info" "環境変数をチェックしています..."
    
    if [ -f "${PROJECT_DIR}/.env" ]; then
        print_message "success" ".envファイルが存在します"
        print_message "info" "設定されている環境変数:"
        grep -v '^#' "${PROJECT_DIR}/.env" | grep -v '^$' | sed 's/=.*/=***/'
    else
        print_message "warn" ".envファイルが見つかりません"
    fi
}

# データベース接続テスト
test_db() {
    print_message "info" "データベース接続をテストしています..."
    
    # PostgreSQLの接続テスト
    if command -v psql >/dev/null 2>&1; then
        if psql -U tanaka -d nagaiku_budget_v2 -c "SELECT 1;" >/dev/null 2>&1; then
            print_message "success" "データベース接続: OK"
            
            # テーブル一覧を表示
            print_message "info" "テーブル一覧:"
            psql -U tanaka -d nagaiku_budget_v2 -c "\dt" 2>/dev/null | grep -E "^\s+public"
        else
            print_message "error" "データベース接続に失敗しました"
        fi
    else
        print_message "warn" "psqlコマンドが見つかりません"
    fi
}

# 開発用ウィンドウを追加
add_dev_window() {
    local window_name=$1
    local command=$2
    
    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        print_message "error" "tmuxセッションが見つかりません"
        return 1
    fi
    
    # 新しいウィンドウを作成
    tmux new-window -t "$TMUX_SESSION" -n "$window_name" -c "$PROJECT_DIR"
    tmux send-keys -t "$TMUX_SESSION:$window_name" "$command" Enter
    
    print_message "success" "ウィンドウ '$window_name' を追加しました"
}

# クイックコマンド実行
quick_cmd() {
    local cmd=$1
    
    case $cmd in
        "lint")
            cd "$PROJECT_DIR"
            npm run lint
            ;;
        "format")
            cd "$PROJECT_DIR"
            npm run format
            ;;
        "typecheck")
            cd "$PROJECT_DIR"
            npm run check
            ;;
        *)
            print_message "error" "不明なコマンド: $cmd"
            ;;
    esac
}

# パフォーマンスモニタリング
monitor_performance() {
    print_message "dev" "パフォーマンスモニタリング (Ctrl+Cで終了)"
    
    while true; do
        clear
        echo "=========================================="
        echo "  パフォーマンスモニター"
        echo "=========================================="
        
        # CPU使用率
        echo -n "CPU使用率: "
        ps aux | grep "node" | grep -v grep | awk '{print $3"%"}'
        
        # メモリ使用量
        echo -n "メモリ使用量: "
        ps aux | grep "node" | grep -v grep | awk '{print $4"%"}'
        
        # ポート状態
        echo -n "ポート ${PORT}: "
        if lsof -i:${PORT} >/dev/null 2>&1; then
            echo "ACTIVE"
        else
            echo "INACTIVE"
        fi
        
        # ネットワーク接続数
        echo -n "接続数: "
        netstat -an | grep ":${PORT}" | grep ESTABLISHED | wc -l
        
        echo "=========================================="
        sleep 5
    done
}

# 使用方法
show_usage() {
    echo "使用方法: $0 {restart|logs|port|deps|build|env|db|monitor|help}"
    echo ""
    echo "コマンド:"
    echo "  restart   - 開発サーバーを再起動"
    echo "  logs      - ログをクリア"
    echo "  port      - ポート使用状況を確認"
    echo "  deps      - 依存関係を更新"
    echo "  build     - ビルドテスト"
    echo "  env       - 環境変数チェック"
    echo "  db        - データベース接続テスト"
    echo "  monitor   - パフォーマンスモニタリング"
    echo "  lint      - ESLintを実行"
    echo "  format    - コードフォーマット"
    echo "  typecheck - 型チェック"
    echo "  help      - このヘルプを表示"
}

# メイン処理
case "${1:-help}" in
    restart)
        restart_dev_server
        ;;
    logs|clear-logs)
        clear_logs
        ;;
    port)
        check_port
        ;;
    deps|update)
        update_deps
        ;;
    build)
        test_build
        ;;
    env)
        check_env
        ;;
    db|database)
        test_db
        ;;
    monitor|perf)
        monitor_performance
        ;;
    lint|format|typecheck)
        quick_cmd "$1"
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_message "error" "無効なコマンド: $1"
        show_usage
        exit 1
        ;;
esac