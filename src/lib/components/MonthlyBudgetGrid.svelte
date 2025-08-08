<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let budgetItems: any[] = [];
  export let startDate: string;
  export let endDate: string;
  export let viewMode: 'compact' | 'detailed' = 'compact';
  
  const dispatch = createEventDispatcher();
  
  interface MonthColumn {
    year: number;
    month: number;
    yearMonth: string;
    label: string;
    isCurrentMonth: boolean;
  }
  
  interface BudgetRow {
    id: number;
    name: string;
    category: string;
    totalBudget: number;
    monthlyAllocations: Map<string, number>;
    totalAllocated: number;
    remaining: number;
  }
  
  let monthColumns: MonthColumn[] = [];
  let budgetRows: BudgetRow[] = [];
  let hoveredCell: string | null = null;
  
  // 月列を生成
  function generateMonthColumns() {
    if (!startDate || !endDate) {
      monthColumns = [];
      return;
    }
    
    const columns: MonthColumn[] = [];
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (current <= endMonth) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
      
      columns.push({
        year,
        month,
        yearMonth,
        label: viewMode === 'detailed' 
          ? `${year}年${month}月` 
          : `${month.toString().padStart(2, '0')}月`,
        isCurrentMonth: yearMonth === currentYearMonth
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    monthColumns = columns;
  }
  
  // 予算行データを準備
  function prepareBudgetRows() {
    budgetRows = budgetItems.map(item => {
      const allocations = new Map<string, number>();
      let totalAllocated = 0;
      
      // 月別配分データをマップに変換
      if (item.monthlyAllocations) {
        item.monthlyAllocations.forEach((allocation: any) => {
          const key = `${allocation.year}-${allocation.month.toString().padStart(2, '0')}`;
          allocations.set(key, allocation.amount);
          totalAllocated += allocation.amount;
        });
      }
      
      return {
        id: item.id,
        name: item.name,
        category: item.category || '未分類',
        totalBudget: item.budgetedAmount || 0,
        monthlyAllocations: allocations,
        totalAllocated,
        remaining: (item.budgetedAmount || 0) - totalAllocated
      };
    });
  }
  
  // セルの編集
  function editCell(rowId: number, yearMonth: string) {
    dispatch('editCell', { budgetItemId: rowId, yearMonth });
  }
  
  // 行の選択
  function selectRow(rowId: number) {
    dispatch('selectRow', { budgetItemId: rowId });
  }
  
  // 金額のフォーマット
  function formatAmount(amount: number | undefined): string {
    if (!amount) return '-';
    return `¥${amount.toLocaleString()}`;
  }
  
  // 使用率の計算
  function getUtilizationRate(allocated: number, budget: number): number {
    if (!budget || budget === 0) return 0;
    return Math.round((allocated / budget) * 100);
  }
  
  // 使用率に応じた色クラス
  function getUtilizationClass(rate: number): string {
    if (rate >= 100) return 'over-budget';
    if (rate >= 80) return 'high-usage';
    if (rate >= 50) return 'medium-usage';
    return 'low-usage';
  }
  
  // データの更新を監視
  $: {
    generateMonthColumns();
    prepareBudgetRows();
  }
</script>

<div class="budget-grid-container" class:detailed={viewMode === 'detailed'}>
  <!-- ヘッダー情報 -->
  <div class="grid-header">
    <div class="header-info">
      <h3>月別予算配分</h3>
      <span class="period-label">{startDate} ～ {endDate}</span>
    </div>
    <div class="header-actions">
      <button 
        class="view-toggle"
        class:active={viewMode === 'compact'}
        on:click={() => viewMode = 'compact'}
      >
        コンパクト
      </button>
      <button 
        class="view-toggle"
        class:active={viewMode === 'detailed'}
        on:click={() => viewMode = 'detailed'}
      >
        詳細
      </button>
    </div>
  </div>
  
  <!-- グリッドコンテナ -->
  <div class="grid-wrapper">
    <!-- 固定列（項目名・カテゴリ） -->
    <div class="fixed-columns">
      <div class="header-row">
        <div class="cell header-cell name-cell">予算項目</div>
        <div class="cell header-cell category-cell">カテゴリ</div>
        <div class="cell header-cell amount-cell">予算額</div>
      </div>
      {#each budgetRows as row}
        <div class="data-row" on:click={() => selectRow(row.id)}>
          <div class="cell name-cell">
            <span class="item-name">{row.name}</span>
          </div>
          <div class="cell category-cell">
            <span class="category-badge">{row.category}</span>
          </div>
          <div class="cell amount-cell">
            <span class="budget-amount">{formatAmount(row.totalBudget)}</span>
            <div class="utilization-bar">
              <div 
                class="utilization-fill {getUtilizationClass(getUtilizationRate(row.totalAllocated, row.totalBudget))}"
                style="width: {Math.min(100, getUtilizationRate(row.totalAllocated, row.totalBudget))}%"
              ></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
    
    <!-- スクロール可能な月列 -->
    <div class="scrollable-columns">
      <div class="month-header-row">
        {#each monthColumns as month}
          <div 
            class="cell header-cell month-header" 
            class:current-month={month.isCurrentMonth}
          >
            {month.label}
          </div>
        {/each}
        <div class="cell header-cell total-header">合計</div>
      </div>
      
      {#each budgetRows as row}
        <div class="month-data-row">
          {#each monthColumns as month}
            {@const amount = row.monthlyAllocations.get(month.yearMonth)}
            <div 
              class="cell month-cell"
              class:has-value={amount && amount > 0}
              class:current-month={month.isCurrentMonth}
              on:click={() => editCell(row.id, month.yearMonth)}
              on:mouseenter={() => hoveredCell = `${row.id}-${month.yearMonth}`}
              on:mouseleave={() => hoveredCell = null}
              class:hovered={hoveredCell === `${row.id}-${month.yearMonth}`}
            >
              {#if amount && amount > 0}
                <span class="month-amount">{formatAmount(amount)}</span>
              {:else}
                <span class="empty-cell">-</span>
              {/if}
            </div>
          {/each}
          <div class="cell total-cell">
            <span class="total-amount">{formatAmount(row.totalAllocated)}</span>
            {#if row.remaining !== 0}
              <span class="remaining" class:negative={row.remaining < 0}>
                ({row.remaining > 0 ? '+' : ''}{formatAmount(Math.abs(row.remaining))})
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- サマリー行 -->
  <div class="grid-summary">
    <div class="summary-item">
      <span class="summary-label">項目数:</span>
      <span class="summary-value">{budgetRows.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">総予算:</span>
      <span class="summary-value">
        {formatAmount(budgetRows.reduce((sum, row) => sum + row.totalBudget, 0))}
      </span>
    </div>
    <div class="summary-item">
      <span class="summary-label">配分済:</span>
      <span class="summary-value">
        {formatAmount(budgetRows.reduce((sum, row) => sum + row.totalAllocated, 0))}
      </span>
    </div>
  </div>
</div>

<style>
  /* グリッドコンテナ */
  .budget-grid-container {
    --fixed-width: 400px;
    --cell-height: 48px;
    --header-height: 40px;
    --month-cell-width: 100px;
    
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  
  .budget-grid-container.detailed {
    --month-cell-width: 120px;
  }
  
  /* ヘッダー */
  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 2px solid #e5e7eb;
    background: #f9fafb;
  }
  
  .header-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .header-info h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }
  
  .period-label {
    font-size: 0.875rem;
    color: #6b7280;
    padding: 4px 12px;
    background: white;
    border-radius: 16px;
  }
  
  .header-actions {
    display: flex;
    gap: 4px;
  }
  
  .view-toggle {
    padding: 6px 12px;
    border: 1px solid #d1d5db;
    background: white;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .view-toggle:first-child {
    border-radius: 6px 0 0 6px;
  }
  
  .view-toggle:last-child {
    border-radius: 0 6px 6px 0;
    border-left: none;
  }
  
  .view-toggle.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }
  
  /* グリッドラッパー - CSS Grid使用 */
  .grid-wrapper {
    display: grid;
    grid-template-columns: var(--fixed-width) 1fr;
    height: 600px;
    overflow: hidden;
  }
  
  /* 固定列 */
  .fixed-columns {
    display: grid;
    grid-template-rows: var(--header-height) 1fr;
    background: #fafafa;
    border-right: 2px solid #e5e7eb;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .header-row,
  .data-row {
    display: grid;
    grid-template-columns: 1fr 100px 120px;
    min-height: var(--cell-height);
  }
  
  .header-row {
    position: sticky;
    top: 0;
    background: #f3f4f6;
    z-index: 10;
    height: var(--header-height);
  }
  
  .data-row {
    border-bottom: 1px solid #e5e7eb;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .data-row:hover {
    background: #f9fafb;
  }
  
  /* スクロール可能列 */
  .scrollable-columns {
    display: grid;
    grid-template-rows: var(--header-height) 1fr;
    overflow: auto;
  }
  
  .month-header-row,
  .month-data-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, var(--month-cell-width));
    grid-auto-columns: var(--month-cell-width);
    grid-auto-flow: column;
  }
  
  .month-header-row {
    position: sticky;
    top: 0;
    background: #f3f4f6;
    z-index: 5;
    height: var(--header-height);
  }
  
  .month-data-row {
    border-bottom: 1px solid #e5e7eb;
    min-height: var(--cell-height);
  }
  
  /* セル共通スタイル */
  .cell {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-right: 1px solid #e5e7eb;
  }
  
  .header-cell {
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    background: #f3f4f6;
  }
  
  /* 月セル */
  .month-cell {
    cursor: pointer;
    transition: all 0.2s;
    justify-content: center;
  }
  
  .month-cell:hover {
    background: #eff6ff;
  }
  
  .month-cell.hovered {
    background: #dbeafe;
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
  }
  
  .month-cell.has-value {
    background: #f0f9ff;
  }
  
  .month-cell.current-month {
    background: #fef3c7;
  }
  
  .month-header.current-month {
    background: #fbbf24;
    color: white;
    font-weight: 600;
  }
  
  .month-amount {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
  }
  
  .empty-cell {
    color: #d1d5db;
    font-size: 0.875rem;
  }
  
  /* 項目名セル */
  .name-cell {
    font-weight: 500;
  }
  
  .item-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* カテゴリセル */
  .category-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #e5e7eb;
    border-radius: 12px;
    font-size: 0.75rem;
    color: #4b5563;
  }
  
  /* 金額セル */
  .amount-cell {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .budget-amount {
    font-weight: 600;
    font-size: 0.875rem;
  }
  
  /* 使用率バー */
  .utilization-bar {
    width: 100%;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
  }
  
  .utilization-fill {
    height: 100%;
    transition: width 0.3s ease;
  }
  
  .utilization-fill.low-usage {
    background: #10b981;
  }
  
  .utilization-fill.medium-usage {
    background: #3b82f6;
  }
  
  .utilization-fill.high-usage {
    background: #f59e0b;
  }
  
  .utilization-fill.over-budget {
    background: #ef4444;
  }
  
  /* 合計セル */
  .total-cell {
    background: #f9fafb;
    font-weight: 600;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  
  .total-amount {
    font-size: 0.875rem;
    color: #1f2937;
  }
  
  .remaining {
    font-size: 0.75rem;
    color: #10b981;
  }
  
  .remaining.negative {
    color: #ef4444;
  }
  
  /* サマリー */
  .grid-summary {
    display: flex;
    gap: 24px;
    padding: 12px 20px;
    background: #f9fafb;
    border-top: 2px solid #e5e7eb;
  }
  
  .summary-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .summary-label {
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .summary-value {
    font-weight: 600;
    color: #111827;
  }
  
  /* レスポンシブ対応 */
  @media (max-width: 768px) {
    .budget-grid-container {
      --fixed-width: 200px;
      --month-cell-width: 80px;
      --cell-height: 40px;
    }
    
    .header-row,
    .data-row {
      grid-template-columns: 1fr 60px 80px;
    }
    
    .grid-wrapper {
      height: 400px;
    }
    
    .grid-summary {
      flex-direction: column;
      gap: 8px;
    }
  }
  
  /* ダークモード対応 */
  @media (prefers-color-scheme: dark) {
    .budget-grid-container {
      background: #1f2937;
    }
    
    .grid-header {
      background: #111827;
      border-bottom-color: #374151;
    }
    
    .header-info h3 {
      color: #f3f4f6;
    }
    
    .period-label {
      background: #374151;
      color: #d1d5db;
    }
    
    .view-toggle {
      background: #374151;
      border-color: #4b5563;
      color: #d1d5db;
    }
    
    .view-toggle.active {
      background: #3b82f6;
      border-color: #3b82f6;
    }
    
    .fixed-columns {
      background: #111827;
      border-right-color: #374151;
    }
    
    .header-cell {
      background: #1f2937;
      color: #d1d5db;
    }
    
    .data-row {
      border-bottom-color: #374151;
    }
    
    .data-row:hover {
      background: #374151;
    }
    
    .cell {
      border-right-color: #374151;
    }
    
    .month-cell:hover {
      background: #1e3a8a;
    }
    
    .month-cell.has-value {
      background: #1e293b;
    }
    
    .month-cell.current-month {
      background: #713f12;
    }
    
    .category-badge {
      background: #374151;
      color: #9ca3af;
    }
    
    .utilization-bar {
      background: #374151;
    }
    
    .total-cell {
      background: #111827;
    }
    
    .grid-summary {
      background: #111827;
      border-top-color: #374151;
    }
    
    .summary-label {
      color: #9ca3af;
    }
    
    .summary-value {
      color: #f3f4f6;
    }
  }
</style>