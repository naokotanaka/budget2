#!/bin/bash

SESSION="dev"

# 既存セッション削除
tmux kill-session -t $SESSION 2>/dev/null

echo "開発環境を起動中..."

# セッション作成
tmux new-session -d -s $SESSION

# 1. Claude Code（メイン）
tmux send-keys "claude" Enter
sleep 1

# 2. 下に30%の高さで分割
tmux split-window -v -p 30

# 3. 下部でnpm run dev起動
tmux send-keys "npm run dev" Enter
sleep 1

# 4. 下部を左右に分割（50:50）
tmux split-window -h

# 5. 右側でtest:watch起動
tmux send-keys "npm run test:watch" Enter

# Claude Codeに戻る
tmux select-pane -t 0

# アタッチ
tmux attach -t $SESSION
