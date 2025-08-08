#!/bin/bash
# エラー診断ヘルパースクリプト
# エージェントが自動的に使用するための診断・解決スクリプト

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ログファイル
LOG_FILE="logs/error-diagnosis.log"
mkdir -p logs

# タイムスタンプ付きログ
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# エラー分析関数
analyze_error() {
    local error_message="$1"
    local error_lower=$(echo "$error_message" | tr '[:upper:]' '[:lower:]')
    
    # 即座実行パターン
    if echo "$error_lower" | grep -qE "変更が反映|hmr|hot module|port|ポート|キャッシュ|component|コンポーネント"; then
        echo "immediate"
        return
    fi
    
    # フロントエンド関連パターン
    if echo "$error_lower" | grep -qE "build|ビルド|dev server|開発サーバー|localhost|module|モジュール|vite|svelte"; then
        echo "frontend"
        return
    fi
    
    # バックエンド/DB関連パターン
    if echo "$error_lower" | grep -qE "database|データベース|postgres|sqlite|prisma|migration|api|backend|nginx|systemd"; then
        echo "backend"
        return
    fi
    
    echo "unknown"
}

# クリーンスタート実行
execute_clean_start() {
    echo -e "${BLUE}🔄 クリーンスタートを実行します...${NC}"
    log_message "Executing clean start"
    
    # スクリプトの存在確認
    if [ -f "./universal-dev-clean.sh" ]; then
        ./universal-dev-clean.sh
        return $?
    elif [ -f "./dev-clean-start.sh" ]; then
        ./dev-clean-start.sh
        return $?
    else
        echo -e "${YELLOW}⚠️ クリーンスタートスクリプトが見つかりません${NC}"
        log_message "Clean start script not found"
        return 1
    fi
}

# 詳細診断
detailed_diagnosis() {
    echo -e "${CYAN}🔍 詳細診断を実行中...${NC}"
    log_message "Starting detailed diagnosis"
    
    # ポート状態確認
    echo -e "\n${BLUE}ポート状態:${NC}"
    lsof -i :3002 2>/dev/null || echo "ポート3002は使用されていません"
    
    # Node.jsプロセス確認
    echo -e "\n${BLUE}Node.jsプロセス:${NC}"
    ps aux | grep -E "node|vite" | grep -v grep || echo "実行中のNode.jsプロセスはありません"
    
    # キャッシュディレクトリ確認
    echo -e "\n${BLUE}キャッシュディレクトリ:${NC}"
    [ -d "node_modules/.vite" ] && echo "✓ Viteキャッシュ存在" || echo "✗ Viteキャッシュなし"
    [ -d ".svelte-kit" ] && echo "✓ SvelteKitキャッシュ存在" || echo "✗ SvelteKitキャッシュなし"
    
    # 最近のエラーログ
    echo -e "\n${BLUE}最近のエラーログ:${NC}"
    if [ -f "logs/error.log" ]; then
        tail -n 10 logs/error.log
    else
        echo "エラーログなし"
    fi
}

# 完全リセット
full_reset() {
    echo -e "${RED}⚠️ 完全リセットを実行します...${NC}"
    log_message "Executing full reset"
    
    read -p "本当に実行しますか？ (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        echo "キャンセルしました"
        return 1
    fi
    
    # プロセス停止
    pkill -f "node" 2>/dev/null || true
    
    # キャッシュとnode_modules削除
    rm -rf node_modules package-lock.json
    rm -rf .svelte-kit node_modules/.vite dist build
    
    # 再インストール
    npm install
    
    # クリーンスタート
    npm run dev:clean
}

# 状態レポート生成
generate_report() {
    local report_file="logs/diagnosis-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# エラー診断レポート
生成日時: $(date '+%Y-%m-%d %H:%M:%S')

## システム状態

### ポート状態
\`\`\`
$(lsof -i :3002 2>/dev/null || echo "ポート3002: 未使用")
\`\`\`

### プロセス状態
\`\`\`
$(ps aux | grep -E "node|vite" | grep -v grep || echo "Node.jsプロセス: なし")
\`\`\`

### キャッシュ状態
- Viteキャッシュ: $([ -d "node_modules/.vite" ] && echo "存在" || echo "なし")
- SvelteKitキャッシュ: $([ -d ".svelte-kit" ] && echo "存在" || echo "なし")

### パッケージ情報
- Node.js: $(node -v 2>/dev/null || echo "不明")
- npm: $(npm -v 2>/dev/null || echo "不明")

## 推奨アクション
1. \`npm run dev:clean\` を実行
2. 問題が続く場合は \`npm run dev:simple\` を試行
3. それでも解決しない場合は完全リセットを検討

EOF
    
    echo -e "${GREEN}✅ レポートを生成しました: $report_file${NC}"
    log_message "Report generated: $report_file"
}

# メイン処理
main() {
    echo -e "${CYAN}================================${NC}"
    echo -e "${CYAN}  エラー診断ヘルパー v1.0${NC}"
    echo -e "${CYAN}================================${NC}\n"
    
    # 引数処理
    case "${1:-}" in
        "analyze")
            if [ -n "${2:-}" ]; then
                result=$(analyze_error "$2")
                echo -e "${GREEN}分析結果: $result${NC}"
                
                if [ "$result" = "immediate" ] || [ "$result" = "frontend" ]; then
                    echo -e "${YELLOW}→ クリーンスタートを推奨${NC}"
                fi
            else
                echo -e "${RED}エラーメッセージを指定してください${NC}"
            fi
            ;;
            
        "clean")
            execute_clean_start
            ;;
            
        "diagnose")
            detailed_diagnosis
            ;;
            
        "reset")
            full_reset
            ;;
            
        "report")
            generate_report
            ;;
            
        "auto")
            # 自動モード: エラーを分析して適切なアクションを実行
            if [ -n "${2:-}" ]; then
                result=$(analyze_error "$2")
                echo -e "${GREEN}エラータイプ: $result${NC}"
                
                if [ "$result" = "immediate" ]; then
                    echo -e "${YELLOW}即座にクリーンスタートを実行${NC}"
                    execute_clean_start
                elif [ "$result" = "frontend" ]; then
                    echo -e "${YELLOW}フロントエンドエラー検出${NC}"
                    detailed_diagnosis
                    echo
                    read -p "クリーンスタートを実行しますか？ (Y/n): " confirm
                    if [ "$confirm" != "n" ]; then
                        execute_clean_start
                    fi
                else
                    echo -e "${BLUE}詳細診断を実行${NC}"
                    detailed_diagnosis
                fi
            else
                echo -e "${RED}エラーメッセージを指定してください${NC}"
            fi
            ;;
            
        "help"|"--help"|"-h"|"")
            cat << EOF
使用方法: $0 [コマンド] [オプション]

コマンド:
  analyze <error>  - エラーメッセージを分析
  clean           - クリーンスタートを実行
  diagnose        - 詳細診断を実行
  reset           - 完全リセット（要確認）
  report          - 診断レポートを生成
  auto <error>    - 自動診断と修復
  help            - このヘルプを表示

例:
  $0 analyze "変更が反映されません"
  $0 clean
  $0 auto "HMRが動作しない"

EOF
            ;;
            
        *)
            echo -e "${RED}不明なコマンド: $1${NC}"
            echo "使用方法: $0 help"
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"