# MonthSelector コンポーネント - CSS Grid実装ガイド

## 概要
MonthSelectorは、CSS Gridを活用した高機能な月選択コンポーネントです。レスポンシブ対応、キーボードナビゲーション、アクセシビリティを完全サポートしています。

## CSS Grid実装の詳細

### 1. メイングリッドレイアウト

#### 標準グリッド（デスクトップ/タブレット/モバイル対応）
```css
.standard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

/* レスポンシブブレークポイント */
@media (min-width: 1024px) {
  .standard-grid {
    grid-template-columns: repeat(3, 1fr); /* デスクトップ: 3列 */
  }
}

@media (min-width: 640px) and (max-width: 1023px) {
  .standard-grid {
    grid-template-columns: repeat(2, 1fr); /* タブレット: 2列 */
  }
}

@media (max-width: 639px) {
  .standard-grid {
    grid-template-columns: 1fr; /* モバイル: 1列 */
  }
}
```

#### グループ化ビュー用グリッド
```css
.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.75rem;
}
```

#### コンパクトビュー用グリッド
```css
.compact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .compact-grid {
    grid-template-columns: repeat(6, 1fr); /* 6列固定 */
  }
}
```

### 2. 統計情報パネルのグリッド
```css
.stat-bar {
  display: grid;
  grid-template-columns: 100px 1fr 60px; /* ラベル | プログレスバー | 値 */
  align-items: center;
  gap: 0.5rem;
}
```

## 主要機能

### 1. 3つの表示モード
- **グリッドビュー**: 標準的な月表示（3列/2列/1列のレスポンシブ）
- **グループビュー**: 年度/四半期でグループ化
- **コンパクトビュー**: 省スペース表示（6列固定）

### 2. 選択機能
- 個別月選択
- 範囲選択（Shift+クリック）
- グループ一括選択（年度/四半期）
- クイック選択（直近3/6/12ヶ月）

### 3. キーボードナビゲーション
- 矢印キー: グリッド内移動
- Space/Enter: 選択/解除
- Home/End: 最初/最後へ移動

### 4. アクセシビリティ
- ARIA属性完備
- フォーカス管理
- スクリーンリーダー対応
- キーボード操作完全サポート

## 使用方法

### 基本的な使用
```svelte
<script>
  import MonthSelector from '$lib/components/MonthSelector.svelte';
  
  const grants = [
    {
      startDate: '2024-04-01',
      endDate: '2025-03-31'
    }
  ];
  
  let selectedMonths = [];
</script>

<MonthSelector 
  {grants}
  bind:selectedMonths
  on:change={(e) => console.log('選択:', e.detail)}
/>
```

### プロパティ
| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| grants | Array | [] | 助成金データ配列 |
| selectedMonths | Array | [] | 選択された月のキー配列（YYYY-MM形式） |
| title | string | '利用予定月' | コンポーネントのタイトル |
| showGrouping | boolean | true | グループ化機能の有効/無効 |
| enableKeyboardNavigation | boolean | true | キーボードナビゲーションの有効/無効 |

### イベント
| イベント | ペイロード | 説明 |
|---------|-----------|------|
| change | string[] | 月の選択状態が変更された時に発火 |

## パフォーマンス最適化

### 1. CSS Grid vs Flexbox
MonthSelectorではCSS Gridを採用しています。理由：
- 2次元レイアウトの制御が容易
- レスポンシブ対応がシンプル
- グリッドアイテムの配置が直感的
- ブラウザの最適化により高速

### 2. レンダリング最適化
- 仮想スクロールは不要（CSS Gridが効率的に処理）
- アニメーションはtransformとopacityのみ使用
- will-changeは使用せず（不要なメモリ消費を避ける）

### 3. アクセシビリティとパフォーマンスの両立
```css
@media (prefers-reduced-motion: reduce) {
  .month-cell-button {
    transition: none;
    animation: none;
  }
}
```

## ブラウザサポート
- Chrome 57+
- Firefox 52+
- Safari 10.1+
- Edge 16+

## カスタマイズ例

### テーマカラーの変更
```css
/* カスタムテーマ */
.month-cell-button.selected {
  background-color: var(--primary-light);
  border-color: var(--primary);
}
```

### グリッド列数の調整
```css
/* 4列表示にカスタマイズ */
@media (min-width: 1024px) {
  .standard-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

## トラブルシューティング

### Q: グリッドが崩れる
A: 親要素の幅が制限されていないか確認してください。

### Q: キーボードナビゲーションが動作しない
A: `enableKeyboardNavigation`プロパティがtrueになっているか確認してください。

### Q: 月が表示されない
A: 助成金データに`startDate`と`endDate`が正しく設定されているか確認してください。

## 今後の拡張予定
- [ ] カレンダービューの追加
- [ ] ドラッグ&ドロップによる範囲選択
- [ ] タッチジェスチャー対応
- [ ] カスタムテーマシステム