#!/bin/bash

# ==================================================
# 開発モード管理スクリプト
# tmuxベースの柔軟な開発環境とsystemd管理の切り替え
# ==================================================

PROJECT_NAME="nagaiku-budget-v2"
PROJECT_DIR="/home/tanaka/projects/nagaiku-budget-v2"
TMUX_SESSION="dev-budget"
SERVICE_NAME="nagaiku-budget-v2.service"
PORT=3002
MODE_FILE="${PROJECT_DIR}/.development-mode"
BACKUP_DIR="${PROJECT_DIR}/.backup"

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
        "dev")     echo -e "\e[35m[DEV]\e[0m   [$timestamp] $message" ;;
        "prod")    echo -e "\e[34m[PROD]\e[0m  [$timestamp] $message" ;;
    esac
}

# 現在のモードを取得
get_current_mode() {
    if [ -f "$MODE_FILE" ]; then
        cat "$MODE_FILE"
    else
        # systemdサービスの状態から判断
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            echo "production"
        else
            echo "unknown"
        fi
    fi
}

# モードを設定
set_mode() {
    echo "$1" > "$MODE_FILE"
}

# systemdサービスの状態確認
check_systemd_status() {
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "active"
    elif systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "enabled"
    else
        echo "inactive"
    fi
}

# tmuxセッションの状態確認
check_tmux_status() {
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        # プロセスが実際に動いているか確認
        if tmux list-panes -t "$TMUX_SESSION" -F "#{pane_pid}" 2>/dev/null | xargs -I {} kill -0 {} 2>/dev/null; then
            echo "running"
        else
            echo "dead"
        fi
    else
        echo "none"
    fi
}

# 開発モードに切り替え
switch_to_dev() {
    local current_mode=$(get_current_mode)
    
    print_message "dev" "=========================================="
    print_message "dev" "    開発モードへの切り替えを開始"
    print_message "dev" "=========================================="
    
    # systemdサービスを停止
    local systemd_status=$(check_systemd_status)
    if [ "$systemd_status" = "active" ]; then
        print_message "info" "systemdサービスを停止しています..."
        sudo systemctl stop "$SERVICE_NAME"
        sleep 2
        print_message "success" "systemdサービスを停止しました"
        
        # 自動起動を無効化
        print_message "info" "自動起動を無効化しています..."
        sudo systemctl disable "$SERVICE_NAME"
        print_message "success" "自動起動を無効化しました"
    else
        print_message "info" "systemdサービスは既に停止しています"
    fi
    
    # ポートが解放されるまで待機
    print_message "info" "ポート ${PORT} の解放を確認中..."
    local count=0
    while lsof -i:${PORT} >/dev/null 2>&1 && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done
    
    if lsof -i:${PORT} >/dev/null 2>&1; then
        print_message "warn" "ポート ${PORT} がまだ使用中です。プロセスを強制終了します"
        lsof -ti:${PORT} | xargs -r kill -9
        sleep 2
    fi
    
    # tmuxセッションを作成して開発サーバーを起動
    print_message "dev" "開発用tmuxセッションを作成しています..."
    
    # 既存のセッションがあれば削除
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
    
    # 新しいセッションを作成
    tmux new-session -d -s "$TMUX_SESSION" -c "$PROJECT_DIR"
    
    # ウィンドウに名前を付ける
    tmux rename-window -t "$TMUX_SESSION:0" "server"
    
    # 開発サーバーを起動
    tmux send-keys -t "$TMUX_SESSION:server" "cd $PROJECT_DIR" Enter
    tmux send-keys -t "$TMUX_SESSION:server" "npm run dev" Enter
    
    # ログ監視用のペインを追加
    tmux split-window -t "$TMUX_SESSION:server" -v -p 30
    tmux send-keys -t "$TMUX_SESSION:server.1" "cd $PROJECT_DIR" Enter
    tmux send-keys -t "$TMUX_SESSION:server.1" "echo '==== ログ監視ペイン ===='" Enter
    tmux send-keys -t "$TMUX_SESSION:server.1" "echo 'ここでログを確認できます'" Enter
    
    # モードを設定
    set_mode "development"
    
    sleep 3
    
    print_message "success" "開発モードに切り替えました！"
    print_message "dev" "=========================================="
    print_message "dev" "開発環境の使い方:"
    print_message "info" "  セッションに接続: tmux attach -t $TMUX_SESSION"
    print_message "info" "  セッションから離脱: Ctrl-b d"
    print_message "info" "  サーバー再起動: セッション内で Ctrl-C → npm run dev"
    print_message "info" "  サーバー停止: セッション内で Ctrl-C"
    print_message "info" "  URL: http://localhost:${PORT}/budget2/"
    print_message "dev" "=========================================="
    
    # 自動的にセッションに接続するか確認
    read -p "今すぐtmuxセッションに接続しますか？ (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        tmux attach -t "$TMUX_SESSION"
    fi
}

# プロダクションモードに切り替え
switch_to_prod() {
    print_message "prod" "=========================================="
    print_message "prod" "   プロダクションモードへの切り替えを開始"
    print_message "prod" "=========================================="
    
    # tmuxセッションを停止
    local tmux_status=$(check_tmux_status)
    if [ "$tmux_status" = "running" ] || [ "$tmux_status" = "dead" ]; then
        print_message "info" "tmuxセッションを停止しています..."
        tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
        sleep 2
        print_message "success" "tmuxセッションを停止しました"
    else
        print_message "info" "tmuxセッションは実行されていません"
    fi
    
    # ポート上の残留プロセスを確認
    if lsof -i:${PORT} >/dev/null 2>&1; then
        print_message "warn" "ポート ${PORT} で実行中のプロセスを停止します"
        lsof -ti:${PORT} | xargs -r kill -9
        sleep 2
    fi
    
    # ビルドを実行
    print_message "info" "プロダクション用ビルドを実行しています..."
    cd "$PROJECT_DIR"
    if npm run build; then
        print_message "success" "ビルドが完了しました"
    else
        print_message "error" "ビルドに失敗しました"
        return 1
    fi
    
    # systemdサービスを起動
    print_message "info" "systemdサービスを起動しています..."
    sudo systemctl start "$SERVICE_NAME"
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_message "success" "systemdサービスが起動しました"
        
        # 自動起動を有効化
        print_message "info" "自動起動を有効化しています..."
        sudo systemctl enable "$SERVICE_NAME"
        print_message "success" "自動起動を有効化しました"
    else
        print_message "error" "systemdサービスの起動に失敗しました"
        sudo systemctl status "$SERVICE_NAME" --no-pager
        return 1
    fi
    
    # モードを設定
    set_mode "production"
    
    print_message "success" "プロダクションモードに切り替えました！"
    print_message "prod" "=========================================="
    print_message "prod" "プロダクション環境の管理:"
    print_message "info" "  状態確認: sudo systemctl status $SERVICE_NAME"
    print_message "info" "  ログ確認: sudo journalctl -u $SERVICE_NAME -f"
    print_message "info" "  再起動: sudo systemctl restart $SERVICE_NAME"
    print_message "info" "  URL: https://nagaiku.top/budget2/"
    print_message "prod" "=========================================="
}

# 現在の状態を表示
show_status() {
    local mode=$(get_current_mode)
    local systemd_status=$(check_systemd_status)
    local tmux_status=$(check_tmux_status)
    
    print_message "info" "=========================================="
    print_message "info" "         現在のシステム状態"
    print_message "info" "=========================================="
    
    # モード表示
    case $mode in
        "development")
            print_message "dev" "モード: 開発モード"
            ;;
        "production")
            print_message "prod" "モード: プロダクションモード"
            ;;
        *)
            print_message "warn" "モード: 不明"
            ;;
    esac
    
    # systemd状態
    case $systemd_status in
        "active")
            print_message "prod" "systemd: ✓ 実行中"
            ;;
        "enabled")
            print_message "info" "systemd: 有効（停止中）"
            ;;
        *)
            print_message "info" "systemd: 無効"
            ;;
    esac
    
    # tmux状態
    case $tmux_status in
        "running")
            print_message "dev" "tmux: ✓ 実行中 (セッション: $TMUX_SESSION)"
            ;;
        "dead")
            print_message "warn" "tmux: セッションは存在するが、プロセスが停止"
            ;;
        *)
            print_message "info" "tmux: セッションなし"
            ;;
    esac
    
    # ポート状態
    if lsof -i:${PORT} >/dev/null 2>&1; then
        local process_info=$(lsof -i:${PORT} | grep LISTEN | head -1)
        print_message "success" "ポート ${PORT}: 使用中"
        if [ -n "$process_info" ]; then
            echo "  プロセス: $process_info"
        fi
    else
        print_message "warn" "ポート ${PORT}: 未使用"
    fi
    
    # アクセスURL
    print_message "info" "=========================================="
    if [ "$mode" = "development" ] && [ "$tmux_status" = "running" ]; then
        print_message "dev" "開発URL: http://localhost:${PORT}/budget2/"
        print_message "info" "tmux接続: tmux attach -t $TMUX_SESSION"
    elif [ "$mode" = "production" ] && [ "$systemd_status" = "active" ]; then
        print_message "prod" "本番URL: https://nagaiku.top/budget2/"
        print_message "info" "ログ確認: sudo journalctl -u $SERVICE_NAME -f"
    fi
    print_message "info" "=========================================="
}

# クイック切り替え（現在のモードと逆に切り替え）
quick_switch() {
    local mode=$(get_current_mode)
    
    case $mode in
        "development")
            print_message "info" "開発モード → プロダクションモードに切り替えます"
            switch_to_prod
            ;;
        "production")
            print_message "info" "プロダクションモード → 開発モードに切り替えます"
            switch_to_dev
            ;;
        *)
            print_message "warn" "現在のモードが不明です。状態を確認してください"
            show_status
            echo
            read -p "開発モード(d)とプロダクションモード(p)のどちらに切り替えますか？ (d/p): " -n 1 -r
            echo
            case $REPLY in
                [Dd])
                    switch_to_dev
                    ;;
                [Pp])
                    switch_to_prod
                    ;;
                *)
                    print_message "error" "無効な選択です"
                    ;;
            esac
            ;;
    esac
}

# tmuxセッションに安全に接続
safe_attach() {
    local tmux_status=$(check_tmux_status)
    
    if [ "$tmux_status" = "running" ]; then
        print_message "dev" "tmuxセッションに接続しています..."
        tmux attach -t "$TMUX_SESSION"
    elif [ "$tmux_status" = "dead" ]; then
        print_message "warn" "tmuxセッションは存在しますが、プロセスが停止しています"
        read -p "セッションを再作成しますか？ (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            switch_to_dev
        fi
    else
        print_message "error" "tmuxセッションが存在しません"
        read -p "開発モードに切り替えますか？ (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            switch_to_dev
        fi
    fi
}

# 使用方法表示
show_usage() {
    echo "使用方法: $0 {dev|prod|status|switch|attach|help}"
    echo ""
    echo "コマンド:"
    echo "  dev       - 開発モードに切り替え（tmuxベース）"
    echo "  prod      - プロダクションモードに切り替え（systemd管理）"
    echo "  status    - 現在の状態を表示"
    echo "  switch    - 現在のモードと逆のモードに切り替え"
    echo "  attach    - tmuxセッションに接続（開発モード時）"
    echo "  help      - このヘルプを表示"
    echo ""
    echo "開発モードの特徴:"
    echo "  - tmuxセッションで実行"
    echo "  - 自由に停止・再起動可能"
    echo "  - リアルタイムでログ確認"
    echo "  - ホットリロード対応"
    echo ""
    echo "プロダクションモードの特徴:"
    echo "  - systemdで自動管理"
    echo "  - システム起動時に自動開始"
    echo "  - 自動復旧機能"
    echo "  - 安定した運用"
}

# メイン処理
case "${1:-help}" in
    dev|development)
        switch_to_dev
        ;;
    prod|production)
        switch_to_prod
        ;;
    status)
        show_status
        ;;
    switch|toggle)
        quick_switch
        ;;
    attach)
        safe_attach
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_message "error" "無効なコマンド: $1"
        echo
        show_usage
        exit 1
        ;;
esac

exit 0