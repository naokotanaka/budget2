#!/bin/bash
# クイックステータスチェック - 500/404エラーの迅速な診断

echo "🏥 NAGAIKU BUDGET V2 - HEALTH CHECK"
echo "=================================="
echo "Time: $(date)"
echo ""

# 1. アプリケーションプロセス確認
echo "📋 1. APPLICATION STATUS"
echo "------------------------"
if pgrep -f "vite dev.*3002" > /dev/null; then
    echo "✅ Vite dev server is running (port 3002)"
    ps aux | grep -E "vite dev.*3002" | grep -v grep | head -1
else
    echo "❌ Vite dev server NOT running on port 3002"
    echo "   💡 Fix: cd /home/tanaka/projects/nagaiku-budget-v2 && npm run dev"
fi
echo ""

# 2. ポート確認
echo "🔌 2. PORT STATUS"
echo "-----------------"
for port in 3002 80 443; do
    if ss -tln | grep ":$port " > /dev/null; then
        echo "✅ Port $port is listening"
    else
        echo "❌ Port $port is NOT listening"
        case $port in
            3002) echo "   💡 Fix: npm run dev --port 3002" ;;
            80|443) echo "   💡 Fix: sudo systemctl start nginx" ;;
        esac
    fi
done
echo ""

# 3. HTTP接続テスト
echo "🌐 3. HTTP CONNECTIVITY"
echo "----------------------"
echo "Testing main endpoints..."

endpoints=(
    "https://nagaiku.top/budget2/"
    "https://nagaiku.top/budget2/freee/data"
    "https://nagaiku.top/budget2/api/freee/data"
)

for endpoint in "${endpoints[@]}"; do
    echo -n "Testing $endpoint ... "
    response=$(curl -s -I -w "%{http_code}" -o /dev/null "$endpoint" 2>/dev/null)
    if [[ $response == "200" ]]; then
        echo "✅ $response"
    elif [[ $response == "404" ]]; then
        echo "❌ $response (Not Found)"
    elif [[ $response == "500" ]]; then
        echo "🚨 $response (Server Error)"
    elif [[ $response == "502" ]] || [[ $response == "503" ]] || [[ $response == "504" ]]; then
        echo "💥 $response (Proxy/Gateway Error)"
    else
        echo "⚠️ $response"
    fi
done
echo ""

# 4. 最近のエラーログ
echo "📝 4. RECENT ERROR LOGS"
echo "----------------------"
echo "Nginx access log (last 5 errors):"
if sudo test -r /var/log/nginx/access.log; then
    sudo tail -n 200 /var/log/nginx/access.log | grep -E " (4[0-9]{2}|5[0-9]{2}) " | tail -5 | while read line; do
        status=$(echo "$line" | grep -o ' [45][0-9][0-9] ' | tr -d ' ')
        url=$(echo "$line" | cut -d'"' -f2 | cut -d' ' -f2)
        time=$(echo "$line" | grep -o '\[[^]]*\]' | tr -d '[]')
        echo "  [$time] $status $url"
    done
else
    echo "  ⚠️ Cannot read nginx access log (permission denied)"
fi
echo ""

echo "Nginx error log (last 3 entries):"
if sudo test -r /var/log/nginx/error.log; then
    sudo tail -n 3 /var/log/nginx/error.log | while read line; do
        echo "  $line"
    done
else
    echo "  ⚠️ Cannot read nginx error log (permission denied)"
fi
echo ""

# 5. クイックフィックス提案
echo "⚡ 5. QUICK FIXES"
echo "----------------"

# プロセスチェック
if ! pgrep -f "vite dev.*3002" > /dev/null; then
    echo "🔧 App not running:"
    echo "   cd /home/tanaka/projects/nagaiku-budget-v2"
    echo "   npm run dev"
    echo ""
fi

# Nginxチェック
if ! systemctl is-active --quiet nginx; then
    echo "🔧 Nginx not running:"
    echo "   sudo systemctl start nginx"
    echo ""
fi

# データベースチェック
if ! systemctl is-active --quiet postgresql; then
    echo "🔧 PostgreSQL not running:"
    echo "   sudo systemctl start postgresql"
    echo ""
fi

echo "🚀 MONITORING COMMANDS"
echo "====================="
echo "Real-time error monitoring:"
echo "  node scripts/error-analyzer.js watch"
echo ""
echo "Recent error analysis:"
echo "  node scripts/error-analyzer.js analyze 30"
echo ""
echo "Live log monitoring:"
echo "  sudo tail -f /var/log/nginx/access.log | grep -E ' (4[0-9]{2}|5[0-9]{2}) '"
echo ""
echo "Application logs:"
echo "  tail -f .svelte-kit/output/server/server.log"