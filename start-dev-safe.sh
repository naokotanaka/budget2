#!/bin/bash

SESSION="dev"

# 既存セッション削除
tmux kill-session -t $SESSION 2>/dev/null

# 3つのウィンドウで起動
tmux new-session -d -s $SESSION -n claude
tmux send-keys -t $SESSION:claude "claude" Enter

tmux new-window -t $SESSION -n server
tmux send-keys -t $SESSION:server "npm run dev" Enter

tmux new-window -t $SESSION -n test
tmux send-keys -t $SESSION:test "npm run test:watch" Enter

# Claudeウィンドウを選択
tmux select-window -t $SESSION:claude

# アタッチ
tmux attach-session -t $SESSION
