#!/bin/bash
# ドメインアクセス有効化スクリプト

echo "🌐 ドメイン(nagaiku.top)でのHTTPSアクセスを有効化します..."

# 最適化済みNginx設定をバックアップしてコピー
CONFIG_FILE="/etc/nginx/sites-available/nagaiku-budget-v2"
BACKUP_FILE="/etc/nginx/sites-available/nagaiku-budget-v2.backup.$(date +%Y%m%d_%H%M%S)"

echo "📋 現在の設定をバックアップ中..."
if [ -f "$CONFIG_FILE" ]; then
    sudo cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo "✅ バックアップ完了: $BACKUP_FILE"
fi

echo "📝 最適化済み設定を適用中..."
sudo cp nginx/budget2-optimized.conf "$CONFIG_FILE"

echo "🔗 設定を有効化中..."
if [ ! -L "/etc/nginx/sites-enabled/nagaiku-budget-v2" ]; then
    sudo ln -s "$CONFIG_FILE" /etc/nginx/sites-enabled/nagaiku-budget-v2
    echo "✅ シンボリックリンク作成完了"
else
    echo "✅ 既にシンボリックリンクが存在"
fi

echo "🔍 Nginx設定テスト中..."
if sudo nginx -t; then
    echo "✅ 設定テスト成功"
    
    echo "🔄 Nginxを再読み込み中..."
    if sudo systemctl reload nginx; then
        echo "✅ Nginx再読み込み完了"
        echo ""
        echo "🎉 ドメインアクセス有効化完了！"
        echo ""
        echo "📋 アクセス可能なURL:"
        echo "  https://nagaiku.top/budget2/"
        echo "  https://nagaiku.top/budget2/grants"
        echo ""
        echo "🔍 テスト方法:"
        echo "  curl -I https://nagaiku.top/budget2/"
        echo ""
    else
        echo "❌ Nginx再読み込み失敗"
        exit 1
    fi
else
    echo "❌ Nginx設定エラー - 設定を確認してください"
    exit 1
fi