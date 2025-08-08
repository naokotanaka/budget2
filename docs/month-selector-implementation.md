# 助成期間からの月自動抽出機能 - 実装ガイド

## 概要
CSS Gridを活用した月選択UIと予算配分ビューの実装方針

## 作成したコンポーネント

### 1. MonthSelector.svelte
**機能:**
- 助成期間から月リストを自動生成
- グリッド/タイムラインの2つの表示モード
- 年度・四半期・月単位での一括選択
- レスポンシブ対応のCSS Gridレイアウト

**主な特徴:**
```css
/* CSS Grid による月配置 */
.months-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 8px;
  max-width: calc((48px + 8px) * 12); /* 12ヶ月分の最大幅 */
}
```

### 2. MonthlyBudgetGrid.svelte
**機能:**
- 月別予算配分の視覚的表示
- 固定列とスクロール可能列の組み合わせ
- 使用率の可視化
- インタラクティブな編集機能

**主な特徴:**
```css
/* 固定列とスクロール列の組み合わせ */
.grid-wrapper {
  display: grid;
  grid-template-columns: 400px 1fr; /* 固定幅 + 残り幅 */
}
```

## 既存コードへの統合手順

### Step 1: grants/+page.svelteへの組み込み

```svelte
<script>
  import MonthSelector from '$lib/components/MonthSelector.svelte';
  import MonthlyBudgetGrid from '$lib/components/MonthlyBudgetGrid.svelte';
  
  // 月選択の変更ハンドラ
  function handleMonthSelectionChange(event) {
    selectedMonths = event.detail.selectedMonths;
    // 自動保存または手動保存のトリガー
  }
  
  // セル編集ハンドラ
  function handleCellEdit(event) {
    const { budgetItemId, yearMonth } = event.detail;
    // 編集モーダルを開く or インライン編集
  }
</script>

<!-- 予算項目フォーム内での使用 -->
{#if showBudgetItemForm}
  <MonthSelector
    startDate={selectedGrant.startDate}
    endDate={selectedGrant.endDate}
    bind:selectedMonths
    on:change={handleMonthSelectionChange}
  />
{/if}

<!-- 月別配分ビュー -->
{#if selectedGrant && budgetItems.length > 0}
  <MonthlyBudgetGrid
    {budgetItems}
    startDate={selectedGrant.startDate}
    endDate={selectedGrant.endDate}
    on:editCell={handleCellEdit}
  />
{/if}
```

### Step 2: APIエンドポイントの追加

```typescript
// src/routes/api/budget-items/[id]/bulk-schedule/+server.ts
export async function POST({ params, request }) {
  const { id } = params;
  const { yearMonths } = await request.json();
  
  // 既存スケジュールを削除
  await prisma.budgetItemSchedule.deleteMany({
    where: { budgetItemId: parseInt(id) }
  });
  
  // 新規スケジュールを一括作成
  const schedules = yearMonths.map(ym => {
    const [year, month] = ym.split('-');
    return {
      budgetItemId: parseInt(id),
      year: parseInt(year),
      month: parseInt(month)
    };
  });
  
  await prisma.budgetItemSchedule.createMany({
    data: schedules
  });
  
  return json({ success: true });
}
```

### Step 3: データベーススキーマの確認

```prisma
model BudgetItemSchedule {
  id          Int      @id @default(autoincrement())
  budgetItemId Int
  year        Int
  month       Int
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  budgetItem  BudgetItem @relation(fields: [budgetItemId], references: [id])
  
  @@unique([budgetItemId, year, month])
  @@index([year, month])
}
```

## UI/UXの改善ポイント

### 1. グリッドレイアウトの利点
- **視認性向上**: 月を格子状に配置し、一覧性を確保
- **操作性向上**: タッチデバイスでも押しやすいサイズ
- **情報密度**: コンパクトモードで多くの情報を表示

### 2. レスポンシブ対応
```css
/* モバイル: 4列グリッド */
@media (max-width: 640px) {
  .months-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* タブレット: 6列グリッド */
@media (min-width: 641px) and (max-width: 1024px) {
  .months-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

/* デスクトップ: 12列（最大）*/
@media (min-width: 1025px) {
  .months-grid {
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    max-width: calc((48px + 8px) * 12);
  }
}
```

### 3. インタラクション改善
- **ホバー効果**: 選択可能な要素を明確化
- **一括操作**: 年度・四半期単位での選択
- **視覚的フィードバック**: 選択状態を色で表現

## パフォーマンス最適化

### 1. CSS Grid vs Flexbox
- **Grid使用場面**: 2次元レイアウト（月カレンダー、データテーブル）
- **Flexbox使用場面**: 1次元レイアウト（ツールバー、ボタングループ）

### 2. 仮想スクロール考慮
大量データの場合:
```javascript
// Tabulatorの仮想スクロールと併用
const table = new Tabulator("#table", {
  virtualDom: true,
  height: "600px"
});
```

### 3. CSS変数による動的調整
```css
.budget-grid-container {
  --cell-size: clamp(40px, 5vw, 60px);
  --gap: clamp(4px, 1vw, 12px);
}
```

## アクセシビリティ対応

### 1. キーボード操作
```svelte
<button
  on:keydown={(e) => {
    if (e.key === 'Space' || e.key === 'Enter') {
      toggleMonth(month.yearMonth);
    }
  }}
  aria-pressed={selectedMonths.has(month.yearMonth)}
  aria-label={`${month.year}年${month.month}月を選択`}
>
```

### 2. スクリーンリーダー対応
```svelte
<div role="grid" aria-label="月選択グリッド">
  <div role="row">
    <div role="gridcell" tabindex="0">
      <!-- 月セル -->
    </div>
  </div>
</div>
```

## 今後の拡張可能性

### 1. ドラッグ&ドロップ
- wx-svelte-gridライブラリの活用
- 月間での予算移動

### 2. カスタムビュー
- ガントチャート風表示
- ヒートマップ表示

### 3. エクスポート機能
- CSV/Excel出力
- PDF生成

## まとめ

CSS Gridを活用することで:
1. **柔軟なレイアウト**: 様々なデバイスサイズに対応
2. **高い保守性**: CSS変数による一元管理
3. **優れたUX**: 直感的な操作と視覚的フィードバック

これらのコンポーネントを統合することで、助成期間からの月自動抽出と効率的な予算管理が実現できます。