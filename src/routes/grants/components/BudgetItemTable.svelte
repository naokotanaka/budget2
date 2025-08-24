<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import { TabulatorFull as Tabulator } from 'tabulator-tables';
  import type { ColumnDefinition, CellComponent } from 'tabulator-tables';
  import 'tabulator-tables/dist/css/tabulator.min.css';
  import type { Grant, BudgetItem, BudgetItemSchedule } from '$lib/types/models';
  import type { 
    BudgetItemTableData, 
    MonthColumn, 
    TableDisplaySettings,
    CustomColumnDefinition 
  } from '$lib/types/tabulator';
  

  // Props
  export let budgetItems: BudgetItem[] = [];
  export let grants: Grant[] = [];
  export let selectedGrant: Grant | null = null;
  export let showMonthlyBudget: boolean = true;
  export let showMonthlyUsed: boolean = false;
  export let showMonthlyRemaining: boolean = false;
  export let monthFilterStartYear: number = 2025;
  export let monthFilterStartMonth: number = 1;
  export let monthFilterEndYear: number = 2025;
  export let monthFilterEndMonth: number = 12;
  export let budgetItemSchedules: Map<number, {months: string[], scheduleData: Map<string, {monthlyBudget: number}>}> = new Map();
  export let schedulesLoaded: boolean = false;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Local variables
  let tableElement: HTMLDivElement | undefined;
  let categoryTableElement: HTMLDivElement | undefined;
  let table: Tabulator | null = null;
  let categoryTable: Tabulator | null = null;
  let columns: ColumnDefinition[] = [];
  let baseColumns: ColumnDefinition[] = [];
  let tableData: BudgetItemTableData[] = [];
  let lastValidBudgetItems: BudgetItem[] = []; // データのバックアップ用
  
  // 表示設定を保持するオブジェクト（カテゴリテーブル用）
  let currentDisplaySettings = {
    showMonthlyBudget: showMonthlyBudget,
    showMonthlyUsed: showMonthlyUsed,
    showMonthlyRemaining: showMonthlyRemaining
  };
  let categoryTableData: BudgetItemTableData[] = [];
  let monthColumns: MonthColumn[] = [];
  let isTableInitializing = false;
  let isTableUpdating = false;
  let lastDisplaySettings: TableDisplaySettings = {
    showMonthlyBudget: true,
    showMonthlyUsed: false,
    showMonthlyRemaining: false,
    monthFilterStartYear: 2025,
    monthFilterStartMonth: 1,
    monthFilterEndYear: 2025,
    monthFilterEndMonth: 12
  };

  // 動的行高さの計算
  $: activeItemCount = [showMonthlyBudget, showMonthlyUsed, showMonthlyRemaining].filter(Boolean).length;
  $: dynamicRowHeight = activeItemCount === 1 ? 30 : activeItemCount === 2 ? 45 : 65;

  // Reactive updates
  $: if (budgetItems && grants) {
    monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
  }

  $: if (browser && tableElement && budgetItems.length > 0 && monthColumns.length > 0 && !isTableUpdating) {
    handleTableUpdate();
  }

  // カテゴリテーブルの更新（初期化後のみ）
  $: if (browser && categoryTableElement && budgetItems.length > 0) {
    // 少し遅延させて確実に初期化後に実行
    setTimeout(() => {
      categoryTableData = generateCategoryData();
      updateCategoryTable();
    }, 100);
  }

  // 表示設定が変更された時の処理は下のreactive blockで一元管理

  // Handle display settings changes
  $: {
    const currentSettings = {
      showMonthlyBudget,
      showMonthlyUsed,
      showMonthlyRemaining,
      monthFilterStartYear,
      monthFilterStartMonth,
      monthFilterEndYear,
      monthFilterEndMonth
    };
    
    if (table && JSON.stringify(currentSettings) !== JSON.stringify(lastDisplaySettings)) {
      handleDisplaySettingsChange(currentSettings);
      // カテゴリテーブルの更新はhandleDisplaySettingsChange内で行う
    }
  }





  // Helper functions
  function formatAmount(amount?: number, includeYen: boolean = true): string {
    // nullまたはundefinedまたは0の場合
    if (amount == null || amount === 0) {
      return includeYen ? '¥0' : '0';
    }
    
    // 正常な値の場合
    return includeYen ? `¥${amount.toLocaleString()}` : amount.toLocaleString();
  }

  function calculateMonthlyTotals(rowData: BudgetItemTableData) {
    let totalBudget = 0;
    let totalUsed = 0;
    let totalRemaining = 0;

    const filteredMonths = getFilteredMonthColumns();
    
    filteredMonths.forEach(monthCol => {
      const monthlyBudget = getMonthlyAmount(rowData, monthCol.year, monthCol.month);
      const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
      const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
      const monthlyRemaining = monthlyBudget - monthlyUsed;

      if (showMonthlyBudget) totalBudget += monthlyBudget;
      if (showMonthlyUsed) totalUsed += monthlyUsed;
      if (showMonthlyRemaining) totalRemaining += monthlyRemaining;
    });

    return {
      totalBudget,
      totalUsed,
      totalRemaining
    };
  }


  function generateMonthColumns(grantsData: Grant[], selectedGrantData: Grant | null, currentBudgetItems: BudgetItem[]): MonthColumn[] {
    
    if (selectedGrantData) {
      // 選択された助成金の期間から生成
      if (selectedGrantData.startDate && selectedGrantData.endDate) {
        const start = new Date(selectedGrantData.startDate);
        const end = new Date(selectedGrantData.endDate);
        const months = [];
        
        const current = new Date(start);
        while (current <= end) {
          months.push({
            year: current.getFullYear(),
            month: current.getMonth() + 1,
            label: `${current.getFullYear()}/${(current.getMonth() + 1).toString().padStart(2, '0')}`
          });
          current.setMonth(current.getMonth() + 1);
        }
        return months;
      }
      return [];
    }
    
    // 予算項目に関連する助成金から期間を収集
    const relevantGrants = new Set<number>();
    currentBudgetItems.forEach(item => {
      if (item.grantId) {
        relevantGrants.add(item.grantId);
      }
    });
    
    const months: Array<{year: number, month: number, label: string}> = [];
    const uniqueMonths = new Set<string>();
    
    // 関連する助成金の期間から月を生成
    grantsData.forEach(grant => {
      if (!relevantGrants.has(grant.id)) return;
      
      if (grant.startDate && grant.endDate) {
        const start = new Date(grant.startDate);
        const end = new Date(grant.endDate);
        
        const current = new Date(start);
        while (current <= end) {
          const monthKey = `${current.getFullYear()}-${current.getMonth() + 1}`;
          if (!uniqueMonths.has(monthKey)) {
            uniqueMonths.add(monthKey);
            months.push({
              year: current.getFullYear(),
              month: current.getMonth() + 1,
              label: `${current.getFullYear()}/${(current.getMonth() + 1).toString().padStart(2, '0')}`
            });
          }
          current.setMonth(current.getMonth() + 1);
        }
      }
    });
    
    // 時系列でソート
    months.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    return months;
  }

  function getFilteredMonthColumns() {
    
    if (!monthColumns || monthColumns.length === 0) {
      return [];
    }
    
    const filtered = monthColumns.filter(col => {
      const colDate = col.year * 100 + col.month;
      const startDate = monthFilterStartYear * 100 + monthFilterStartMonth;
      const endDate = monthFilterEndYear * 100 + monthFilterEndMonth;
      
      const isInRange = colDate >= startDate && colDate <= endDate;
      
      
      return isInRange;
    });
    
    return filtered;
  }

  function getMonthlyAmount(item: BudgetItemTableData, targetYear: number, targetMonth: number): number {
    // カテゴリデータの場合、monthlyDataから直接取得
    if (String(item.id).startsWith('category-')) {
      const correctMonthKey = `${targetYear}-${targetMonth.toString().padStart(2, '0')}`;
      return item.monthlyData?.[correctMonthKey]?.budget || 0;
    }
    
    // 通常の予算項目の場合
    const schedules = budgetItemSchedules.get(item.id);
    if (!schedules || !schedules.scheduleData) {
      return 0;
    }
    
    // 複数の月次キー形式を試行して値を取得
    const monthKey1 = `${targetYear.toString().slice(-2)}/${targetMonth.toString().padStart(2, '0')}`;  // "25/04"形式
    const monthKey2 = `${targetYear}-${targetMonth.toString().padStart(2, '0')}`;  // "2025-04"形式
    
    // まず"YY/MM"形式を試す
    if (schedules.scheduleData.has(monthKey1)) {
      const monthData = schedules.scheduleData.get(monthKey1);
      return monthData?.monthlyBudget || 0;
    }
    
    // 次に"YYYY-MM"形式を試す
    if (schedules.scheduleData.has(monthKey2)) {
      const monthData = schedules.scheduleData.get(monthKey2);
      return monthData?.monthlyBudget || 0;
    }
    
    // どちらの形式でも見つからない場合は0を返す
    return 0;
  }

  // formatter関数を動的に生成する関数
  function createCellFormatter() {
    // 現在の表示設定をキャプチャして新しいフォーマッター関数を生成
    const currentShowBudget = showMonthlyBudget;
    const currentShowUsed = showMonthlyUsed;
    const currentShowRemaining = showMonthlyRemaining;
    
    return (cell: CellComponent) => {
      try {
      
      // スクロール時の問題対策: 行データの存在確認
      const row = cell.getRow();
      if (!row) {
        return '';
      }

      const rowData = row.getData();
      if (!rowData) {
        return '';
      }
      
      const field = cell.getField();
      

      
      // フィールドに応じて値を取得
      let budgetedAmount, usedAmount, remainingAmount;
      
      if (field === 'budgetedAmount') {
        // 全体カラムの場合（budgetedAmountフィールドを使用）
        budgetedAmount = rowData.budgetedAmount;
        usedAmount = rowData.usedAmount;
        remainingAmount = rowData.remainingAmount;
        

      } else if (field === 'monthTotal') {
        // 月計カラムの場合
        const monthlyTotals = calculateMonthlyTotals(rowData as BudgetItemTableData);
        budgetedAmount = monthlyTotals.totalBudget;
        usedAmount = monthlyTotals.totalUsed;
        remainingAmount = monthlyTotals.totalRemaining;
      } else {
        // その他（通常は発生しない）
        budgetedAmount = rowData.budgetedAmount;
        usedAmount = rowData.usedAmount;
        remainingAmount = rowData.remainingAmount;
      }
      

      
      const items = [];
      if (currentShowBudget) {
      
        const formatted = formatAmount(budgetedAmount);
        items.push(`<div style="padding: 1px 3px; font-size: 13px;">${formatted}</div>`);
      }
      if (currentShowUsed) {
        items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${formatAmount(usedAmount)}</div>`);
      }
      if (currentShowRemaining) {
        const color = remainingAmount < 0 ? 'color: red; font-weight: bold;' : '';
        items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><span style="${color}">${formatAmount(remainingAmount)}</span></div>`);
      }
      

      
      if (items.length === 0) {
        return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">&nbsp;</div>';
      }
      
      const html = `
        <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
          ${items.join('')}
        </div>
      `;
      
      return html;
      } catch (error) {
        return '';
      }
    };
  }
  
  // 月計formatterを動的に生成
  function createMonthTotalFormatter() {
    // 現在の表示設定をキャプチャして新しいフォーマッター関数を生成
    const currentShowBudget = showMonthlyBudget;
    const currentShowUsed = showMonthlyUsed;
    const currentShowRemaining = showMonthlyRemaining;
    
    return (cell: CellComponent) => {
      try {
      
      // スクロール時の問題対策: 行データの存在確認
      const row = cell.getRow();
      if (!row) {
        return '';
      }
      
      const rowData = row.getData();
      if (!rowData) {
        return '';
      }
      const monthlyTotals = calculateMonthlyTotals(rowData as BudgetItemTableData);
      
      const items = [];
      if (currentShowBudget) {
        items.push(`<div style="padding: 1px 3px; font-size: 13px;">${formatAmount(monthlyTotals.totalBudget, false)}</div>`);
      }
      if (currentShowUsed) {
        items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${formatAmount(monthlyTotals.totalUsed, false)}</div>`);
      }
      if (currentShowRemaining) {
        const color = monthlyTotals.totalRemaining < 0 ? 'color: red; font-weight: bold;' : '';
        items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><span style="${color}">${formatAmount(monthlyTotals.totalRemaining, false)}</span></div>`);
      }
      
      if (items.length === 0) {
        return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
      }
      
      return `
        <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
          ${items.join('')}
        </div>
      `;
      } catch (error) {
        return '';
      }
    };
  }

  function initializeTableColumns() {
    
    // 基本列を固定で定義
    const fixedBaseColumns = [
      {
        title: "助成金",
        field: "grantName",
        frozen: true,
        minWidth: 100,
        width: 140,
        widthGrow: 0.5,
        sorter: "string",
        bottomCalc: () => "合計"
      },
      {
        title: "項目名", 
        field: "name",
        frozen: true,
        width: 160,
        minWidth: 120,
        widthGrow: 1,
        sorter: "string",
        bottomCalc: () => ""
      },
      {
        title: "カテゴリ",
        field: "category",
        width: 90,
        minWidth: 80,
        widthGrow: 0.3,
        sorter: "string",
        bottomCalc: () => ""
      },
      {
        title: "全体",
        field: "budgetedAmount",  // 実際のデータフィールドを使用
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        hozAlign: "right",
        bottomCalcFormatter: "html",
        bottomCalc: (_values: any, data: any, _calcParams: any) => {
          // データが空の場合は早期リターン
          if (!data || data.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          let totalBudget = 0;
          let totalUsed = 0;
          let totalRemaining = 0;
          
          data.forEach((row: any) => {
            totalBudget += row.budgetedAmount || 0;
            totalUsed += row.usedAmount || 0;
            totalRemaining += row.remainingAmount || 0;
          });
          

          
          const items = [];
          if (showMonthlyBudget) {
            items.push(`<div style="padding: 1px 3px; font-size: 13px;">${formatAmount(totalBudget)}</div>`);
          }
          if (showMonthlyUsed) {
            items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${formatAmount(totalUsed)}</div>`);
          }
          if (showMonthlyRemaining) {
            const color = totalRemaining < 0 ? 'color: red; font-weight: bold;' : '';
            items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><span style="${color}">${formatAmount(totalRemaining)}</span></div>`);
          }
          
          if (items.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          return `
            <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
              ${items.join('')}
            </div>
          `;
        },
        formatter: createCellFormatter()
      },
      {
        title: "月計",
        field: "monthTotal",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        hozAlign: "right",
        bottomCalcFormatter: "html",
        bottomCalc: (_values: any, data: any, _calcParams: any) => {
          // データが空の場合は早期リターン
          if (!data || data.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          let totalBudget = 0;
          let totalUsed = 0;
          let totalRemaining = 0;
          
          const filteredMonths = getFilteredMonthColumns();
          
          data.forEach((row: any) => {
            filteredMonths.forEach(monthCol => {
              const monthlyBudget = getMonthlyAmount(row, monthCol.year, monthCol.month);
              const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
              const monthlyUsed = row.monthlyUsedAmounts?.[monthKey] || 0;
              const monthlyRemaining = monthlyBudget - monthlyUsed;
              
              if (showMonthlyBudget) totalBudget += monthlyBudget;
              if (showMonthlyUsed) totalUsed += monthlyUsed;
              if (showMonthlyRemaining) totalRemaining += monthlyRemaining;
            });
          });
          
          const items = [];
          if (showMonthlyBudget) {
            items.push(`<div style="padding: 1px 3px; font-size: 13px;">${formatAmount(totalBudget, false)}</div>`);
          }
          if (showMonthlyUsed) {
            items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${formatAmount(totalUsed, false)}</div>`);
          }
          if (showMonthlyRemaining) {
            const color = totalRemaining < 0 ? 'color: red; font-weight: bold;' : '';
            items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><span style="${color}">${formatAmount(totalRemaining, false)}</span></div>`);
          }
          
          if (items.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          return `
            <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
              ${items.join('')}
            </div>
          `;
        },
        formatter: createMonthTotalFormatter()
      }
    ];
    
    // 基本列を設定
    baseColumns = [...fixedBaseColumns] as ColumnDefinition[];
    
    // 月列を動的に構築
    const monthColumnDefs: ColumnDefinition[] = [];
    if (monthColumns && monthColumns.length > 0) {
      // 月フィルタリングを適用
      const filteredMonthColumns = getFilteredMonthColumns();

      
      // 月別formatterを動的に生成する関数
      function createMonthFormatter(monthCol: MonthColumn) {
        // 現在の表示設定をキャプチャして新しいフォーマッター関数を生成
        const currentShowBudget = showMonthlyBudget;
        const currentShowUsed = showMonthlyUsed;
        const currentShowRemaining = showMonthlyRemaining;
        const formatterId = Math.random().toString(36).substr(2, 9);
        
        const formatter = (cell: CellComponent) => {
          
          // スクロール時の問題対策: getValue()ではなくrowDataから直接取得
          const row = cell.getRow();
          if (!row) {
            return '';
          }
          
          const rowData = row.getData();
          if (!rowData) {
            return '';
          }
          
          // フィールド名から値を直接取得
          const field = cell.getField();
          const monthlyBudget = rowData[field] ?? 0;
          
          // デバッグ: 月別データの値を確認

          
          // 現在の年月を取得
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          
          // 対象月が過去・現在・未来かを判定
          const isCurrentOrPast = 
            monthCol.year < currentYear || 
            (monthCol.year === currentYear && monthCol.month <= currentMonth);
          
          // 表示制御
          const budgetDisplay = monthlyBudget > 0 ? monthlyBudget.toLocaleString() : '-';
          
          // 使用額
          let usedDisplay = '-';
          if (isCurrentOrPast) {
            const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
            const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
            usedDisplay = monthlyUsed > 0 ? monthlyUsed.toLocaleString() : '0';
          }
          
          // 残額
          let remainingDisplay = '-';
          if (isCurrentOrPast) {
            const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
            const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
            const monthlyRemaining = monthlyBudget - monthlyUsed;
            
            if (monthlyBudget > 0 || monthlyUsed > 0) {
              const color = monthlyRemaining < 0 ? 'color: red; font-weight: bold;' : '';
              remainingDisplay = `<span style="${color}">${monthlyRemaining.toLocaleString()}</span>`;
            } else {
              remainingDisplay = '0';
            }
          } else {
            remainingDisplay = '-';
          }
          
          const items = [];
          
          // デバッグ: 表示設定の値を確認
          if (!(window as any)[`monthLog_${formatterId}`]) {
            (window as any)[`monthLog_${formatterId}`] = 0;
          }
          (window as any)[`monthLog_${formatterId}`]++;
          
          if ((window as any)[`monthLog_${formatterId}`] <= 3 || monthlyBudget > 0) {
                  }
          
          if (currentShowBudget) {
            items.push(`<div style="padding: 1px 3px; font-size: 13px;">${budgetDisplay}</div>`);
          }
          if (currentShowUsed) {
            items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${usedDisplay}</div>`);
          }
          if (currentShowRemaining) {
            items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${remainingDisplay}</div>`);
          }
          
          if (items.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          return `
            <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
              ${items.join('')}
            </div>
          `;
        };
        return formatter;
      }
      
      // フィルタリングされた月列のみを追加
      filteredMonthColumns.forEach((monthCol, index) => {
        const columnDef = {
          title: monthCol.label,
          field: `month_${monthCol.year}_${monthCol.month}`,
          width: 90,
          minWidth: 80,
          maxWidth: 110,
          hozAlign: "right" as const,
          bottomCalcFormatter: "html" as any,
          bottomCalc: (_values: any, data: any, _calcParams: any) => {
            let totalBudget = 0;
            let totalUsed = 0;
            let totalRemaining = 0;
            
            // 現在の年月を取得
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            
            // 対象月が過去・現在・未来かを判定
            const isCurrentOrPast = 
              monthCol.year < currentYear || 
              (monthCol.year === currentYear && monthCol.month <= currentMonth);
            
            data.forEach((row: any) => {
              const monthlyBudget = getMonthlyAmount(row, monthCol.year, monthCol.month);
              const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
              const monthlyUsed = row.monthlyUsedAmounts?.[monthKey] || 0;
              const monthlyRemaining = monthlyBudget - monthlyUsed;
              
              // 予算は常に合計
              totalBudget += monthlyBudget;
              
              // 使用額と残額は過去・現在月のみ合計
              if (isCurrentOrPast) {
                totalUsed += monthlyUsed;
                // 予算または使用額がある場合のみ残額を計算
                if (monthlyBudget > 0 || monthlyUsed > 0) {
                  totalRemaining += monthlyRemaining;
                }
              }
            });
            
            const items = [];
            if (showMonthlyBudget) {
              items.push(`<div style="padding: 1px 3px; font-size: 13px;">${totalBudget.toLocaleString()}</div>`);
            }
            if (showMonthlyUsed) {
              const usedDisplay = isCurrentOrPast ? totalUsed.toLocaleString() : '-';
              items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${usedDisplay}</div>`);
            }
            if (showMonthlyRemaining) {
              if (isCurrentOrPast) {
                const color = totalRemaining < 0 ? 'color: red; font-weight: bold;' : '';
                items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><span style="${color}">${totalRemaining.toLocaleString()}</span></div>`);
              } else {
                items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;">-</div>`);
              }
            }
            
            if (items.length === 0) {
              return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
            }
            
            return `
              <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
                ${items.join('')}
              </div>
            `;
          },
          formatter: createMonthFormatter(monthCol)
        };
        monthColumnDefs.push(columnDef);
          });
    }
    
    // 操作列を追加（最初に配置するため、frozenも設定）
    const actionColumn = {
      title: "操作",
      field: "actions",
      width: 80,
      frozen: true,  // 左側に固定
      hozAlign: "center" as const,
      bottomCalc: () => "",
      formatter: () => `
        <div style="display: flex; justify-content: center; align-items: center;">
          <button data-action="edit" style="color: #2563eb; cursor: pointer; padding: 2px 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; font-size: 11px;">編集</button>
        </div>
      `,
      cellClick: (e: any, cell: any) => {
        const target = e.target as HTMLElement;
        const action = target.getAttribute('data-action');
        const rowData = cell.getRow().getData();
        const item = budgetItems.find(i => i.id === rowData.id);
        
        if (item && action === 'edit') {
          dispatch('edit', { item });
        }
      }
    };

    // 最終的な列定義を構築（操作列を最初に配置）
    columns = [actionColumn, ...baseColumns, ...monthColumnDefs];
  }

  function prepareTableData() {
    // budgetItemsが空の場合はバックアップから復元を試みる
    if (!budgetItems || budgetItems.length === 0) {
      if (lastValidBudgetItems && lastValidBudgetItems.length > 0) {
        // budgetItemsは外部プロパティなので直接変更不可
      } else {

        tableData = [];
        return;
      }
    } else {
      // 有効なデータがある場合はバックアップを更新
      lastValidBudgetItems = [...budgetItems];
    }
    
    // dataSourceを使用してマップ
    const dataSource = (!budgetItems || budgetItems.length === 0) && lastValidBudgetItems.length > 0 
      ? lastValidBudgetItems 
      : budgetItems;
      
    tableData = dataSource.map((item, index) => {
      const remaining = (item.budgetedAmount || 0) - (item.usedAmount || 0);
      const grant = grants.find(g => g.id === item.grantId);
      const baseData = {
        ...item,
        grantId: item.grantId || 0,
        grantName: grant?.name || '未設定',
        category: item.category || '未分類',
        usedAmount: item.usedAmount || 0,
        budgetedAmount: item.budgetedAmount || 0,
        remainingAmount: remaining,
        actions: ''
      };
      

      
      // 月別データを追加（全ての月のデータを追加）
      if (monthColumns && monthColumns.length > 0) {
        // 全ての月のデータを追加（フィルターに関係なく）
        const monthlyData = monthColumns.reduce((acc, monthCol) => {
          const monthAmount = getMonthlyAmount(baseData, monthCol.year, monthCol.month);
          const fieldKey = `month_${monthCol.year}_${monthCol.month}`;
          (acc as any)[fieldKey] = monthAmount;
          return acc;
        }, {} as Record<string, number>);
        Object.assign(baseData, monthlyData);
      }
      
      return baseData;
    });
    
    // デバッグ: 最初のアイテムの月別データを確認
    if (tableData.length > 0) {
      const firstItem = tableData[0];
      const monthFields = Object.keys(firstItem).filter(key => key.startsWith('month_'));
      }
  }

  function initializeTable() {
    if (isTableInitializing) {
      return;
    }

    isTableInitializing = true;
    
    if (table) {
      table.destroy();
      table = null;
    }
    
    if (!tableElement) {
            isTableInitializing = false;
      return;
    }

    if (columns.length === 0) {
            isTableInitializing = false;
      return;
    }
    
    try {
      // 表示設定変更時は完全なカラム定義を使用
      const initColumns = columns.length > 0 ? columns : baseColumns;
      
      // 画面サイズに応じた高さを計算
      const viewportHeight = window.innerHeight;
      let tableHeight = "600px";
      
      if (viewportHeight > 1000) {
        // 大画面: 画面の70%
        tableHeight = `${Math.floor(viewportHeight * 0.7)}px`;
      } else if (viewportHeight > 768) {
        // 中画面: 画面の60%
        tableHeight = `${Math.floor(viewportHeight * 0.6)}px`;
      } else {
        // 小画面: 固定400px
        tableHeight = "400px";
      }

      
        if (tableData.length > 0) {
        const firstItem = tableData[0];
          }
      
      table = new Tabulator(tableElement, {
        data: tableData, // 初期化時にデータを設定
        columns: initColumns,
        layout: "fitDataFill",
        responsiveLayout: false,
        autoResize: false, // 自動リサイズを無効化（F12対策）
        rowHeight: dynamicRowHeight, // 動的行高さを設定
        height: tableHeight, // レスポンシブな高さ設定
        maxHeight: "90vh", // 最大で画面の90%
        pagination: true,
        paginationSize: 20, // ページサイズを小さくして仮想DOMの影響を減らす
        paginationSizeSelector: [20, 50, 100],
        movableColumns: true,
        resizableRows: false,
        selectableRows: 1,
        scrollToColumnPosition: "left",
        reactiveData: false, // リアクティブデータを無効化
        renderVertical: "basic", // 基本的なレンダリングモード
        renderHorizontal: "basic", // 基本的なレンダリングモード
        columnCalcs: "both" // テーブル内フッターに計算結果を表示
      });
      
      // tableBuiltイベントでデータを確認
      table.on("tableBuilt", function() {
        if (!table) return;
        const dataAfterBuilt = table.getData();
            // データが空の場合、再度設定を試みる
        if ((!dataAfterBuilt || dataAfterBuilt.length === 0) && tableData && tableData.length > 0) {
          table.setData(tableData);
        }
        
        isTableInitializing = false;
        isTableUpdating = false;
      });

      // 重複削除（上で定義済み）
      



    } catch (error: any) {
            isTableInitializing = false;
      isTableUpdating = false;
      table = null;
    }
  }

  function updateTable() {
    if (!tableElement) {
        return;
    }

    if (isTableInitializing) {
        setTimeout(() => updateTable(), 200);
      return;
    }

    // データを再準備（最新の状態を反映）
    prepareTableData();
    
    if (table) {
      try {
            // テーブルを完全に再構築
        table.destroy();
        table = null;
        
        // カラムを再初期化（新しいフォーマッターを生成）
        initializeTableColumns();
        
        // テーブルを再作成
        initializeTable();
        
      } catch (error) {
        console.error('Error updating table:', error);
        initializeTable();
      }
    } else {
        initializeTable();
    }
  }

  function handleTableUpdate() {
    
    if (!tableElement) {
      return;
    }
    
    if (budgetItems.length === 0) {
      return;
    }
    
    isTableUpdating = true;
    
    try {
      initializeTableColumns();
      prepareTableData();
      updateTable();
    } catch (error: any) {
          } finally {
      isTableUpdating = false;
    }
  }

  function handleDisplaySettingsChange(currentSettings: TableDisplaySettings) {
    lastDisplaySettings = { ...currentSettings };
    
    // グローバル表示設定を更新
    currentDisplaySettings.showMonthlyBudget = currentSettings.showMonthlyBudget;
    currentDisplaySettings.showMonthlyUsed = currentSettings.showMonthlyUsed;
    currentDisplaySettings.showMonthlyRemaining = currentSettings.showMonthlyRemaining;
    
    // テーブルが既に存在する場合、完全に再構築
    if (table) {
      // データを再準備（最新の状態を反映）
      prepareTableData();
      
      // テーブルを破棄
      table.destroy();
      table = null;
      
      // カラムを再初期化（新しいフォーマッターが生成される）
      initializeTableColumns();
      
      // テーブルを再初期化
      initializeTable();
      
      // カテゴリテーブルも再初期化
      if (categoryTable) {
        categoryTable.destroy();
        categoryTable = null;
        initializeCategoryTable();
      }
    } else {
      // テーブルがまだ存在しない場合
      if (budgetItems && budgetItems.length > 0) {
        initializeTableColumns();
        prepareTableData();
        initializeTable();
        
        categoryTableData = generateCategoryData();
        initializeCategoryTable();
      }
    }
  }

  // Lifecycle
  onMount(() => {
    // 初期化時の処理があればここに
  })

  // カテゴリ別集計データを生成
  function generateCategoryData(): BudgetItemTableData[] {
    console.log('generateCategoryData開始');
    console.log('monthColumns:', monthColumns?.length);
    console.log('budgetItems:', budgetItems.length);
    
    const categoryMap = new Map<string, BudgetItemTableData>();
    
    // 予算項目をカテゴリ別に集計
    budgetItems.forEach(item => {
      const category = item.category || '未分類';
      
      if (!categoryMap.has(category)) {
        // カテゴリIDを一意にするため、category-接頭語を付ける
        const categoryId = `category-${Math.abs(category.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0))}`;
        categoryMap.set(category, {
          id: categoryId as any, // string型だが、テーブルでは文字列として処理される
          grantId: 0,
          grantName: 'カテゴリ集計',
          name: category,
          category: '',
          budgetedAmount: 0,
          usedAmount: 0,
          remainingAmount: 0,
          monthlyData: {},
          monthlyUsedAmounts: {},
          monthlyTotal: 0,
          monthlyUsedTotal: 0,
          monthlyRemainingTotal: 0
        });
      }
      
      const categoryData = categoryMap.get(category)!;
      categoryData.budgetedAmount += item.budgetedAmount || 0;
      categoryData.usedAmount += item.usedAmount || 0;
      categoryData.remainingAmount = categoryData.budgetedAmount - categoryData.usedAmount;
      
      // 月別データの集計
      const scheduleInfo = budgetItemSchedules.get(item.id);
      if (scheduleInfo && scheduleInfo.scheduleData) {
        console.log(`項目[${item.name}] スケジュールデータ:`, scheduleInfo.scheduleData.size, '件');
        
        scheduleInfo.scheduleData.forEach((monthData, monthKey) => {
          console.log(`  月キー: ${monthKey}, 予算: ${monthData.monthlyBudget}`);
          
          // monthKeyの形式を統一（"25/04"形式を"2025-04"に変換）
          let correctMonthKey = monthKey;
          if (monthKey.includes('/')) {
            const parts = monthKey.split('/');
            if (parts[0].length === 2) {
              correctMonthKey = `20${parts[0]}-${parts[1]}`;
            }
          }
          
          const monthlyBudget = monthData.monthlyBudget || 0;
          
          if (!categoryData.monthlyData) {
            categoryData.monthlyData = {};
          }
          if (!categoryData.monthlyData[correctMonthKey]) {
            categoryData.monthlyData[correctMonthKey] = {
              budget: 0,
              used: 0,
              remaining: 0
            };
          }
          
          categoryData.monthlyData[correctMonthKey].budget += monthlyBudget;
          console.log(`  カテゴリ[${category}] ${correctMonthKey}月予算累計: ${categoryData.monthlyData[correctMonthKey].budget}`);
        });
      }
      
      // 月別使用額を集計（予算項目のmonthlyUsedAmountsから）
      if (item.monthlyUsedAmounts) {
        Object.entries(item.monthlyUsedAmounts).forEach(([monthKey, amount]) => {
          if (!categoryData.monthlyUsedAmounts) {
            categoryData.monthlyUsedAmounts = {};
          }
          if (!categoryData.monthlyUsedAmounts[monthKey]) {
            categoryData.monthlyUsedAmounts[monthKey] = 0;
          }
          categoryData.monthlyUsedAmounts[monthKey] += amount as number;
          
          // monthlyDataにも反映
          if (!categoryData.monthlyData) {
            categoryData.monthlyData = {};
          }
          if (!categoryData.monthlyData[monthKey]) {
            categoryData.monthlyData[monthKey] = {
              budget: 0,
              used: 0,
              remaining: 0
            };
          }
          categoryData.monthlyData[monthKey].used = categoryData.monthlyUsedAmounts[monthKey];
          categoryData.monthlyData[monthKey].remaining = 
            categoryData.monthlyData[monthKey].budget - categoryData.monthlyData[monthKey].used;
        });
      }
    });
    
    // 月別フィールドをカテゴリデータに設定（データ集計後）
    categoryMap.forEach(categoryData => {
      if (monthColumns && monthColumns.length > 0) {
        monthColumns.forEach(monthCol => {
          const fieldKey = `month_${monthCol.year}_${monthCol.month}`;
          const monthlyAmount = getMonthlyAmount(categoryData, monthCol.year, monthCol.month);
          (categoryData as any)[fieldKey] = monthlyAmount;
          console.log(`カテゴリ[${categoryData.name}] ${fieldKey}: ${monthlyAmount}`);
        });
      }
      
      // 月別合計を計算
      if (categoryData.monthlyData) {
        Object.values(categoryData.monthlyData).forEach(monthData => {
          categoryData.monthlyTotal! += monthData.budget;
          categoryData.monthlyUsedTotal! += monthData.used;
          categoryData.monthlyRemainingTotal! += monthData.remaining;
        });
      }
    });
    
    const result = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    console.log('generateCategoryData完了:', result.length, '件のカテゴリデータを生成');
    
    return result;
  }

  // カテゴリテーブルのカラム定義を生成
  function generateCategoryColumns(): ColumnDefinition[] {
    const categoryColumns: ColumnDefinition[] = [];
    
    // カテゴリ名カラム
    categoryColumns.push({
      title: "カテゴリ",
      field: "name",
      frozen: true,
      minWidth: 150,
      bottomCalc: () => "<strong>合計</strong>",
      bottomCalcFormatter: "html"
    });
    
    // 全体カラム（縦並び表示）
    categoryColumns.push({
      title: "全体",
      field: "budgetedAmount",  // 実際のデータフィールドを使用
      width: 130,
      minWidth: 110,
      widthGrow: 0.8,
      hozAlign: "right",
      bottomCalcFormatter: "html",
      bottomCalc: () => {
        // テーブルデータが空でもカテゴリデータから直接計算
        if (!categoryTableData || categoryTableData.length === 0) {
          return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
        }
        
        let totalBudget = 0;
        let totalUsed = 0;
        let totalRemaining = 0;
        
        categoryTableData.forEach(row => {
          totalBudget += row.budgetedAmount || 0;
          totalUsed += row.usedAmount || 0;
          totalRemaining += row.remainingAmount || 0;
        });
        
        const items = [];
        if (showMonthlyBudget) {
          items.push(`<div style="padding: 1px 3px; font-size: 13px;"><strong>${formatAmount(totalBudget)}</strong></div>`);
        }
        if (showMonthlyUsed) {
          items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><strong>${formatAmount(totalUsed)}</strong></div>`);
        }
        if (showMonthlyRemaining) {
          const color = totalRemaining < 0 ? 'color: red; font-weight: bold;' : '';
          items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><strong style="${color}">${formatAmount(totalRemaining)}</strong></div>`);
        }
        
        if (items.length === 0) {
          return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
        }
        
        return `
          <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
            ${items.join('')}
          </div>
        `;
      },
      formatter: (cell) => {
        const rowData = cell.getRow().getData();
        const budgetedAmount = rowData.budgetedAmount;
        const usedAmount = rowData.usedAmount;
        const remainingAmount = rowData.remainingAmount;
        
        const items = [];
        if (showMonthlyBudget) {
          items.push(`<div style="padding: 1px 3px; font-size: 13px;">${formatAmount(budgetedAmount)}</div>`);
        }
        if (showMonthlyUsed) {
          items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${formatAmount(usedAmount)}</div>`);
        }
        if (showMonthlyRemaining) {
          const color = remainingAmount < 0 ? 'color: red; font-weight: bold;' : '';
          items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><span style="${color}">${formatAmount(remainingAmount)}</span></div>`);
        }
        
        if (items.length === 0) {
          return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
        }
        
        return `
          <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
            ${items.join('')}
          </div>
        `;
      }
    });
    
    // 月計カラム（縦並び表示）
    categoryColumns.push({
      title: "月計",
      field: "monthTotal",
      width: 130,
      minWidth: 110,
      widthGrow: 0.8,
      hozAlign: "right",
      bottomCalcFormatter: "html",
      bottomCalc: () => {
        // テーブルデータが空でもカテゴリデータから直接計算
        if (!categoryTableData || categoryTableData.length === 0) {
          return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
        }
        
        let totalBudget = 0;
        let totalUsed = 0;
        let totalRemaining = 0;
        
        categoryTableData.forEach(row => {
          totalBudget += row.monthlyTotal || 0;
          totalUsed += row.monthlyUsedTotal || 0;
          totalRemaining += row.monthlyRemainingTotal || 0;
        });
        
        const items = [];
        if (showMonthlyBudget) {
          items.push(`<div style="padding: 1px 3px; font-size: 13px;"><strong>${formatAmount(totalBudget, false)}</strong></div>`);
        }
        if (showMonthlyUsed) {
          items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><strong>${formatAmount(totalUsed, false)}</strong></div>`);
        }
        if (showMonthlyRemaining) {
          const color = totalRemaining < 0 ? 'color: red; font-weight: bold;' : '';
          items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><strong style="${color}">${formatAmount(totalRemaining, false)}</strong></div>`);
        }
        
        if (items.length === 0) {
          return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
        }
        
        return `
          <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
            ${items.join('')}
          </div>
        `;
      },
      formatter: (cell) => {
        const rowData = cell.getRow().getData();
        const monthlyTotal = rowData.monthlyTotal || 0;
        const monthlyUsedTotal = rowData.monthlyUsedTotal || 0;
        const monthlyRemainingTotal = rowData.monthlyRemainingTotal || 0;
        
        const items = [];
        if (showMonthlyBudget) {
          items.push(`<div style="padding: 1px 3px; font-size: 13px;">${formatAmount(monthlyTotal, false)}</div>`);
        }
        if (showMonthlyUsed) {
          items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${formatAmount(monthlyUsedTotal, false)}</div>`);
        }
        if (showMonthlyRemaining) {
          const color = monthlyRemainingTotal < 0 ? 'color: red; font-weight: bold;' : '';
          items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><span style="${color}">${formatAmount(monthlyRemainingTotal, false)}</span></div>`);
        }
        
        if (items.length === 0) {
          return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
        }
        
        return `
          <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
            ${items.join('')}
          </div>
        `;
      }
    });
    
    // 月別カラムを追加（予算項目テーブルと完全に同じ）
    const filteredMonths = getFilteredMonthColumns();
    filteredMonths.forEach(monthCol => {
      const columnDef = {
        title: monthCol.label,  // 予算項目と同じ（2025/04形式）
        field: `month_${monthCol.year}_${monthCol.month}`,
        width: 90,
        minWidth: 80,
        maxWidth: 110,
        hozAlign: "right" as const,
        bottomCalcFormatter: "html" as any,
        bottomCalc: () => {
          // テーブルデータが空でもカテゴリデータから直接計算
          if (!categoryTableData || categoryTableData.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          let totalBudget = 0;
          let totalUsed = 0;
          let totalRemaining = 0;
          
          // 現在の年月を取得
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          
          // 対象月が過去・現在・未来かを判定
          const isCurrentOrPast = 
            monthCol.year < currentYear || 
            (monthCol.year === currentYear && monthCol.month <= currentMonth);
          
          categoryTableData.forEach(row => {
            const monthlyBudget = getMonthlyAmount(row, monthCol.year, monthCol.month);
            const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
            const monthlyUsed = row.monthlyUsedAmounts?.[monthKey] || 0;
            const monthlyRemaining = monthlyBudget - monthlyUsed;
            
            // 予算は常に合計
            totalBudget += monthlyBudget;
            
            // 使用額と残額は過去・現在月のみ合計
            if (isCurrentOrPast) {
              totalUsed += monthlyUsed;
              // 予算または使用額がある場合のみ残額を計算
              if (monthlyBudget > 0 || monthlyUsed > 0) {
                totalRemaining += monthlyRemaining;
              }
            }
          });
          
          const items = [];
          if (showMonthlyBudget) {
            items.push(`<div style="padding: 1px 3px; font-size: 13px;">${totalBudget.toLocaleString()}</div>`);
          }
          if (showMonthlyUsed) {
            const usedDisplay = isCurrentOrPast ? totalUsed.toLocaleString() : '-';
            items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${usedDisplay}</div>`);
          }
          if (showMonthlyRemaining) {
            if (isCurrentOrPast) {
              const color = totalRemaining < 0 ? 'color: red; font-weight: bold;' : '';
              items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;"><span style="${color}">${totalRemaining.toLocaleString()}</span></div>`);
            } else {
              items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;">-</div>`);
            }
          }
          
          if (items.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          return `
            <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
              ${items.join('')}
            </div>
          `;
        },
        formatter: (cell: CellComponent) => {
          // フィールド名から直接データを取得
          const fieldKey = `month_${monthCol.year}_${monthCol.month}`;
          const rowData = cell.getRow().getData();
          const monthlyBudget = rowData[fieldKey] || 0;
          
          // 現在の年月を取得
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          
          // 対象月が過去・現在・未来かを判定
          const isCurrentOrPast = 
            monthCol.year < currentYear || 
            (monthCol.year === currentYear && monthCol.month <= currentMonth);
          
          // 表示制御 - currentDisplaySettingsから取得
          const budgetDisplay = monthlyBudget > 0 ? monthlyBudget.toLocaleString() : '-';
          
          // 使用額
          let usedDisplay = '-';
          if (isCurrentOrPast) {
            const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
            const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
            usedDisplay = monthlyUsed > 0 ? monthlyUsed.toLocaleString() : '0';
          }
          
          // 残額
          let remainingDisplay = '-';
          if (isCurrentOrPast) {
            const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
            const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
            const monthlyRemaining = monthlyBudget - monthlyUsed;
            
            if (monthlyBudget > 0 || monthlyUsed > 0) {
              const color = monthlyRemaining < 0 ? 'color: red; font-weight: bold;' : '';
              remainingDisplay = `<span style="${color}">${monthlyRemaining.toLocaleString()}</span>`;
            } else {
              remainingDisplay = '0';
            }
          } else {
            remainingDisplay = '-';
          }
          
          const items = [];
          
          // デバッグ: 表示設定の値を確認

          
          if (currentDisplaySettings.showMonthlyBudget) {
            items.push(`<div style="padding: 1px 3px; font-size: 13px;">${budgetDisplay}</div>`);
          }
          if (currentDisplaySettings.showMonthlyUsed) {
            items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${usedDisplay}</div>`);
          }
          if (currentDisplaySettings.showMonthlyRemaining) {
            items.push(`<div style="background-color: #dcfce7; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${remainingDisplay}</div>`);
          }
          
          if (items.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          return `
            <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
              ${items.join('')}
            </div>
          `;
        }
      };
      
      categoryColumns.push(columnDef);
    });
    
    return categoryColumns;
  }

  // カテゴリテーブルの初期化
  function initializeCategoryTable() {
    console.log('カテゴリテーブル初期化開始');
    if (!categoryTableElement) {
      console.log('categoryTableElement が存在しません');
      return;
    }
    
    // monthColumnsが初期化されていない場合は初期化
    if (!monthColumns || monthColumns.length === 0) {
      console.log('monthColumnsを初期化');
      initializeTableColumns();
    }
    
    if (categoryTable) {
      categoryTable.destroy();
    }
    
    const categoryColumns = generateCategoryColumns();
    categoryTableData = generateCategoryData();
    console.log('カテゴリデータ:', categoryTableData);
    console.log('カテゴリカラム数:', categoryColumns.length);
    
    const tableHeight = calculateCategoryTableHeight();
    console.log('カテゴリテーブル高さ:', tableHeight);
    console.log('カテゴリテーブル要素:', categoryTableElement);
    
    // 予算項目テーブルと同じ設定を使用（仮想DOM無効化含む）
    try {
      categoryTable = new Tabulator(categoryTableElement, {
        data: categoryTableData,
        columns: categoryColumns,
        layout: "fitDataFill",
        height: tableHeight,
        autoResize: false, // 自動リサイズを無効化（F12対策）
        rowHeight: dynamicRowHeight,
        columnDefaults: {
          resizable: true,
          headerWordWrap: true,
          variableHeight: activeItemCount > 1
        },
        renderVertical: "basic", // 基本的なレンダリングモード
        renderHorizontal: "basic", // 基本的なレンダリングモード
        reactiveData: false, // リアクティブデータを無効化
        placeholder: "カテゴリデータがありません"
      });
      
      console.log('カテゴリテーブル作成成功');
      
      // 初期化完了を待つ
      categoryTable.on("tableBuilt", () => {
        console.log('カテゴリテーブルBuilt完了');
        if (categoryTable) {
          (categoryTable as any).initialized = true;
          // 強制的に再描画
          categoryTable.redraw(true);
        }
      });
    } catch (error) {
      console.error('カテゴリテーブル初期化エラー:', error);
    }
  }

  function calculateCategoryTableHeight(): string {
    const viewportHeight = window.innerHeight;
    
    if (viewportHeight > 900) {
      return "500px";
    } else if (viewportHeight > 700) {
      return "400px";
    } else {
      return "300px";
    }
  }

  // カテゴリテーブルの更新
  function updateCategoryTable() {
    if (!categoryTableElement) return;
    
    // メインテーブルが初期化されていない場合は何もしない
    if (!table || !(table as any).initialized) {
      return;
    }
    
    // カテゴリデータを再生成
    categoryTableData = generateCategoryData();
    
    // カテゴリテーブルが初期化されていない場合は初期化
    if (!categoryTable) {
      initializeCategoryTable();
      return;
    }
    
    // 安全にデータを更新
    try {
      // テーブルが完全に初期化されているか確認
      if (categoryTable && categoryTable.getColumns && categoryTable.getColumns().length > 0) {
        categoryTable.replaceData(categoryTableData)
          .then(() => {
            if (categoryTable) {
              categoryTable.redraw(true);
            }
          })
          .catch((error) => {
            // エラー時は再初期化
            if (categoryTable) {
              categoryTable.destroy();
              categoryTable = null;
            }
            initializeCategoryTable();
          });
      } else {
        // テーブルが完全に初期化されていない場合は再初期化
        if (categoryTable) {
          categoryTable.destroy();
          categoryTable = null;
        }
        initializeCategoryTable();
      }
    } catch (error) {
      // エラー時は再初期化
      if (categoryTable) {
        categoryTable.destroy();
        categoryTable = null;
      }
      initializeCategoryTable();
    }
  }

  onDestroy(() => {
    if (table) {
      table.destroy();
      table = null;
    }
    if (categoryTable) {
      categoryTable.destroy();
      categoryTable = null;
    }
  });
</script>

<div class="table-wrapper">
  <!-- デバッグ用：現在時刻 -->
  <div class="bg-yellow-100 p-2 mb-2 text-center font-bold">
    現在時刻: {new Date().toLocaleString('ja-JP')}
  </div>
  <div bind:this={tableElement} class="budget-item-table row-height-{activeItemCount}"></div>
  
  <!-- カテゴリ別集計テーブル -->
  <div class="category-table-section">
    <h3 class="category-table-title">カテゴリ別集計</h3>
    <div bind:this={categoryTableElement} class="category-table row-height-{activeItemCount}"></div>
  </div>
</div>

<style>
  .budget-item-table {
    width: 100%;
    min-height: 400px;
  }
  
  .category-table-section {
    margin-top: 30px;
  }
  
  .category-table-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 10px;
    color: #1f2937;
  }
  
  .category-table {
    width: 100%;
    min-height: 300px;
  }
  
  /* 動的行高さのスタイル */
  :global(.row-height-1 .tabulator-row) {
    height: 30px !important;
    min-height: 30px !important;
  }
  
  :global(.row-height-2 .tabulator-row) {
    height: 45px !important;
    min-height: 45px !important;
  }
  
  :global(.row-height-3 .tabulator-row) {
    height: 65px !important;
    min-height: 65px !important;
  }
  
  :global(.row-height-1 .tabulator-cell) {
    height: 30px !important;
    line-height: 30px;
    padding: 0 2px !important;
  }
  
  :global(.row-height-2 .tabulator-cell) {
    height: 45px !important;
    line-height: normal;
    padding-top: 3px;
    padding-bottom: 3px;
  }
  
  :global(.row-height-3 .tabulator-cell) {
    height: 65px !important;
    line-height: normal;
    padding-top: 5px;
    padding-bottom: 5px;
  }

</style>