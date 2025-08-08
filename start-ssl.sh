#!/bin/bash

# HTTPSサーバー起動スクリプト

echo "Starting HTTPS server on port 3002..."

# 既存のセッションを停止
tmux kill-session -t budget-ssl 2>/dev/null

# HTTPSサーバーを起動
tmux new-session -d -s budget-ssl "PORT=3002 node server.js"

echo "HTTPS server started in tmux session 'budget-ssl'"
echo "Access the application at:"
echo "  - https://localhost:3002/budget2/"
echo "  - https://160.251.170.97:3002/budget2/"
echo ""
echo "To view logs: tmux attach -t budget-ssl"
echo "To stop server: tmux kill-session -t budget-ssl"