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
  let tableElement: HTMLDivElement;
  let categoryTableElement: HTMLDivElement;
  let table: Tabulator | null = null;
  let categoryTable: Tabulator | null = null;
  let columns: ColumnDefinition[] = [];
  let baseColumns: ColumnDefinition[] = [];
  let tableData: BudgetItemTableData[] = [];
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

  $: if (tableElement && budgetItems.length > 0 && monthColumns.length > 0 && !isTableUpdating) {
    handleTableUpdate();
  }

  // カテゴリテーブルの更新
  $: if (categoryTableElement && budgetItems.length > 0 && monthColumns.length > 0 && table && baseColumns.length > 0) {
    updateCategoryTable();
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
      // カテゴリテーブルも更新
      if (categoryTable) {
        updateCategoryTable();
      }
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
    // カテゴリデータの場合、monthlyDataから直接取得
    if (String(item.id).startsWith('category-')) {
      const correctMonthKey = `${targetYear}-${targetMonth.toString().padStart(2, '0')}`;
      return item.monthlyData?.[correctMonthKey]?.budget || 0;
    }
    
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
        field: "overall",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        hozAlign: "right",
        bottomCalcFormatter: "html",
        bottomCalc: (values, data, calcParams) => {
          let totalBudget = 0;
          let totalUsed = 0;
          let totalRemaining = 0;
          
          data.forEach(row => {
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
      },
      {
        title: "月計",
        field: "monthTotal",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        hozAlign: "right",
        bottomCalcFormatter: "html",
        bottomCalc: (values, data, calcParams) => {
          let totalBudget = 0;
          let totalUsed = 0;
          let totalRemaining = 0;
          
          const filteredMonths = getFilteredMonthColumns();
          
          data.forEach(row => {
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
        formatter: (cell) => {
          const rowData = cell.getRow().getData();
          const monthlyTotals = calculateMonthlyTotals(rowData);
          
          const items = [];
          if (showMonthlyBudget) {
            items.push(`<div style="padding: 1px 3px; font-size: 13px;">${formatAmount(monthlyTotals.totalBudget, false)}</div>`);
          }
          if (showMonthlyUsed) {
            items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${formatAmount(monthlyTotals.totalUsed, false)}</div>`);
          }
          if (showMonthlyRemaining) {
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
          bottomCalcFormatter: "html",
          bottomCalc: (values, data, calcParams) => {
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
            
            data.forEach(row => {
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
              items.push(`<div style="padding: 1px 3px; font-size: 13px;">${budgetDisplay}</div>`);
            }
            if (showMonthlyUsed) {
              items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${usedDisplay}</div>`);
            }
            if (showMonthlyRemaining) {
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
        monthColumnDefs.push(columnDef);
      });
    }
    
    // 操作列を追加（最初に配置するため、frozenも設定）
    const actionColumn = {
      title: "操作",
      field: "actions",
      width: 80,
      frozen: true,  // 左側に固定
      hozAlign: "center",
      bottomCalc: () => "",
      formatter: () => `
        <div style="display: flex; justify-content: center; align-items: center;">
          <button data-action="edit" style="color: #2563eb; cursor: pointer; padding: 2px 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; font-size: 11px;">編集</button>
        </div>
      `,
      cellClick: (e, cell) => {
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
      
      table = new Tabulator(tableElement, {
        data: tableData,
        columns: initColumns,
        layout: "fitDataFill",
        responsiveLayout: false,
        rowHeight: dynamicRowHeight, // 動的行高さを設定
        height: tableHeight, // レスポンシブな高さ設定
        maxHeight: "90vh", // 最大で画面の90%
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
        virtualDomVert: true,
        columnCalcs: "both" // テーブル内フッターに計算結果を表示
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
        // 表示設定のみの変更の場合、テーブルを再構築して行高さを適用
        table.destroy();
        table = null;
        isTableUpdating = false;
        setTimeout(() => {
          handleTableUpdate();
        }, 100);
      }
    }
  }

  // Lifecycle
  onMount(() => {
  });

  // カテゴリ別集計データを生成
  function generateCategoryData(): BudgetItemTableData[] {
    const categoryMap = new Map<string, BudgetItemTableData>();
    
    // 予算項目をカテゴリ別に集計
    budgetItems.forEach(item => {
      const category = item.category || '未分類';
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          id: `category-${category}`,
          name: category,
          category: '',
          budgetedAmount: 0,
          usedAmount: 0,
          remainingAmount: 0,
          allocationsCount: 0,
          monthlyData: {},
          monthlyUsedAmounts: {},  // 予算項目と同じフィールド名
          monthlyTotal: 0,
          monthlyUsedTotal: 0,
          monthlyRemainingTotal: 0
        });
      }
      
      const categoryData = categoryMap.get(category)!;
      categoryData.budgetedAmount += item.budgetedAmount || 0;
      categoryData.usedAmount += item.usedAmount || 0;
      categoryData.remainingAmount = categoryData.budgetedAmount - categoryData.usedAmount;
      categoryData.allocationsCount += item.allocationsCount || 0;
      
      // 月別データの集計（予算項目と同じ構造）
      // 月別予算
      const scheduleInfo = budgetItemSchedules.get(item.id);
      if (scheduleInfo) {
        
        scheduleInfo.months.forEach(monthKey => {
          // monthKeyの形式を確認して適切に処理
          let correctMonthKey = monthKey;
          if (monthKey.includes('/')) {
            // "25/04"形式の場合、"2025-04"に修正
            const parts = monthKey.split('/');
            if (parts[0].length === 2) {
              correctMonthKey = `20${parts[0]}-${parts[1]}`;
            }
          }
          
          const monthlyBudget = scheduleInfo.scheduleData.get(monthKey)?.monthlyBudget || 0;
          
          if (!categoryData.monthlyData[correctMonthKey]) {
            categoryData.monthlyData[correctMonthKey] = {
              budget: 0,
              used: 0,
              remaining: 0
            };
          }
          
          categoryData.monthlyData[correctMonthKey].budget += monthlyBudget;
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
          
          // monthlyDataにも反映（monthKeyが正しい形式なのでそのまま使用）
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
      
      // 月別フィールドも予算項目と同じように設定（monthColumnsが初期化されている場合のみ）
      if (monthColumns && monthColumns.length > 0) {
        monthColumns.forEach(monthCol => {
          const fieldKey = `month_${monthCol.year}_${monthCol.month}`;
          const monthlyAmount = getMonthlyAmount(categoryData, monthCol.year, monthCol.month);
          categoryData[fieldKey] = monthlyAmount;
        });
      }
    });
    
    // 月別合計を計算
    categoryMap.forEach(categoryData => {
      Object.values(categoryData.monthlyData).forEach(monthData => {
        categoryData.monthlyTotal += monthData.budget;
        categoryData.monthlyUsedTotal += monthData.used;
        categoryData.monthlyRemainingTotal += monthData.remaining;
      });
    });
    
    return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  // カテゴリテーブルの初期化
  function initializeCategoryTable() {
    if (!categoryTableElement) return;
    
    if (categoryTable) {
      categoryTable.destroy();
    }
    
    console.log('📊 カテゴリテーブル初期化開始');
    console.log('📊 budgetItems:', budgetItems);
    console.log('📊 monthColumns:', monthColumns);
    
    // カテゴリテーブル専用のカラム定義
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
      field: "overall",
      width: 130,
      minWidth: 110,
      widthGrow: 0.8,
      hozAlign: "right",
      bottomCalcFormatter: "html",
      bottomCalc: (values, data, calcParams) => {
        let totalBudget = 0;
        let totalUsed = 0;
        let totalRemaining = 0;
        
        data.forEach(row => {
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
      bottomCalc: (values, data, calcParams) => {
        let totalBudget = 0;
        let totalUsed = 0;
        let totalRemaining = 0;
        
        data.forEach(row => {
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
        hozAlign: "right",
        bottomCalcFormatter: "html",
        bottomCalc: (values, data, calcParams) => {
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
          
          data.forEach(row => {
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
            items.push(`<div style="padding: 1px 3px; font-size: 13px;">${budgetDisplay}</div>`);
          }
          if (showMonthlyUsed) {
            items.push(`<div style="background-color: #dbeafe; padding: 1px 3px; border-radius: 2px; font-size: 13px;">${usedDisplay}</div>`);
          }
          if (showMonthlyRemaining) {
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
    
    categoryTableData = generateCategoryData();
    
    const tableHeight = calculateCategoryTableHeight();
    
    // 予算項目テーブルと同じ設定を使用
    categoryTable = new Tabulator(categoryTableElement, {
      data: categoryTableData,
      columns: categoryColumns,
      layout: "fitDataFill",
      height: tableHeight,
      rowHeight: dynamicRowHeight,
      columnDefaults: {
        resizable: true,
        headerWordWrap: true,
        variableHeight: activeItemCount > 1
      },
      placeholder: "カテゴリデータがありません"
    });
  }

  function calculateCategoryTableHeight(): string {
    const viewportHeight = window.innerHeight;
    
    if (viewportHeight > TABLE_CONSTANTS.VIEWPORT_BREAKPOINT_LARGE) {
      return "500px";
    } else if (viewportHeight > TABLE_CONSTANTS.VIEWPORT_BREAKPOINT_MEDIUM) {
      return "400px";
    } else {
      return "300px";
    }
  }

  // カテゴリテーブルの更新
  function updateCategoryTable() {
    // 表示設定が変更された場合は再初期化が必要
    initializeCategoryTable();
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