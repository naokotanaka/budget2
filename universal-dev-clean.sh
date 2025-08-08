#!/bin/bash
# 汎用開発環境クリーンスタートスクリプト v1.0
# 対応: Vite, Next.js, Create React App, Vue CLI, SvelteKit, Nuxt

# 設定（プロジェクトごとにカスタマイズ）
DEFAULT_PORT=3000
PROJECT_PORTS=(3000 3001 3002 3003 8080 8000 4000 5000 5173)
DEV_COMMANDS=("npm run dev" "yarn dev" "pnpm dev")

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 汎用開発環境クリーンスタートを実行中...${NC}"

# プロジェクトタイプ自動検出
detect_project_type() {
    if [ -f "vite.config.js" ] || [ -f "vite.config.ts" ]; then
        echo "Vite"
    elif [ -f "next.config.js" ] || [ -f "next.config.ts" ]; then
        echo "Next.js"
    elif [ -f "vue.config.js" ] || [ -f "vite.config.js" ]; then
        echo "Vue"
    elif [ -f "svelte.config.js" ]; then
        echo "SvelteKit"
    elif [ -f "nuxt.config.js" ] || [ -f "nuxt.config.ts" ]; then
        echo "Nuxt"
    else
        echo "Generic"
    fi
}

PROJECT_TYPE=$(detect_project_type)
echo -e "${GREEN}📋 検出されたプロジェクト: ${PROJECT_TYPE}${NC}"

# プロセス停止
echo -e "${YELLOW}🛑 開発サーバープロセスを停止中...${NC}"
pkill -f "vite dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "vue-cli-service serve" 2>/dev/null || true
pkill -f "nuxt dev" 2>/dev/null || true
pkill -f "webpack-dev-server" 2>/dev/null || true

# ポート解放
echo -e "${YELLOW}🔌 ポートを解放中...${NC}"
for port in "${PROJECT_PORTS[@]}"; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "${YELLOW}   ポート $port を解放中...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done

# キャッシュクリア
echo -e "${YELLOW}🗑️ プロジェクトキャッシュをクリア中...${NC}"

# Vite関連
[ -d "node_modules/.vite" ] && rm -rf node_modules/.vite && echo -e "${GREEN}   ✓ Viteキャッシュクリア${NC}"
[ -d ".svelte-kit" ] && rm -rf .svelte-kit && echo -e "${GREEN}   ✓ SvelteKitキャッシュクリア${NC}"

# Next.js関連
[ -d ".next" ] && rm -rf .next && echo -e "${GREEN}   ✓ Next.jsキャッシュクリア${NC}"

# Nuxt関連
[ -d ".nuxt" ] && rm -rf .nuxt && echo -e "${GREEN}   ✓ Nuxtキャッシュクリア${NC}"
[ -d "dist" ] && rm -rf dist && echo -e "${GREEN}   ✓ distディレクトリクリア${NC}"

# その他の一般的なキャッシュ
[ -d ".parcel-cache" ] && rm -rf .parcel-cache && echo -e "${GREEN}   ✓ Parcelキャッシュクリア${NC}"
[ -d "build" ] && rm -rf build && echo -e "${GREEN}   ✓ buildディレクトリクリア${NC}"

# パッケージマネージャー検出
detect_package_manager() {
    if [ -f "pnpm-lock.yaml" ]; then
        echo "pnpm"
    elif [ -f "yarn.lock" ]; then
        echo "yarn"
    else
        echo "npm"
    fi
}

PKG_MANAGER=$(detect_package_manager)
echo -e "${GREEN}📦 検出されたパッケージマネージャー: ${PKG_MANAGER}${NC}"

# 少し待機
sleep 2

# 開発サーバー起動
echo -e "${BLUE}🚀 開発サーバーを起動中...${NC}"

# プロジェクトタイプ別の起動コマンド決定
case $PROJECT_TYPE in
    "Vite"|"SvelteKit")
        if [ "$PKG_MANAGER" = "yarn" ]; then
            exec yarn dev
        elif [ "$PKG_MANAGER" = "pnpm" ]; then
            exec pnpm dev
        else
            exec npm run dev
        fi
        ;;
    "Next.js")
        if [ "$PKG_MANAGER" = "yarn" ]; then
            exec yarn dev
        elif [ "$PKG_MANAGER" = "pnpm" ]; then
            exec pnpm dev
        else
            exec npm run dev
        fi
        ;;
    "Nuxt")
        if [ "$PKG_MANAGER" = "yarn" ]; then
            exec yarn dev
        elif [ "$PKG_MANAGER" = "pnpm" ]; then
            exec pnpm dev
        else
            exec npm run dev
        fi
        ;;
    *)
        echo -e "${YELLOW}⚠️ 汎用モードで起動します${NC}"
        if [ "$PKG_MANAGER" = "yarn" ]; then
            exec yarn start || yarn dev || yarn serve
        elif [ "$PKG_MANAGER" = "pnpm" ]; then
            exec pnpm start || pnpm dev || pnpm serve
        else
            exec npm start || npm run dev || npm run serve
        fi
        ;;
esac