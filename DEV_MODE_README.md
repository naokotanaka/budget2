# 開発モード・プロダクションモード切り替えガイド

## 🎯 概要
このプロジェクトは、**開発モード**と**プロダクションモード**を簡単に切り替えることができます。

- **開発モード**: tmuxベースで柔軟な開発作業が可能
- **プロダクションモード**: systemdによる自動管理で安定運用

## 🚀 クイックスタート

### 現在の状態を確認
```bash
./dev-mode.sh status
```

### 開発モードに切り替え
```bash
./dev-mode.sh dev
```

### プロダクションモードに切り替え
```bash
./dev-mode.sh prod
```

### モードを切り替え（トグル）
```bash
./dev-mode.sh switch
```

## 💻 開発モードの使い方

### tmuxセッションに接続
```bash
tmux attach -t dev-budget
# または
./dev-mode.sh attach
```

### tmuxセッションから離脱
`Ctrl-b` → `d`

### サーバーを再起動
```bash
# tmux内で
Ctrl-C → npm run dev

# または外部から
./dev-helper.sh restart
```

### 開発用ヘルパーコマンド
```bash
# サーバー再起動
./dev-helper.sh restart

# ポート確認
./dev-helper.sh port

# ビルドテスト
./dev-helper.sh build

# データベース接続テスト
./dev-helper.sh db

# パフォーマンスモニタリング
./dev-helper.sh monitor

# ESLint実行
./dev-helper.sh lint

# コードフォーマット
./dev-helper.sh format
```

## 🏭 プロダクションモードの管理

### サービス状態確認
```bash
sudo systemctl status nagaiku-budget-v2
```

### ログ確認
```bash
sudo journalctl -u nagaiku-budget-v2 -f
```

### サービス再起動
```bash
sudo systemctl restart nagaiku-budget-v2
```

## 📝 モードの特徴

### 開発モード（tmux）
✅ 自由に停止・再起動可能
✅ リアルタイムログ確認
✅ ホットリロード対応
✅ デバッグが容易
❌ 手動管理が必要
❌ システム再起動時に自動起動しない

### プロダクションモード（systemd）
✅ 自動起動・自動復旧
✅ システム管理との統合
✅ 安定した運用
✅ リソース管理
❌ 開発時の柔軟性が低い
❌ ログ確認にコマンドが必要

## 🔧 トラブルシューティング

### ポートが使用中の場合
```bash
# ポート使用状況確認
lsof -i:3002

# プロセスを強制終了
lsof -ti:3002 | xargs kill -9
```

### tmuxセッションが残っている場合
```bash
# セッション一覧
tmux ls

# セッションを削除
tmux kill-session -t dev-budget
```

### systemdサービスが停止しない場合
```bash
# 強制停止
sudo systemctl stop nagaiku-budget-v2 --force

# サービスリロード
sudo systemctl daemon-reload
```

## 📁 ファイル構成
```
/home/tanaka/projects/nagaiku-budget-v2/
├── dev-mode.sh       # モード切り替えスクリプト
├── dev-helper.sh     # 開発支援ヘルパー
├── .development-mode # 現在のモード記録
└── build/           # ビルド出力
```

## 🌐 アクセスURL

- **開発モード**: http://localhost:3002/budget2/
- **プロダクションモード**: https://nagaiku.top/budget2/

## 💡 推奨ワークフロー

1. **通常時**: プロダクションモードで運用
2. **開発時**: 開発モードに切り替えて作業
3. **開発完了**: プロダクションモードに戻す
4. **緊急対応**: 開発モードで即座に修正可能

## ⚠️ 注意事項

- モード切り替え時、サービスは一時的に停止します
- 開発モードでは手動でサーバーを起動する必要があります
- プロダクションモードではビルドが自動実行されます
- 両モードを同時に実行することはできません