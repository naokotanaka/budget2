#!/bin/bash

# 502エラー防止システムの状態確認スクリプト

echo "==============================================="
echo "502エラー防止システム - ステータスレポート"
echo "==============================================="
echo ""

# 日時
echo "実行日時: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. systemdサービス状態
echo "【systemdサービス状態】"
if sudo systemctl is-active --quiet nagaiku-budget-v2; then
    echo "✓ nagaiku-budget-v2: 稼働中"
    sudo systemctl status nagaiku-budget-v2 --no-pager | grep -E "Active:|Main PID:"
else
    echo "✗ nagaiku-budget-v2: 停止中"
fi
echo ""

# 2. ポート状態
echo "【ポート3002の状態】"
if ss -tlnp 2>/dev/null | grep -q ":3002"; then
    echo "✓ ポート3002: リスニング中"
    ss -tlnp 2>/dev/null | grep ":3002" | awk '{print "  PID: " $6}'
else
    echo "✗ ポート3002: リスニングしていない"
fi
echo ""

# 3. HTTPレスポンス確認
echo "【HTTPレスポンス確認】"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3002/budget2/)
if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 304 ]; then
    echo "✓ localhost:3002: HTTP $HTTP_STATUS (正常)"
else
    echo "✗ localhost:3002: HTTP $HTTP_STATUS (異常)"
fi

NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://160.251.170.97/budget2/)
if [ "$NGINX_STATUS" -eq 200 ] || [ "$NGINX_STATUS" -eq 304 ] || [ "$NGINX_STATUS" -eq 301 ]; then
    echo "✓ nginx経由: HTTP $NGINX_STATUS (正常)"
else
    echo "✗ nginx経由: HTTP $NGINX_STATUS (異常)"
fi
echo ""

# 4. nginxステータス
echo "【nginxステータス】"
if sudo systemctl is-active --quiet nginx; then
    echo "✓ nginx: 稼働中"
else
    echo "✗ nginx: 停止中"
fi
echo ""

# 5. 最近のエラーログ
echo "【最近のエラー (過去5分)】"
if [ -f /home/tanaka/projects/nagaiku-budget-v2/logs/error.log ]; then
    RECENT_ERRORS=$(find /home/tanaka/projects/nagaiku-budget-v2/logs/error.log -mmin -5 -exec tail -5 {} \; 2>/dev/null)
    if [ -n "$RECENT_ERRORS" ]; then
        echo "$RECENT_ERRORS"
    else
        echo "✓ エラーなし"
    fi
else
    echo "ログファイルなし"
fi
echo ""

# 6. ヘルスチェック状態
echo "【ヘルスチェック状態】"
if crontab -l | grep -q "health-check.sh"; then
    echo "✓ ヘルスチェック: 設定済み（1分ごと）"
    if [ -f /home/tanaka/projects/nagaiku-budget-v2/logs/health-check.log ]; then
        echo "  最終チェック: $(tail -1 /home/tanaka/projects/nagaiku-budget-v2/logs/health-check.log 2>/dev/null | cut -d']' -f1 | cut -d'[' -f2)"
    fi
else
    echo "✗ ヘルスチェック: 未設定"
fi
echo ""

# 7. メモリ使用状況
echo "【メモリ使用状況】"
free -h | grep -E "^Mem:" | awk '{print "  使用中: " $3 " / 総容量: " $2 " (" int($3/$2*100) "%)"}'
echo ""

# 8. ディスク使用状況
echo "【ディスク使用状況】"
df -h /home/tanaka/projects/nagaiku-budget-v2 | tail -1 | awk '{print "  使用中: " $3 " / 総容量: " $2 " (" $5 ")"}'
echo ""

echo "==============================================="
echo "【管理コマンド】"
echo "  再起動: sudo systemctl restart nagaiku-budget-v2"
echo "  ログ確認: tail -f /home/tanaka/projects/nagaiku-budget-v2/logs/app.log"
echo "  エラーログ: tail -f /home/tanaka/projects/nagaiku-budget-v2/logs/error.log"
echo "  状態確認: ./monitor-status.sh"
echo "==============================================="