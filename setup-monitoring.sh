#!/bin/bash

# ==================================================
# Monitoring System Setup Script
# 監視システムの自動セットアップ
# ==================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="nagaiku-budget-monitor"
TIMER_NAME="nagaiku-budget-monitor.timer"

# 色付きメッセージ
print_info() { echo -e "\e[32m[INFO]\e[0m $1"; }
print_warn() { echo -e "\e[33m[WARN]\e[0m $1"; }
print_error() { echo -e "\e[31m[ERROR]\e[0m $1"; }

# crontabエントリーを作成
setup_cron_monitoring() {
    print_info "Cron監視の設定を行います..."
    
    # 既存のcrontabエントリーを確認
    local existing_cron=$(crontab -l 2>/dev/null | grep "health-monitor.sh")
    
    if [ -n "$existing_cron" ]; then
        print_warn "既存の監視cronが見つかりました: $existing_cron"
        read -p "既存のcronを置き換えますか? (y/N): " replace_cron
        if [[ $replace_cron =~ ^[Yy]$ ]]; then
            # 既存のエントリーを削除
            crontab -l 2>/dev/null | grep -v "health-monitor.sh" | crontab -
        else
            print_info "Cron設定をスキップしました"
            return 0
        fi
    fi
    
    # 新しいcrontabエントリーを追加
    local new_cron="# Nagaiku Budget v2 Health Monitor
*/5 * * * * ${SCRIPT_DIR}/health-monitor.sh start >/dev/null 2>&1
0 6 * * * ${SCRIPT_DIR}/manage-server.sh status && echo \"Daily status check: OK\" | logger -t nagaiku-budget"
    
    (crontab -l 2>/dev/null; echo "$new_cron") | crontab -
    
    print_info "Cron監視を設定しました (5分間隔でヘルスチェック)"
}

# systemd タイマーサービスを作成
setup_systemd_monitoring() {
    print_info "systemd監視サービスの設定を行います..."
    
    # サービスファイル作成
    cat > "/tmp/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Nagaiku Budget v2 Health Monitor
After=network.target

[Service]
Type=oneshot
User=tanaka
Group=tanaka
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${SCRIPT_DIR}/health-monitor.sh start
StandardOutput=journal
StandardError=journal
EOF

    # タイマーファイル作成
    cat > "/tmp/${TIMER_NAME}" << EOF
[Unit]
Description=Run Nagaiku Budget v2 Health Monitor every 5 minutes
Requires=${SERVICE_NAME}.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # ユーザーのsystemdディレクトリに移動
    local systemd_dir="$HOME/.config/systemd/user"
    mkdir -p "$systemd_dir"
    
    mv "/tmp/${SERVICE_NAME}.service" "$systemd_dir/"
    mv "/tmp/${TIMER_NAME}" "$systemd_dir/"
    
    # systemdユーザーサービスを有効化
    systemctl --user daemon-reload
    systemctl --user enable "$TIMER_NAME"
    systemctl --user start "$TIMER_NAME"
    
    print_info "systemdタイマーサービスを設定しました"
}

# logrotate設定
setup_log_rotation() {
    print_info "ログローテーション設定を行います..."
    
    cat > "${SCRIPT_DIR}/logrotate.conf" << EOF
${SCRIPT_DIR}/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 tanaka tanaka
    postrotate
        # ログローテーション後の処理があれば記載
    endscript
}
EOF

    # crontabにlogrotateエントリーを追加
    local logrotate_cron="0 2 * * * /usr/sbin/logrotate -s ${SCRIPT_DIR}/logrotate.state ${SCRIPT_DIR}/logrotate.conf"
    local existing_logrotate=$(crontab -l 2>/dev/null | grep "logrotate.*nagaiku-budget")
    
    if [ -z "$existing_logrotate" ]; then
        (crontab -l 2>/dev/null; echo "$logrotate_cron") | crontab -
        print_info "ログローテーションを設定しました"
    else
        print_warn "ログローテーション設定は既に存在します"
    fi
}

# アラート設定（Slack/Discord）
setup_alert_config() {
    print_info "アラート設定を行います..."
    
    local config_file="${SCRIPT_DIR}/monitor.conf"
    
    echo ""
    echo "=== 通知設定 ==="
    echo "Slack または Discord への通知を設定しますか？"
    echo "1) Slack Webhook"
    echo "2) Discord Webhook"
    echo "3) なし（後で設定）"
    
    read -p "選択してください (1-3): " notification_choice
    
    case $notification_choice in
        1)
            read -p "Slack Webhook URLを入力してください: " slack_webhook
            if [ -n "$slack_webhook" ]; then
                sed -i "s|^NOTIFICATION_WEBHOOK=.*|NOTIFICATION_WEBHOOK=\"$slack_webhook\"|" "$config_file"
                print_info "Slack通知を設定しました"
            fi
            ;;
        2)
            read -p "Discord Webhook URLを入力してください: " discord_webhook
            if [ -n "$discord_webhook" ]; then
                sed -i "s|^NOTIFICATION_WEBHOOK=.*|NOTIFICATION_WEBHOOK=\"$discord_webhook\"|" "$config_file"
                print_info "Discord通知を設定しました"
            fi
            ;;
        3)
            print_info "通知設定をスキップしました"
            ;;
        *)
            print_warn "無効な選択です。通知設定をスキップしました"
            ;;
    esac
}

# メンテナンススクリプト作成
create_maintenance_scripts() {
    print_info "メンテナンススクリプトを作成します..."
    
    # 日次レポートスクリプト
    cat > "${SCRIPT_DIR}/daily-report.sh" << 'EOF'
#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="${SCRIPT_DIR}/logs/daily-report-$(date +%Y%m%d).txt"

echo "==== Nagaiku Budget v2 日次レポート ====" > "$REPORT_FILE"
echo "日時: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "=== サーバー状態 ===" >> "$REPORT_FILE"
"${SCRIPT_DIR}/manage-server.sh" status >> "$REPORT_FILE" 2>&1
echo "" >> "$REPORT_FILE"

echo "=== ディスク使用量 ===" >> "$REPORT_FILE"
du -sh "${SCRIPT_DIR}" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "=== ログファイルサイズ ===" >> "$REPORT_FILE"
ls -lh "${SCRIPT_DIR}/logs/"*.log 2>/dev/null | tail -10 >> "$REPORT_FILE" || echo "ログファイルなし" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "=== 最近のエラー (過去24時間) ===" >> "$REPORT_FILE"
find "${SCRIPT_DIR}/logs" -name "*.log" -mtime -1 -exec grep -l "ERROR\|WARN" {} \; | head -5 | while read logfile; do
    echo "--- $logfile ---" >> "$REPORT_FILE"
    grep -E "ERROR|WARN" "$logfile" | tail -10 >> "$REPORT_FILE"
done

echo "レポートを作成しました: $REPORT_FILE"
EOF

    chmod +x "${SCRIPT_DIR}/daily-report.sh"
    
    # クリーンアップスクリプト
    cat > "${SCRIPT_DIR}/cleanup.sh" << 'EOF'
#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== システムクリーンアップ開始 ==="

# 古いログファイルを削除（30日以上）
echo "古いログファイルを削除中..."
find "${SCRIPT_DIR}/logs" -name "*.log" -mtime +30 -delete
find "${SCRIPT_DIR}/logs" -name "*.txt" -mtime +30 -delete

# 一時ファイルクリーンアップ
echo "一時ファイルをクリーンアップ中..."
rm -f "${SCRIPT_DIR}/tmp/"*.tmp
rm -f "${SCRIPT_DIR}/logs/"*.tmp

# node_modules再インストール（オプション）
if [ "$1" = "--reinstall-deps" ]; then
    echo "依存関係を再インストール中..."
    cd "${SCRIPT_DIR}"
    rm -rf node_modules package-lock.json
    npm install
fi

echo "=== クリーンアップ完了 ==="
EOF

    chmod +x "${SCRIPT_DIR}/cleanup.sh"
    
    print_info "メンテナンススクリプトを作成しました"
}

# 設定完了後のテスト
run_setup_tests() {
    print_info "設定テストを実行しています..."
    
    # サーバー状態確認
    echo "1. サーバー状態確認"
    "${SCRIPT_DIR}/manage-server.sh" status
    
    # ヘルスチェックテスト
    echo "2. ヘルスチェックテスト"
    timeout 10 "${SCRIPT_DIR}/health-monitor.sh" status
    
    # ログディレクトリ確認
    echo "3. ログディレクトリ確認"
    ls -la "${SCRIPT_DIR}/logs/" || mkdir -p "${SCRIPT_DIR}/logs/"
    
    print_info "設定テスト完了"
}

# メイン実行
main() {
    echo "===================================================="
    echo "Nagaiku Budget v2 監視システム セットアップ"
    echo "===================================================="
    
    # 監視タイプの選択
    echo ""
    echo "監視方式を選択してください:"
    echo "1) Cron (推奨) - シンプルで軽量"
    echo "2) systemd timer - より高度な制御"
    echo "3) 両方"
    
    read -p "選択してください (1-3): " monitoring_type
    
    case $monitoring_type in
        1)
            setup_cron_monitoring
            ;;
        2)
            setup_systemd_monitoring
            ;;
        3)
            setup_cron_monitoring
            setup_systemd_monitoring
            ;;
        *)
            print_error "無効な選択です"
            exit 1
            ;;
    esac
    
    # 共通セットアップ
    setup_log_rotation
    setup_alert_config
    create_maintenance_scripts
    run_setup_tests
    
    echo ""
    echo "===================================================="
    echo "セットアップ完了！"
    echo "===================================================="
    echo ""
    echo "管理コマンド:"
    echo "  ${SCRIPT_DIR}/manage-server.sh {start|stop|restart|status|monitor}"
    echo "  ${SCRIPT_DIR}/health-monitor.sh {start|stop|status}"
    echo "  ${SCRIPT_DIR}/daily-report.sh"
    echo "  ${SCRIPT_DIR}/cleanup.sh"
    echo ""
    echo "設定ファイル:"
    echo "  ${SCRIPT_DIR}/monitor.conf - 監視設定"
    echo "  ${SCRIPT_DIR}/logrotate.conf - ログローテーション"
    echo ""
    echo "ログディレクトリ:"
    echo "  ${SCRIPT_DIR}/logs/"
    echo ""
    echo "Cron設定確認: crontab -l"
    echo "サーバー状態確認: ${SCRIPT_DIR}/manage-server.sh status"
    echo ""
}

# スクリプト実行
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi