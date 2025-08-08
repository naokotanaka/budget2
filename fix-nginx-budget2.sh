#!/bin/bash

# Nginx設定ファイルのバックアップと修正スクリプト

echo "=== Nginx設定修正スクリプト ==="
echo "budget2のnginx設定をHTTPSからHTTPに変更します"
echo ""

# バックアップの作成
BACKUP_FILE="/etc/nginx/sites-available/nagaiku.backup.$(date +%Y%m%d_%H%M%S)"
echo "1. 現在の設定をバックアップ: $BACKUP_FILE"
sudo cp /etc/nginx/sites-available/nagaiku "$BACKUP_FILE"

# 修正版の適用
echo "2. 設定ファイルを修正中..."
sudo cp /tmp/nagaiku.conf.fixed /etc/nginx/sites-available/nagaiku

# 設定のテスト
echo "3. Nginx設定をテスト中..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "4. 設定テスト成功！Nginxを再起動中..."
    sudo systemctl reload nginx
    echo ""
    echo "✅ 修正完了！"
    echo ""
    echo "確認方法："
    echo "  1. ブラウザで https://nagaiku.top/budget2 にアクセス"
    echo "  2. エラーが解消されているか確認"
    echo ""
    echo "問題が発生した場合の復元方法："
    echo "  sudo cp $BACKUP_FILE /etc/nginx/sites-available/nagaiku"
    echo "  sudo systemctl reload nginx"
else
    echo "❌ 設定テストに失敗しました。変更を元に戻します..."
    sudo cp "$BACKUP_FILE" /etc/nginx/sites-available/nagaiku
    echo "元の設定に戻しました。"
    exit 1
fi