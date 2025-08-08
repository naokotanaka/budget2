#!/bin/bash
# tmux開発環境セットアップスクリプト

SESSION_NAME="nagaiku-dev"

echo "🚀 tmux開発環境を起動中..."

# 既存セッションがあれば終了
tmux has-session -t $SESSION_NAME 2>/dev/null && tmux kill-session -t $SESSION_NAME

# 新しいtmuxセッションを作成
tmux new-session -d -s $SESSION_NAME -c /home/tanaka/projects/nagaiku-budget-v2

# ウィンドウ1: 開発サーバー
tmux rename-window -t $SESSION_NAME:0 'DevServer'
tmux send-keys -t $SESSION_NAME:0 'echo "🔄 開発サーバーをクリーンスタート中..."' C-m
tmux send-keys -t $SESSION_NAME:0 'npm run dev:clean' C-m

# ウィンドウ2: ログ監視
tmux new-window -t $SESSION_NAME -n 'Logs'
tmux send-keys -t $SESSION_NAME:1 'echo "📋 ログ監視中..."' C-m
tmux send-keys -t $SESSION_NAME:1 'tail -f logs/dev-server.log 2>/dev/null || echo "ログファイル準備中..."' C-m

# ウィンドウ3: システム監視
tmux new-window -t $SESSION_NAME -n 'Monitor'
tmux send-keys -t $SESSION_NAME:2 'echo "📊 システム監視中..."' C-m
tmux send-keys -t $SESSION_NAME:2 'watch -n 5 "echo \"=== プロセス状況 ===\" && ps aux | grep -E \"vite|node.*dev\" | grep -v grep && echo \"\" && echo \"=== ポート使用状況 ===\" && ss -tulpn | grep 3002 && echo \"\" && echo \"=== メモリ使用量 ===\" && free -h"' C-m

# ウィンドウ4: 作業用ターミナル
tmux new-window -t $SESSION_NAME -n 'Terminal'
tmux send-keys -t $SESSION_NAME:3 'echo "🛠️ 作業用ターミナル準備完了"' C-m
tmux send-keys -t $SESSION_NAME:3 'echo "便利コマンド:"' C-m
tmux send-keys -t $SESSION_NAME:3 'echo "  npm run dev:clean  # クリーンスタート"' C-m
tmux send-keys -t $SESSION_NAME:3 'echo "  curl -I https://nagaiku.top/budget2/  # 動作確認"' C-m

# 最初のウィンドウにフォーカス
tmux select-window -t $SESSION_NAME:0

echo "✅ tmux開発環境が起動しました！"
echo ""
echo "📋 使用方法:"
echo "  tmux attach -t $SESSION_NAME    # セッションに接続"
echo "  tmux detach                     # セッションから切断（サーバーは継続）"
echo "  tmux ls                         # セッション一覧"
echo "  tmux kill-session -t $SESSION_NAME  # セッション終了"
echo ""
echo "🔧 ウィンドウ構成:"
echo "  0: DevServer  - 開発サーバー"
echo "  1: Logs       - ログ監視"  
echo "  2: Monitor    - システム監視"
echo "  3: Terminal   - 作業用"
echo ""
echo "⚡ キーバインド:"
echo "  Ctrl+B → 0~3  # ウィンドウ切り替え"
echo "  Ctrl+B → d    # デタッチ"
echo ""

# tmuxセッションに接続
tmux attach -t $SESSION_NAME