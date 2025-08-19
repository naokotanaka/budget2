<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { TabulatorFull as Tabulator } from 'tabulator-tables';
  import type { ColumnDefinition } from 'tabulator-tables';
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
  export let showMonthlyUsed: boolean = true;
  export let showMonthlyRemaining: boolean = true;
  export let monthFilterStartYear: number = 2025;
  export let monthFilterStartMonth: number = 1;
  export let monthFilterEndYear: number = 2025;
  export let monthFilterEndMonth: number = 12;
  export let budgetItemSchedules: Map<number, {months: string[], scheduleData: Map<string, {monthlyBudget: number}>}> = new Map();
  export let schedulesLoaded: boolean = false;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Local variables
  let tableElement: HTMLDivElement;
  let table: Tabulator | null = null;
  let columns: ColumnDefinition[] = [];
  let baseColumns: ColumnDefinition[] = [];
  let tableData: BudgetItemTableData[] = [];
  let monthColumns: MonthColumn[] = [];
  let isTableInitializing = false;
  let isTableUpdating = false;
  let lastDisplaySettings: TableDisplaySettings = {
    showMonthlyBudget: true,
    showMonthlyUsed: true,
    showMonthlyRemaining: true,
    monthFilterStartYear: 2025,
    monthFilterStartMonth: 1,
    monthFilterEndYear: 2025,
    monthFilterEndMonth: 12
  };

  // Reactive updates
  $: if (budgetItems && grants) {
    monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
  }

  $: if (tableElement && budgetItems.length > 0 && monthColumns.length > 0 && !isTableUpdating) {
    handleTableUpdate();
  }

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
    }
  }

  // Helper functions
  function formatAmount(amount?: number, includeYen: boolean = true): string {
    if (amount == null || amount === undefined) return includeYen ? '¥0' : '0';
    const formatted = amount.toLocaleString();
    return includeYen ? `¥${formatted}` : formatted;
  }

  function calculateMonthlyTotals(rowData: BudgetItemTableData) {
    const settings = {
      showMonthlyBudget,
      showMonthlyUsed,
      showMonthlyRemaining
    };

    let totalBudget = 0;
    let totalUsed = 0;
    let totalRemaining = 0;

    const filteredMonths = getFilteredMonthColumns();
    
    filteredMonths.forEach(monthCol => {
      const monthlyBudget = getMonthlyAmount(rowData, monthCol.year, monthCol.month);
      const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
      const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
      const monthlyRemaining = monthlyBudget - monthlyUsed;

      if (settings.showMonthlyBudget) totalBudget += monthlyBudget;
      if (settings.showMonthlyUsed) totalUsed += monthlyUsed;
      if (settings.showMonthlyRemaining) totalRemaining += monthlyRemaining;
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
    const schedules = budgetItemSchedules.get(item.id);
    const monthKey = `${targetYear.toString().slice(-2)}/${targetMonth.toString().padStart(2, '0')}`;
    
    // スケジュールデータがある場合はそれを優先
    if (schedules && schedules.scheduleData && schedules.scheduleData.has(monthKey)) {
      const monthData = schedules.scheduleData.get(monthKey);
      return monthData?.monthlyBudget || 0;
    }
    
    // 選択された月だけに予算を配分
    if (schedules && schedules.months && schedules.months.length > 0) {
      const isSelectedMonth = schedules.months.includes(monthKey);
      if (isSelectedMonth) {
        const monthlyAmount = Math.floor((item.budgetedAmount || 0) / schedules.months.length);
        return monthlyAmount;
      } else {
        return 0;
      }
    }
    
    // スケジュールデータがない場合は、助成金期間全体で均等配分
    if (!schedulesLoaded) {
      const grant = grants.find(g => g.id === item.grantId);
      if (grant && grant.startDate && grant.endDate) {
        const start = new Date(grant.startDate);
        const end = new Date(grant.endDate);
        
        const targetDate = new Date(targetYear, targetMonth - 1);
        if (targetDate >= start && targetDate <= end) {
          const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                           (end.getMonth() - start.getMonth()) + 1;
          const monthlyAmount = Math.floor((item.budgetedAmount || 0) / monthsDiff);
          return monthlyAmount;
        }
      }
    }
    return 0;
  }

  function initializeTableColumns() {
    
    // 基本列を固定で定義
    const fixedBaseColumns = [
      {
        title: "助成金",
        field: "grantName",
        frozen: true,
        minWidth: 120,
        width: 180,
        widthGrow: 1,
        sorter: "string"
      },
      {
        title: "項目名", 
        field: "name",
        frozen: true,
        width: 220,
        minWidth: 150,
        widthGrow: 2,
        sorter: "string"
      },
      {
        title: "カテゴリ",
        field: "category",
        width: 120,
        minWidth: 100,
        widthGrow: 0.5,
        sorter: "string"
      },
      {
        title: "予算額",
        field: "budgetedAmount",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => {
          const budgetedAmount = cell.getValue();
          const rowData = cell.getRow().getData();
          const monthlyTotals = calculateMonthlyTotals(rowData);
          
          return `
            <div style="font-size: 11px; line-height: 1.3;">
              <div style="margin-bottom: 2px;">${formatAmount(budgetedAmount)}</div>
              <div style="color: #6b7280; font-size: 10px;">月計: ${formatAmount(monthlyTotals.totalBudget, false)}</div>
            </div>
          `;
        }
      },
      {
        title: "使用額",
        field: "usedAmount",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => {
          const usedAmount = cell.getValue();
          const rowData = cell.getRow().getData();
          const monthlyTotals = calculateMonthlyTotals(rowData);
          
          return `
            <div style="font-size: 11px; line-height: 1.3;">
              <div style="margin-bottom: 2px;">${formatAmount(usedAmount)}</div>
              <div style="color: #6b7280; font-size: 10px;">月計: ${formatAmount(monthlyTotals.totalUsed, false)}</div>
            </div>
          `;
        }
      },
      {
        title: "残額",
        field: "remainingAmount",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => {
          const value = cell.getValue();
          const color = value < 0 ? 'red' : 'green';
          const rowData = cell.getRow().getData();
          const monthlyTotals = calculateMonthlyTotals(rowData);
          const monthColor = monthlyTotals.totalRemaining < 0 ? 'red' : '#6b7280';
          
          return `
            <div style="font-size: 11px; line-height: 1.3;">
              <div style="color: ${color}; font-weight: 600; margin-bottom: 2px;">${formatAmount(value)}</div>
              <div style="color: ${monthColor}; font-size: 10px;">月計: ${formatAmount(monthlyTotals.totalRemaining, false)}</div>
            </div>
          `;
        }
      }
    ];
    
    // 基本列を設定
    baseColumns = [...fixedBaseColumns];
    
    // 月列を動的に構築
    const monthColumnDefs = [];
    
    if (monthColumns && monthColumns.length > 0) {
      // 月フィルタリングを適用
      const filteredMonthColumns = getFilteredMonthColumns();
      
      // フィルタリングされた月列のみを追加
      filteredMonthColumns.forEach((monthCol, index) => {
        const columnDef = {
          title: monthCol.label,
          field: `month_${monthCol.year}_${monthCol.month}`,
          width: 90,
          minWidth: 80,
          maxWidth: 110,
          hozAlign: "right",
          formatter: (cell) => {
            const monthlyBudget = cell.getValue();
            const rowData = cell.getRow().getData();
            
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
            if (showMonthlyBudget) {
              items.push(`<div style="background-color: #f8fafc; padding: 1px 3px; border-radius: 2px;">${budgetDisplay}</div>`);
            }
            if (showMonthlyUsed) {
              items.push(`<div style="background-color: #eff6ff; padding: 1px 3px; border-radius: 2px;">${usedDisplay}</div>`);
            }
            if (showMonthlyRemaining) {
              items.push(`<div style="background-color: #f0fdf4; padding: 1px 3px; border-radius: 2px;">${remainingDisplay}</div>`);
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
        monthColumnDefs.push(columnDef);
      });
    }
    
    // 操作列を追加
    const actionColumn = {
      title: "操作",
      field: "actions",
      width: 120,
      hozAlign: "center",
      formatter: () => `
        <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
          <button data-action="edit" style="color: #2563eb; cursor: pointer; padding: 2px 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; font-size: 11px;">編集</button>
          <button data-action="delete" style="color: #dc2626; cursor: pointer; padding: 2px 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; font-size: 11px;">削除</button>
        </div>
      `,
      cellClick: (e, cell) => {
        const target = e.target as HTMLElement;
        const action = target.getAttribute('data-action');
        const rowData = cell.getRow().getData();
        const item = budgetItems.find(i => i.id === rowData.id);
        
        if (item) {
          if (action === 'edit') {
            dispatch('edit', { item });
          } else if (action === 'delete') {
            dispatch('delete', { item });
          }
        }
      }
    };

    // 最終的な列定義を構築
    columns = [...baseColumns, ...monthColumnDefs, actionColumn];
  }

  function prepareTableData() {
    tableData = budgetItems.map(item => {
      const remaining = (item.budgetedAmount || 0) - (item.usedAmount || 0);
      const baseData = {
        ...item,
        usedAmount: item.usedAmount || 0,
        budgetedAmount: item.budgetedAmount || 0,
        remainingAmount: remaining,
        actions: ''
      };
      
      // 月別データを追加
      if (monthColumns && monthColumns.length > 0) {
        const monthlyData = monthColumns.reduce((acc, monthCol) => {
          const monthAmount = getMonthlyAmount(item, monthCol.year, monthCol.month);
          const fieldKey = `month_${monthCol.year}_${monthCol.month}`;
          acc[fieldKey] = monthAmount;
          return acc;
        }, {});
        Object.assign(baseData, monthlyData);
      }
      
      return baseData;
    });
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
      console.warn('Table element not found');
      isTableInitializing = false;
      return;
    }

    if (columns.length === 0) {
      console.warn('No columns defined for table');
      isTableInitializing = false;
      return;
    }
    
    try {
      const initColumns = baseColumns.length > 0 ? baseColumns : columns;
      
      table = new Tabulator(tableElement, {
        data: tableData,
        columns: initColumns,
        layout: "fitDataFill",
        responsiveLayout: false,
        height: "600px", // 固定高さに変更してページ全体でスクロール可能に
        maxHeight: "800px",
        pagination: "local",
        paginationSize: window.innerHeight > 900 ? 150 : 100,
        paginationSizeSelector: [50, 100, 150, 200],
        movableColumns: true,
        resizableRows: false,
        resizableColumns: true,
        selectable: 1,
        scrollToColumnPosition: "left",
        scrollToColumnVisibility: "visible",
        reactiveData: true,
        virtualDomVert: true
      });

      table.on("tableBuilt", function() {
        isTableInitializing = false;
        isTableUpdating = false;
      });

      table.on("tableBuiltFailed", function(error) {
        console.error("Tabulator table build failed:", error);
        isTableInitializing = false;
        isTableUpdating = false;
      });

    } catch (error: any) {
      console.error('Error initializing Tabulator table:', error);
      isTableInitializing = false;
      isTableUpdating = false;
      table = null;
    }
  }

  function updateTable() {
    if (!tableElement) {
      console.warn('Table element not available for update');
      return;
    }

    if (isTableInitializing) {
      setTimeout(() => updateTable(), 200);
      return;
    }

    if (table && table.initialized) {
      try {
        const completeColumns = columns;
        
        table.setColumns(completeColumns);
        table.setData(tableData);
        table.redraw(true);
        
      } catch (error: any) {
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
      console.error('テーブル更新エラー:', error);
    } finally {
      isTableUpdating = false;
    }
  }

  function handleDisplaySettingsChange(currentSettings: TableDisplaySettings) {
    
    const isFilterChange = 
      currentSettings.monthFilterStartYear !== lastDisplaySettings.monthFilterStartYear ||
      currentSettings.monthFilterStartMonth !== lastDisplaySettings.monthFilterStartMonth ||
      currentSettings.monthFilterEndYear !== lastDisplaySettings.monthFilterEndYear ||
      currentSettings.monthFilterEndMonth !== lastDisplaySettings.monthFilterEndMonth;
    
    lastDisplaySettings = { ...currentSettings };
    
    if (isFilterChange) {
      if (table) {
        table.destroy();
        table = null;
      }
      isTableUpdating = false;
      setTimeout(() => {
        handleTableUpdate();
      }, 200);
    } else {
      if (table) {
        table.redraw(true);
      }
    }
  }

  // Lifecycle
  onMount(() => {
  });

  onDestroy(() => {
    if (table) {
      table.destroy();
      table = null;
    }
  });
</script>

<div bind:this={tableElement} class="budget-item-table"></div>

<style>
  .budget-item-table {
    width: 100%;
    min-height: 400px;
  }
</style>