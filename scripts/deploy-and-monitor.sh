#!/bin/bash

# 502エラー防止用 - 完全自動デプロイ・監視スクリプト
# このスクリプトはシステムを完全にセットアップし、502エラーを防ぎます

set -e

# 設定
PROJECT_DIR="/home/tanaka/projects/nagaiku-budget-v2"
SERVICE_NAME="nagaiku-budget-v2"
NGINX_CONF="$PROJECT_DIR/nginx/budget2-optimized.conf"
SYSTEMD_SERVICE="$PROJECT_DIR/systemd/nagaiku-budget-v2.service"
LOG_DIR="$PROJECT_DIR/logs"
SUDO_PASS="7ga19ta7ka705"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ステップ1: 既存プロセスの停止
stop_existing_processes() {
    log_info "既存プロセスを停止中..."
    
    # tmuxセッションのプロセスを停止
    if tmux has-session -t nagaiku-budget-v2 2>/dev/null; then
        tmux kill-session -t nagaiku-budget-v2 || true
        log_info "tmuxセッションを停止しました"
    fi
    
    # 既存のNode.jsプロセスを停止
    pkill -f "node.*3002" || true
    pkill -f "node build" || true
    
    sleep 2
    log_info "既存プロセスの停止完了"
}

# ステップ2: ログディレクトリの作成
setup_logs() {
    log_info "ログディレクトリをセットアップ中..."
    
    mkdir -p "$LOG_DIR"
    touch "$LOG_DIR/app.log"
    touch "$LOG_DIR/error.log"
    touch "$LOG_DIR/health-check.log"
    touch "$LOG_DIR/health-error.log"
    
    # 権限設定
    chmod 755 "$LOG_DIR"
    chmod 644 "$LOG_DIR"/*.log
    
    log_info "ログディレクトリのセットアップ完了"
}

# ステップ3: アプリケーションのビルド
build_application() {
    log_info "アプリケーションをビルド中..."
    
    cd "$PROJECT_DIR"
    
    # 依存関係のインストール
    npm install
    
    # プロダクションビルド
    npm run build
    
    log_info "ビルド完了"
}

# ステップ4: systemdサービスの設定
setup_systemd() {
    log_info "systemdサービスを設定中..."
    
    # サービスファイルをコピー
    echo "$SUDO_PASS" | sudo -S cp "$SYSTEMD_SERVICE" /etc/systemd/system/
    
    # systemdをリロード
    echo "$SUDO_PASS" | sudo -S systemctl daemon-reload
    
    # サービスを有効化
    echo "$SUDO_PASS" | sudo -S systemctl enable "$SERVICE_NAME"
    
    # サービスを起動
    echo "$SUDO_PASS" | sudo -S systemctl start "$SERVICE_NAME"
    
    sleep 5
    
    # ステータス確認
    if echo "$SUDO_PASS" | sudo -S systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "systemdサービスの起動成功"
    else
        log_error "systemdサービスの起動失敗"
        echo "$SUDO_PASS" | sudo -S systemctl status "$SERVICE_NAME"
        exit 1
    fi
}

# ステップ5: nginx設定の更新
setup_nginx() {
    log_info "nginx設定を更新中..."
    
    # 既存の設定をバックアップ
    echo "$SUDO_PASS" | sudo -S cp /etc/nginx/sites-available/budget2-complete /etc/nginx/sites-available/budget2-complete.bak.$(date +%Y%m%d_%H%M%S)
    
    # 新しい設定をコピー
    echo "$SUDO_PASS" | sudo -S cp "$NGINX_CONF" /etc/nginx/sites-available/budget2-optimized
    
    # シンボリックリンクを更新
    echo "$SUDO_PASS" | sudo -S rm -f /etc/nginx/sites-enabled/default
    echo "$SUDO_PASS" | sudo -S ln -sf /etc/nginx/sites-available/budget2-optimized /etc/nginx/sites-enabled/default
    
    # nginx設定をテスト
    if echo "$SUDO_PASS" | sudo -S nginx -t; then
        log_info "nginx設定テスト成功"
        # nginxをリロード
        echo "$SUDO_PASS" | sudo -S systemctl reload nginx
        log_info "nginx設定の更新完了"
    else
        log_error "nginx設定テスト失敗"
        # 元の設定に戻す
        echo "$SUDO_PASS" | sudo -S ln -sf /etc/nginx/sites-available/budget2-complete /etc/nginx/sites-enabled/default
        echo "$SUDO_PASS" | sudo -S systemctl reload nginx
        exit 1
    fi
}

# ステップ6: crontabの設定（ヘルスチェック）
setup_crontab() {
    log_info "ヘルスチェックのcrontabを設定中..."
    
    # 既存のcrontabを取得
    crontab -l > /tmp/mycron 2>/dev/null || true
    
    # ヘルスチェックエントリを削除（重複防止）
    grep -v "health-check.sh" /tmp/mycron > /tmp/mycron.new || true
    
    # 新しいエントリを追加（1分ごとに実行）
    echo "* * * * * /home/tanaka/projects/nagaiku-budget-v2/scripts/health-check.sh >> /home/tanaka/projects/nagaiku-budget-v2/logs/cron.log 2>&1" >> /tmp/mycron.new
    
    # crontabを更新
    crontab /tmp/mycron.new
    rm /tmp/mycron /tmp/mycron.new
    
    log_info "crontabの設定完了"
}

# ステップ7: 動作確認
verify_deployment() {
    log_info "デプロイメントを検証中..."
    
    # ポート確認
    if ss -tlnp | grep -q ":3002"; then
        log_info "✓ ポート3002がリッスン中"
    else
        log_error "✗ ポート3002がリッスンしていません"
        return 1
    fi
    
    # HTTPレスポンス確認
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/budget2/)
    if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 304 ]; then
        log_info "✓ アプリケーションが正常に応答 (HTTP $HTTP_STATUS)"
    else
        log_error "✗ アプリケーションの応答エラー (HTTP $HTTP_STATUS)"
        return 1
    fi
    
    # systemdサービス確認
    if echo "$SUDO_PASS" | sudo -S systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "✓ systemdサービスが稼働中"
    else
        log_error "✗ systemdサービスが停止"
        return 1
    fi
    
    # nginxプロキシ確認
    NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://160.251.170.97/budget2/)
    if [ "$NGINX_STATUS" -eq 200 ] || [ "$NGINX_STATUS" -eq 304 ] || [ "$NGINX_STATUS" -eq 301 ]; then
        log_info "✓ nginxプロキシが正常 (HTTP $NGINX_STATUS)"
    else
        log_warn "△ nginxプロキシの応答: HTTP $NGINX_STATUS"
    fi
    
    return 0
}

# ステップ8: 監視情報の表示
show_monitoring_info() {
    log_info "==============================================="
    log_info "502エラー防止セットアップ完了！"
    log_info "==============================================="
    echo ""
    echo "【アクセスURL】"
    echo "  - HTTP:  http://160.251.170.97/budget2/"
    echo "  - HTTPS: https://nagaiku.top/budget2/"
    echo ""
    echo "【監視コマンド】"
    echo "  - サービス状態: sudo systemctl status $SERVICE_NAME"
    echo "  - ログ確認: tail -f $LOG_DIR/app.log"
    echo "  - エラーログ: tail -f $LOG_DIR/error.log"
    echo "  - ヘルスチェック: tail -f $LOG_DIR/health-check.log"
    echo ""
    echo "【管理コマンド】"
    echo "  - 再起動: sudo systemctl restart $SERVICE_NAME"
    echo "  - 停止: sudo systemctl stop $SERVICE_NAME"
    echo "  - 起動: sudo systemctl start $SERVICE_NAME"
    echo ""
    echo "【自動復旧機能】"
    echo "  ✓ systemdによる自動再起動"
    echo "  ✓ 1分ごとのヘルスチェック"
    echo "  ✓ nginxフェイルオーバー"
    echo "  ✓ カスタムエラーページ"
    echo ""
    log_info "==============================================="
}

# メイン処理
main() {
    log_info "502エラー防止セットアップを開始します"
    
    # 各ステップを実行
    stop_existing_processes
    setup_logs
    build_application
    setup_systemd
    setup_nginx
    setup_crontab
    
    # 検証
    if verify_deployment; then
        show_monitoring_info
        log_info "セットアップ完了！502エラーは防止されます。"
    else
        log_error "セットアップ中にエラーが発生しました"
        exit 1
    fi
}

# 実行
main