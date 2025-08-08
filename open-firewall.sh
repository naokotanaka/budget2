#!/bin/bash

# ファイアウォール設定スクリプト - nagaiku-budget-v2
# ポート3002を開放してHTTPSアクセスを許可

echo "=== ファイアウォール設定 ==="
echo "ポート3002を開放します..."

# ufwがインストールされているか確認
if command -v ufw &> /dev/null; then
    echo "UFWを使用してポート3002を開放します..."
    sudo ufw allow 3002/tcp
    sudo ufw reload
    echo "UFW設定完了"
elif command -v firewall-cmd &> /dev/null; then
    echo "firewalldを使用してポート3002を開放します..."
    sudo firewall-cmd --permanent --add-port=3002/tcp
    sudo firewall-cmd --reload
    echo "firewalld設定完了"
else
    echo "iptablesを使用してポート3002を開放します..."
    sudo iptables -A INPUT -p tcp --dport 3002 -j ACCEPT
    sudo iptables-save > /etc/iptables/rules.v4
    echo "iptables設定完了"
fi

echo ""
echo "=== 現在のファイアウォール状態 ==="
if command -v ufw &> /dev/null; then
    sudo ufw status numbered | grep 3002
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --list-ports | grep 3002
else
    sudo iptables -L -n | grep 3002
fi

echo ""
echo "設定が完了しました。"
echo "https://160.251.170.97:3002/budget2/ でアクセスできるはずです。"