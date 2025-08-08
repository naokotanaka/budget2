#!/bin/bash

# 🚀 ワンコマンド開発環境起動システム
# 目的: 開発者が機能開発に集中できるよう、環境問題を完全自動化

set -e

echo "🚀 === ワンコマンド開発環境起動 ==="
echo "時刻: $(date)"
echo ""

# カラーコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# ステップカウンター
STEP=1

function show_step() {
    echo -e "${BLUE}📌 ステップ$STEP: $1${NC}"
    STEP=$((STEP + 1))
}

function show_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function show_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

function show_error() {
    echo -e "${RED}❌ $1${NC}"
}

function show_info() {
    echo -e "${PURPLE}💡 $1${NC}"
}

# メイン処理
show_step "環境ヘルスチェック実行"
if ! chmod +x ./dev-tools/health-check.sh; then
    show_error "ヘルスチェックスクリプトが見つかりません"
    exit 1
fi

# ヘルスチェック実行（結果を取得）
HEALTH_OUTPUT=$(./dev-tools/health-check.sh)
echo "$HEALTH_OUTPUT"

# ヘルススコア抽出
HEALTH_SCORE=$(echo "$HEALTH_OUTPUT" | grep -o '[0-9]*\/100' | cut -d'/' -f1)

if [ -z "$HEALTH_SCORE" ]; then
    HEALTH_SCORE=0
fi

echo ""
show_step "環境状態評価 (スコア: $HEALTH_SCORE/100)"

if [ "$HEALTH_SCORE" -lt 70 ]; then
    show_warning "環境に問題があります。自動修復を実行します..."
    echo ""
    
    show_step "自動修復実行"
    chmod +x ./dev-tools/auto-fix.sh
    ./dev-tools/auto-fix.sh
    echo ""
    
    show_step "修復後の再チェック"
    ./dev-tools/health-check.sh
    echo ""
fi

show_step "開発サーバー起動準備"

# 既存サーバーのクリーンシャットダウン
if ss -tlnp | grep -q ":3002"; then
    show_info "既存サーバーを安全に終了中..."
    pkill -f "vite.*3002" 2>/dev/null || true
    sleep 3
fi

show_step "開発サーバー起動"
show_success "環境準備完了！"
echo ""

echo -e "${GREEN}🎯 === 開発準備完了 ===${NC}"
echo -e "${PURPLE}📍 アクセスURL: https://nagaiku.top/budget2/${NC}"
echo -e "${PURPLE}📍 助成金管理: https://nagaiku.top/budget2/grants${NC}"
echo -e "${PURPLE}📍 CSVインポート: 青いグラデーションボタン${NC}"
echo ""

show_step "開発サーバー起動中..."
echo -e "${YELLOW}終了するには Ctrl+C を押してください${NC}"
echo ""

# 開発サーバー起動
exec npm run dev

# このスクリプトは開発サーバーと共に終了