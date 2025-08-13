#!/bin/bash

SESSION="dev"
tmux kill-session -t $SESSION 2>/dev/null

# セッション作成
tmux new-session -d -s $SESSION

# 1. Claude Code（左側メイン）
tmux send-keys "claude" Enter
sleep 1

# 2. 右側に分割（78文字幅になるように）
tmux split-window -h
tmux send-keys "npm run dev" Enter
sleep 1

# 3. 右側を上下に分割
tmux split-window -v
tmux send-keys "npm run test:watch" Enter

# 4. 正確なレイアウトを適用
tmux select-layout "f11c,209x57,0,0[130x57,0,0,0,78x57,131,0[78x28,131,0,1,78x28,131,29,2]]"

# Claude Codeペインを選択
tmux select-pane -t 0

tmux attach -t $SESSION
