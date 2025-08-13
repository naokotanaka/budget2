<script lang="ts">
  import { onMount, afterUpdate, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { TabulatorFull as Tabulator } from 'tabulator-tables';
  import type { ColumnDefinition } from 'tabulator-tables';
  import 'tabulator-tables/dist/css/tabulator.min.css';

  const dispatch = createEventDispatcher();

  // Props
  export let grants: any[] = [];
  export let budgetItems: any[] = [];
  export let monthColumns: any[] = [];
  export let selectedGrant: any = null;
  export let showMonthlyBudget: boolean = true;
  export let showMonthlyUsed: boolean = true;
  export let showMonthlyRemaining: boolean = true;
  export let monthFilterStartYear: number = 2025;
  export let monthFilterStartMonth: number = 1;
  export let monthFilterEndYear: number = 2025;
  export let monthFilterEndMonth: number = 12;

  // Internal state
  let tableElement: HTMLElement | null = null;
  let table: Tabulator | null = null;
  let isTableUpdating = false;
  let tableContainer: HTMLElement;

  // フォーマッター関数
  function monthDataFormatter(cell: any) {
    const value = cell.getValue();
    const column = cell.getColumn();
    const field = column.getField();
    const rowData = cell.getRow().getData();
    
    // 月列以外はそのまま返す
    if (!field.startsWith('month_')) {
      return value;
    }
    
    // 月列の場合、年月を抽出
    const monthMatch = field.match(/month_(\d{4})_(\d{1,2})/);
    if (!monthMatch) {
      return value || 0;
    }
    
    const year = parseInt(monthMatch[1]);
    const month = parseInt(monthMatch[2]);
    
    // 現在の年月を取得
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // 対象月が過去・現在・未来かを判定
    const isCurrentOrPast = 
      year < currentYear || 
      (year === currentYear && month <= currentMonth);
    
    const isFuture = 
      year > currentYear || 
      (year === currentYear && month > currentMonth);
    
    // ヘッダー情報から表示タイプを判定
    const header = column.getDefinition().title;
    const isUsedColumn = header && header.includes('使用');
    const isRemainingColumn = header && header.includes('残額');
    const isBudgetColumn = !isUsedColumn && !isRemainingColumn;
    
    // 予算額列の場合
    if (isBudgetColumn) {
      return value > 0 ? value.toLocaleString() : '';
    }
    
    // 使用額列の場合
    if (isUsedColumn) {
      if (isFuture) {
        return '-';
      }
      // 現在月まで：使用額は0
      return '0';
    }
    
    // 残額列の場合
    if (isRemainingColumn) {
      if (isFuture || !value || value <= 0) {
        return '-';
      }
      // 現在月まで：予算額がそのまま残額（使用額0のため）
      return value.toLocaleString();
    }
    
    return value > 0 ? value.toLocaleString() : '';
  }

  // 月データの合計を計算するヘルパー関数
  function calculateMonthlyTotals(rowData: any) {
    let totalBudget = 0;
    let totalUsed = 0;
    let totalRemaining = 0;
    
    // monthColumnsから月データを集計
    monthColumns.forEach(monthCol => {
      const fieldName = `month_${monthCol.year}_${monthCol.month}`;
      const monthlyBudget = rowData[fieldName] || 0;
      
      // 対象月が絞り込み範囲内かチェック
      const targetYear = monthCol.year;
      const targetMonth = monthCol.month;
      const targetDate = targetYear * 100 + targetMonth;
      const filterStartDate = monthFilterStartYear * 100 + monthFilterStartMonth;
      const filterEndDate = monthFilterEndYear * 100 + monthFilterEndMonth;
      
      // 絞り込み範囲外の月はスキップ
      if (targetDate < filterStartDate || targetDate > filterEndDate) {
        return;
      }
      
      // 現在の年月を取得
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // 対象月が過去・現在・未来かを判定
      const isCurrentOrPast = 
        targetYear < currentYear || 
        (targetYear === currentYear && targetMonth <= currentMonth);
      
      // 予算額：実際に数値が表示される場合のみ合計
      if (monthlyBudget > 0) {
        totalBudget += monthlyBudget;
      }
      
      // 使用額：現在月まで0を合計、未来月は"-"表示なので合計に含めない
      if (isCurrentOrPast) {
        const monthlyUsed = 0; // 現在月まで使用額は0
        totalUsed += monthlyUsed;
      }
      
      // 残額：現在月までは予算額がそのまま残額
      if (isCurrentOrPast && monthlyBudget > 0) {
        const monthlyUsed = 0;
        const monthlyRemaining = monthlyBudget - monthlyUsed;
        totalRemaining += monthlyRemaining;
      }
    });
    
    return { totalBudget, totalUsed, totalRemaining };
  }

  // テーブル初期化
  function initializeTable() {
    if (!tableContainer || !budgetItems.length || !monthColumns.length) {
      console.log('🔄 テーブル初期化スキップ - 必要な要素が不足');
      return;
    }

    // 既存のテーブルをクリーンアップ
    if (table) {
      try {
        table.destroy();
      } catch (e) {
        console.warn('テーブルの破棄でエラー:', e);
      }
      table = null;
    }

    const columns: ColumnDefinition[] = [
      {
        title: "予算項目", 
        field: "name", 
        frozen: true,
        width: 200,
        headerSort: false
      },
      {
        title: "予算合計", 
        field: "budgetedAmount", 
        formatter: (cell) => {
          const value = cell.getValue();
          return value > 0 ? value.toLocaleString() : '';
        },
        width: 120,
        headerSort: false
      },
      {
        title: "使用合計", 
        field: "usedAmount", 
        formatter: () => '0',
        width: 120,
        headerSort: false
      },
      {
        title: "残額合計", 
        field: "remainingAmount", 
        formatter: (cell) => {
          const rowData = cell.getRow().getData();
          const budgeted = rowData.budgetedAmount || 0;
          const used = 0; // 使用額は常に0
          const remaining = budgeted - used;
          return remaining > 0 ? remaining.toLocaleString() : '';
        },
        width: 120,
        headerSort: false
      }
    ];

    // 月列を追加
    monthColumns.forEach(monthCol => {
      const fieldName = `month_${monthCol.year}_${monthCol.month}`;
      
      if (showMonthlyBudget) {
        columns.push({
          title: `${monthCol.year}年${monthCol.month}月<br/>予算`,
          field: fieldName,
          formatter: monthDataFormatter,
          width: 100,
          headerSort: false
        });
      }
    });

    console.log('🔄 テーブル初期化開始:', {
      budgetItemsCount: budgetItems.length,
      monthColumnsCount: monthColumns.length,
      columnsCount: columns.length
    });

    try {
      table = new Tabulator(tableContainer, {
        data: budgetItems,
        columns: columns,
        height: "600px",
        layout: "fitColumns",
        resizableRows: false,
        movableColumns: false,
        placeholder: "データがありません"
      });

      console.log('✅ テーブル初期化完了');
      
      // テーブル初期化完了を通知
      dispatch('table-ready');
      
    } catch (error) {
      console.error('❌ テーブル初期化エラー:', error);
      dispatch('table-error', { error });
    }
  }

  // テーブル更新
  function updateTable() {
    if (!table || isTableUpdating) {
      return;
    }

    console.log('🔄 テーブル更新開始');
    isTableUpdating = true;

    try {
      // データを更新
      table.replaceData(budgetItems);
      console.log('✅ テーブル更新完了');
    } catch (error) {
      console.error('❌ テーブル更新エラー:', error);
      dispatch('table-error', { error });
    } finally {
      isTableUpdating = false;
    }
  }

  // 外部から呼び出される更新関数
  export function handleTableUpdate() {
    if (!table) {
      initializeTable();
    } else {
      updateTable();
    }
  }

  onMount(() => {
    console.log('📊 GrantsTable mounted');
    
    // 初期化を遅延実行
    setTimeout(() => {
      if (budgetItems.length > 0 && monthColumns.length > 0) {
        initializeTable();
      }
    }, 100);
  });

  // データが変更された時のテーブル更新
  $: if (budgetItems && monthColumns && table) {
    setTimeout(() => updateTable(), 50);
  }

  onDestroy(() => {
    if (table) {
      try {
        table.destroy();
      } catch (e) {
        console.warn('テーブル破棄エラー:', e);
      }
    }
  });
</script>

<div bind:this={tableContainer} class="w-full"></div>

<style>
  :global(.tabulator) {
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  :global(.tabulator-header) {
    background: #f8fafc !important;
    border-bottom: 2px solid #e5e7eb !important;
  }

  :global(.tabulator-header .tabulator-col) {
    border-right: 1px solid #e5e7eb !important;
    font-weight: 600 !important;
    color: #374151 !important;
    font-size: 0.875rem !important;
  }

  :global(.tabulator-row) {
    border-bottom: 1px solid #f3f4f6 !important;
  }

  :global(.tabulator-row:hover) {
    background: #f9fafb !important;
  }

  :global(.tabulator-cell) {
    border-right: 1px solid #f3f4f6 !important;
    font-size: 0.875rem !important;
    color: #374151 !important;
  }

  :global(.tabulator .tabulator-frozen) {
    border-right: 2px solid #d1d5db !important;
    background: #f8fafc !important;
  }
</style>