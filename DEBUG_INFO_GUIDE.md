# デバッグ情報機能 使用ガイド

## 概要

nagaiku-budget-v2プロジェクトに、キャッシュ問題とコード問題を明確に区別するためのデバッグ表示機能を追加しました。

## 機能詳細

### 表示される情報

1. **🔧 Build**: ビルド時刻（いつコンパイルされたか）
2. **🏷️ Version**: バージョン番号（コード変更の確認用連番）
3. **⏰ Loaded**: リアルタイム更新時刻（ページが実際にいつ読み込まれたか）
4. **🔄 HMR**: Hot Module Reload ステータス（開発モードでの更新確認）
5. **🚧/🚀 Mode**: 実行モード（Development/Production）

### 表示場所

以下のページの右上に固定配置されています：
- `/` - メインダッシュボード
- `/grants` - 助成金管理ページ
- `/transactions` - 取引管理ページ
- `/allocations` - 割当管理ページ

### 操作方法

1. **表示切替**: 右上の「🔽 DEBUG」ボタンをクリックで表示/非表示を切替
2. **自動更新**: 「Loaded」時刻は5秒ごとに自動更新
3. **HMR検出**: 開発モードでファイル変更時にHMRステータスが更新

### HMRステータスの意味

- **Active** (緑): HMRが正常に動作中
- **Updating...** (オレンジ): 更新処理中（点滅アニメーション）
- **Updated** (緑): 更新完了（フラッシュアニメーション）
- **Dev Mode (No HMR)** (オレンジ): 開発モードだがHMRは無効
- **Production** (青): プロダクションモード
- **Unknown** (赤): ステータス不明

## 実装ファイル

### 新規作成されたファイル

1. **`/src/lib/components/DebugInfo.svelte`**
   - メインのデバッグ情報コンポーネント
   - リアルタイム時刻更新とHMR監視機能

2. **`/src/vite-env.d.ts`**
   - TypeScript型定義（Vite環境変数用）

### 変更されたファイル

1. **`/vite.config.ts`**
   - ビルド時刻とバージョン番号の環境変数定義
   - `__BUILD_TIME__`, `__BUILD_VERSION__`, `__DEV_MODE__` を追加

2. **各ページファイル**
   - `/src/routes/+page.svelte`
   - `/src/routes/grants/+page.svelte`
   - `/src/routes/transactions/+page.svelte`
   - `/src/routes/allocations/+page.svelte`
   - 各ページにDebugInfoコンポーネントをimportと配置

## 使用シナリオ

### 1. コード修正後の確認

```
修正前: Version: #234567, Build: 2025-08-06 20:30:15
修正後: Version: #234890, Build: 2025-08-06 20:35:22
```

バージョン番号が変わっていれば、コードは正しくビルドされています。

### 2. キャッシュ問題の特定

```
Build: 2025-08-06 20:35:22 (最新ビルド時刻)
Loaded: 20:30:45 (古い読み込み時刻)
```

ビルド時刻より読み込み時刻が古い場合、ブラウザキャッシュ問題の可能性があります。

### 3. 開発環境での動作確認

```
HMR: Active → Updating... → Updated
Mode: Development
```

ファイル保存時にHMRステータスが変化すれば、開発環境は正常です。

## トラブルシューティング

### Q: デバッグ情報が表示されない
A: ブラウザの開発者ツールでJavaScriptエラーを確認してください。

### Q: HMRが「Unknown」と表示される
A: 開発サーバーを再起動してください。

### Q: 時刻が更新されない
A: JavaScriptが正常に動作しているか確認してください。

## パフォーマンス情報

- **ファイルサイズ**: 約3KB（gzip圧縮後約1KB）
- **メモリ使用量**: 最小限（5秒タイマーのみ）
- **ネットワーク負荷**: なし（すべてローカル処理）

## カスタマイズ

### 表示位置の変更

`DebugInfo.svelte`の`.debug-info-panel`クラスのCSSを編集：

```css
.debug-info-panel {
  position: fixed;
  top: 10px;    /* 上からの距離 */
  right: 10px;  /* 右からの距離 */
  /* left: 10px; で左寄せに変更可能 */
}
```

### 更新間隔の変更

`DebugInfo.svelte`のonMount内のsetIntervalを編集：

```javascript
// 5秒 → 10秒に変更
const interval = setInterval(updateCurrentTime, 10000);
```

### 表示項目の追加

新しい情報を追加する場合は：

1. `vite.config.ts`で環境変数定義
2. `src/vite-env.d.ts`で型定義追加
3. `DebugInfo.svelte`で表示ロジック追加

## 今後のメンテナンス

- **バージョン番号**: 自動生成（タイムスタンプベース）
- **表示スタイル**: レスポンシブ対応済み
- **アクセシビリティ**: ARIA属性を適切に設定済み

この機能により、開発効率が大幅に向上し、キャッシュ問題とコード問題の切り分けが容易になります。