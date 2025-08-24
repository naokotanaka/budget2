<script lang="ts">
  import { onDestroy, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { TabulatorFull as Tabulator } from 'tabulator-tables';
  import type { ColumnDefinition, CellComponent } from 'tabulator-tables';
  import 'tabulator-tables/dist/css/tabulator.min.css';
  import type { Grant, BudgetItem } from '$lib/types/models';
  import type { 
    BudgetItemTableData, 
    MonthColumn, 
    TableDisplaySettings
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

  // Constants
  const TABLE_HEIGHT_LARGE = 0.7;
  const TABLE_HEIGHT_MEDIUM = 0.6;
  const TABLE_HEIGHT_SMALL = 400;
  const VIEWPORT_LARGE = 1000;
  const VIEWPORT_MEDIUM = 768;
  const PAGINATION_SIZE = 20;
  const UPDATE_DELAY = 100;
  const RETRY_DELAY = 200;

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
  let lastValidBudgetItems: BudgetItem[] = [];
  
  // ソート状態を保存する変数
  let savedSortState: Array<{column: string, dir: string}> = [];
  
  // ページネーション状態を保存する変数
  let savedPageNumber = 1;
  let savedPageSize = PAGINATION_SIZE;
  
  let currentDisplaySettings = {
    showMonthlyBudget,
    showMonthlyUsed,
    showMonthlyRemaining
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

  // Dynamic row height calculation
  $: activeItemCount = [showMonthlyBudget, showMonthlyUsed, showMonthlyRemaining].filter(Boolean).length;
  $: dynamicRowHeight = activeItemCount === 1 ? 30 : activeItemCount === 2 ? 45 : 65;

  // Reactive updates
  $: if (budgetItems && grants) {
    monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
  }

  $: if (browser && tableElement && budgetItems.length > 0 && monthColumns.length > 0 && !isTableUpdating) {
    handleTableUpdate();
  }

  $: if (browser && categoryTableElement && budgetItems.length > 0) {
    setTimeout(() => {
      categoryTableData = generateCategoryData();
      updateCategoryTable();
    }, UPDATE_DELAY);
  }

  // Handle display settings changes
  $: {
    const currentSettings: TableDisplaySettings = {
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
    if (amount == null || amount === 0) {
      return includeYen ? '¥0' : '0';
    }
    return includeYen ? `¥${amount.toLocaleString()}` : amount.toLocaleString();
  }

  function calculateMonthlyTotals(rowData: BudgetItemTableData) {
    let totalBudget = 0;
    let totalUsed = 0;
    let totalRemaining = 0;

    const filteredMonths = getFilteredMonthColumns();
    
    filteredMonths.forEach(monthCol => {
      const inGrantPeriod = isMonthInGrantPeriod(rowData.grantId, monthCol.year, monthCol.month);
      
      if (inGrantPeriod) {
        const monthlyBudget = getMonthlyAmount(rowData, monthCol.year, monthCol.month);
        const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
        const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
        const monthlyRemaining = monthlyBudget - monthlyUsed;

        if (showMonthlyBudget) totalBudget += monthlyBudget;
        if (showMonthlyUsed) totalUsed += monthlyUsed;
        if (showMonthlyRemaining) totalRemaining += monthlyRemaining;
      }
    });

    return {
      totalBudget,
      totalUsed,
      totalRemaining
    };
  }

  function generateMonthRange(start: Date, end: Date): MonthColumn[] {
    const months: MonthColumn[] = [];
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

  function generateMonthColumns(grantsData: Grant[], selectedGrantData: Grant | null, currentBudgetItems: BudgetItem[]): MonthColumn[] {
    if (selectedGrantData) {
      if (selectedGrantData.startDate && selectedGrantData.endDate) {
        return generateMonthRange(
          new Date(selectedGrantData.startDate),
          new Date(selectedGrantData.endDate)
        );
      }
      return [];
    }
    
    const relevantGrants = new Set<number>();
    currentBudgetItems.forEach(item => {
      if (item.grantId) {
        relevantGrants.add(item.grantId);
      }
    });
    
    const months: MonthColumn[] = [];
    const uniqueMonths = new Set<string>();
    
    grantsData.forEach(grant => {
      if (!relevantGrants.has(grant.id)) return;
      
      if (grant.startDate && grant.endDate) {
        const monthRange = generateMonthRange(
          new Date(grant.startDate),
          new Date(grant.endDate)
        );
        
        monthRange.forEach(month => {
          const monthKey = `${month.year}-${month.month}`;
          if (!uniqueMonths.has(monthKey)) {
            uniqueMonths.add(monthKey);
            months.push(month);
          }
        });
      }
    });
    
    return months.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  function getFilteredMonthColumns(): MonthColumn[] {
    if (!monthColumns || monthColumns.length === 0) {
      return [];
    }
    
    const startDate = monthFilterStartYear * 100 + monthFilterStartMonth;
    const endDate = monthFilterEndYear * 100 + monthFilterEndMonth;
    
    return monthColumns.filter(col => {
      const colDate = col.year * 100 + col.month;
      return colDate >= startDate && colDate <= endDate;
    });
  }

  function isCategoryMonthAvailable(category: string, targetYear: number, targetMonth: number): boolean {
    const categoryItems = budgetItems.filter(item => item.category === category);
    return categoryItems.some(item => isMonthInGrantPeriod(item.grantId, targetYear, targetMonth));
  }
  
  function isMonthInGrantPeriod(grantId: number, targetYear: number, targetMonth: number): boolean {
    const grant = grants.find(g => g.id === grantId);
    if (!grant?.startDate || !grant?.endDate) {
      return false;
    }
    
    // UTC時刻で統一して日付を比較
    const targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const startDate = new Date(grant.startDate);
    const endDate = new Date(grant.endDate);
    
    // 助成金の開始日・終了日も月初のUTC時刻に統一
    const grantStartMonth = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const grantEndMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    
    // 終了月の次月初をリミットとして設定
    const endDateLimit = new Date(Date.UTC(grantEndMonth.getUTCFullYear(), grantEndMonth.getUTCMonth() + 1, 1));
    
    return targetDate >= grantStartMonth && targetDate < endDateLimit;
  }
  
  function getMonthlyAmount(item: BudgetItemTableData, targetYear: number, targetMonth: number): number {
    if (String(item.id).startsWith('category-')) {
      const monthKeys = [
        `${targetYear}-${targetMonth.toString().padStart(2, '0')}`,
        `${targetYear.toString().slice(-2)}/${targetMonth.toString().padStart(2, '0')}`
      ];
      
      for (const key of monthKeys) {
        if (item.monthlyData?.[key]?.budget) {
          return item.monthlyData[key].budget;
        }
      }
      return 0;
    }
    
    const schedules = budgetItemSchedules.get(item.id);
    if (!schedules?.scheduleData) {
      return 0;
    }
    
    const monthKeys = [
      `${targetYear.toString().slice(-2)}/${targetMonth.toString().padStart(2, '0')}`,
      `${targetYear}-${targetMonth.toString().padStart(2, '0')}`
    ];
    
    for (const key of monthKeys) {
      const monthData = schedules.scheduleData.get(key);
      if (monthData?.monthlyBudget) {
        return monthData.monthlyBudget;
      }
    }
    
    return 0;
  }

  function createCellFormatter() {
    const currentShowBudget = showMonthlyBudget;
    const currentShowUsed = showMonthlyUsed;
    const currentShowRemaining = showMonthlyRemaining;
    
    return (cell: CellComponent) => {
      try {
        const row = cell.getRow();
        if (!row) {
          return '';
        }

        const rowData = row.getData();
        if (!rowData) {
          return '';
        }
        
        const field = cell.getField();
        
        let budgetedAmount, usedAmount, remainingAmount;
        
        if (field === 'budgetedAmount') {
          budgetedAmount = rowData.budgetedAmount;
          usedAmount = rowData.usedAmount;
          remainingAmount = rowData.remainingAmount;
        } else if (field === 'monthTotal') {
          const monthlyTotals = calculateMonthlyTotals(rowData as BudgetItemTableData);
          budgetedAmount = monthlyTotals.totalBudget;
          usedAmount = monthlyTotals.totalUsed;
          remainingAmount = monthlyTotals.totalRemaining;
        } else {
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
  
  function createMonthTotalFormatter() {
    const currentShowBudget = showMonthlyBudget;
    const currentShowUsed = showMonthlyUsed;
    const currentShowRemaining = showMonthlyRemaining;
    
    return (cell: CellComponent) => {
      try {
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
    const fixedBaseColumns: ColumnDefinition[] = [
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
        field: "budgetedAmount",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        hozAlign: "right",
        bottomCalcFormatter: "html",
        bottomCalc: (_values: any, data: any, _calcParams: any) => {
          if (!data || data.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          let totalBudget = 0;
          let totalUsed = 0;
          let totalRemaining = 0;
          
          // フィルタリング後の表示されている行のみを集計
          data.forEach((row: any) => {
            // この月が助成期間内かチェック
            const inGrantPeriod = isMonthInGrantPeriod(row.grantId, year, month);
            if (!inGrantPeriod) return;
            
            // 月別の予算額を計算
            const monthlyBudget = getMonthlyAmount(row, year, month);
            const monthlyUsed = row.monthlyUsedAmounts?.[monthKey] || 0;
            const monthlyRemaining = monthlyBudget - monthlyUsed;
            
            totalBudget += monthlyBudget;
            totalUsed += monthlyUsed;
            totalRemaining += monthlyRemaining;
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
          if (!data || data.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          let totalBudget = 0;
          let totalUsed = 0;
          let totalRemaining = 0;
          
          const filteredMonths = getFilteredMonthColumns();
          
          // フィルタリング後の表示されている行のみを集計
          data.forEach((row: any) => {
            filteredMonths.forEach(monthCol => {
              const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
              
              // この月が助成期間内かチェック
              const inGrantPeriod = isMonthInGrantPeriod(row.grantId, monthCol.year, monthCol.month);
              if (!inGrantPeriod) return;
              
              // 月別の予算額を計算
              const monthlyBudget = getMonthlyAmount(row, monthCol.year, monthCol.month);
              const monthlyUsed = row.monthlyUsedAmounts?.[monthKey] || 0;
              const monthlyRemaining = monthlyBudget - monthlyUsed;
              
              totalBudget += monthlyBudget;
              totalUsed += monthlyUsed;
              totalRemaining += monthlyRemaining;
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
    
    baseColumns = [...fixedBaseColumns] as ColumnDefinition[];
    
    const monthColumnDefs: ColumnDefinition[] = [];
    if (monthColumns && monthColumns.length > 0) {
      const filteredMonthColumns = getFilteredMonthColumns();
      
      function createMonthFormatter(monthCol: MonthColumn) {
        const currentShowBudget = showMonthlyBudget;
        const currentShowUsed = showMonthlyUsed;
        const currentShowRemaining = showMonthlyRemaining;
        
        const formatter = (cell: CellComponent) => {
          const row = cell.getRow();
          if (!row) {
            return '';
          }
          
          const rowData = row.getData();
          if (!rowData) {
            return '';
          }
          
          const field = cell.getField();

          // Get monthly budget first
          const monthlyBudget = getMonthlyAmount(rowData, monthCol.year, monthCol.month);

          // Check if within grant period
          const inGrantPeriod = isMonthInGrantPeriod(rowData.grantId, monthCol.year, monthCol.month);

          // Set display based on period
          let budgetDisplay = '-';
          if (inGrantPeriod) {
            budgetDisplay = monthlyBudget > 0 ? monthlyBudget.toLocaleString() : '0';
          }
          
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          
          const isCurrentOrPast = 
            monthCol.year < currentYear || 
            (monthCol.year === currentYear && monthCol.month <= currentMonth);
          
          let usedDisplay = '-';
          if (isCurrentOrPast) {
            const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
            const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
            usedDisplay = monthlyUsed > 0 ? monthlyUsed.toLocaleString() : '0';
          }
          
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
            
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            
            const isCurrentOrPast = 
              monthCol.year < currentYear || 
              (monthCol.year === currentYear && monthCol.month <= currentMonth);
            
            data.forEach((row: any) => {
              const inGrantPeriod = isMonthInGrantPeriod(row.grantId, monthCol.year, monthCol.month);
              
              if (inGrantPeriod) {
                const monthlyBudget = getMonthlyAmount(row, monthCol.year, monthCol.month);
                const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
                const monthlyUsed = row.monthlyUsedAmounts?.[monthKey] || 0;
                const monthlyRemaining = monthlyBudget - monthlyUsed;
                
                totalBudget += monthlyBudget;
              
                if (isCurrentOrPast) {
                  totalUsed += monthlyUsed;
                  if (monthlyBudget > 0 || monthlyUsed > 0) {
                    totalRemaining += monthlyRemaining;
                  }
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
    
    const actionColumn = {
      title: "操作",
      field: "actions",
      width: 80,
      frozen: true,
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

    columns = [actionColumn, ...baseColumns, ...monthColumnDefs];
  }

  function prepareTableData() {
    if (!budgetItems || budgetItems.length === 0) {
      if (!lastValidBudgetItems || lastValidBudgetItems.length === 0) {
        tableData = [];
        return;
      }
    } else {
      lastValidBudgetItems = [...budgetItems];
    }
    
    const dataSource = (!budgetItems || budgetItems.length === 0) && lastValidBudgetItems.length > 0 
      ? lastValidBudgetItems 
      : budgetItems;
      
    tableData = dataSource.map(item => {
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
      
      if (monthColumns && monthColumns.length > 0) {
        const monthlyData = monthColumns.reduce((acc, monthCol) => {
          const monthAmount = getMonthlyAmount(baseData, monthCol.year, monthCol.month);
          const fieldKey = `month_${monthCol.year}_${monthCol.month}`;
          acc[fieldKey] = monthAmount;
          return acc;
        }, {} as Record<string, number>);
        Object.assign(baseData, monthlyData);
      }
      
      return baseData;
    });
  }

  function calculateTableHeight(): string {
    const viewportHeight = window.innerHeight;
    
    if (viewportHeight > VIEWPORT_LARGE) {
      return `${Math.floor(viewportHeight * TABLE_HEIGHT_LARGE)}px`;
    } else if (viewportHeight > VIEWPORT_MEDIUM) {
      return `${Math.floor(viewportHeight * TABLE_HEIGHT_MEDIUM)}px`;
    } else {
      return `${TABLE_HEIGHT_SMALL}px`;
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
      const initColumns = columns.length > 0 ? columns : baseColumns;
      const tableHeight = calculateTableHeight();
      
      table = new Tabulator(tableElement, {
        data: tableData,
        columns: initColumns,
        layout: "fitDataFill",
        responsiveLayout: false,
        autoResize: false,
        rowHeight: dynamicRowHeight,
        height: tableHeight,
        maxHeight: "90vh",
        pagination: true,
        paginationSize: PAGINATION_SIZE,
        paginationSizeSelector: [20, 50, 100],
        movableColumns: true,
        resizableRows: false,
        selectableRows: 1,
        scrollToColumnPosition: "left",
        reactiveData: false,
        renderVertical: "basic",
        renderHorizontal: "basic",
        columnCalcs: "both"
      });
      
      table.on("tableBuilt", function() {
        if (!table) return;
        const dataAfterBuilt = table.getData();
        if ((!dataAfterBuilt || dataAfterBuilt.length === 0) && tableData && tableData.length > 0) {
          table.setData(tableData);
        }
        
        // ソート状態を復元
        if (savedSortState && savedSortState.length > 0) {
          try {
            table.setSort(savedSortState);
          } catch (error) {
            console.warn('Failed to restore sort state:', error);
            savedSortState = [];
          }
        }
        
        // ページネーション状態を復元
        try {
          if (savedPageSize !== PAGINATION_SIZE) {
            table.setPageSize(savedPageSize);
          }
          if (savedPageNumber > 1) {
            table.setPage(savedPageNumber);
          }
        } catch (error) {
          console.warn('Failed to restore pagination state:', error);
        }
        
        isTableInitializing = false;
        isTableUpdating = false;
      });

    } catch (error) {
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
      setTimeout(() => updateTable(), RETRY_DELAY);
      return;
    }

    prepareTableData();
    
    if (table) {
      try {
        // 現在のソート状態を保存
        const currentSorters = table.getSorters();
        if (currentSorters && currentSorters.length > 0) {
          savedSortState = currentSorters.map((sorter: any) => ({
            column: sorter.field,
            dir: sorter.dir
          }));
        }
        
        // 現在のページネーション状態を保存
        try {
          savedPageNumber = table.getPage();
          savedPageSize = table.getPageSize();
        } catch (error) {
          console.warn('Failed to save pagination state:', error);
        }
        
        table.destroy();
        table = null;
        
        initializeTableColumns();
        initializeTable();
        
      } catch (error) {
        savedSortState = [];
        savedPageNumber = 1;
        savedPageSize = PAGINATION_SIZE;
        initializeTable();
      }
    } else {
      initializeTable();
    }
  }

  function handleTableUpdate() {
    if (!tableElement || budgetItems.length === 0) {
      return;
    }
    
    isTableUpdating = true;
    
    try {
      initializeTableColumns();
      prepareTableData();
      updateTable();
    } catch (error) {
      // エラーハンドリング
    } finally {
      isTableUpdating = false;
    }
  }

  function handleDisplaySettingsChange(currentSettings: TableDisplaySettings) {
    lastDisplaySettings = { ...currentSettings };
    
    currentDisplaySettings.showMonthlyBudget = currentSettings.showMonthlyBudget;
    currentDisplaySettings.showMonthlyUsed = currentSettings.showMonthlyUsed;
    currentDisplaySettings.showMonthlyRemaining = currentSettings.showMonthlyRemaining;
    
    if (table) {
      // 現在のソート状態を保存
      try {
        const currentSorters = table.getSorters();
        if (currentSorters && currentSorters.length > 0) {
          savedSortState = currentSorters.map((sorter: any) => ({
            column: sorter.field,
            dir: sorter.dir
          }));
        }
        
        // 現在のページネーション状態を保存
        savedPageNumber = table.getPage();
        savedPageSize = table.getPageSize();
      } catch (error) {
        console.warn('Failed to save sort state during display settings change:', error);
      }
      
      prepareTableData();
      
      table.destroy();
      table = null;
      
      initializeTableColumns();
      initializeTable();
      
      if (categoryTable) {
        categoryTable.destroy();
        categoryTable = null;
        initializeCategoryTable();
      }
    } else {
      if (budgetItems && budgetItems.length > 0) {
        initializeTableColumns();
        prepareTableData();
        initializeTable();
        
        categoryTableData = generateCategoryData();
        initializeCategoryTable();
      }
    }
  }

  function generateCategoryId(category: string): string {
    const hash = Math.abs(category.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0));
    return `category-${hash}`;
  }

  function generateCategoryData(): BudgetItemTableData[] {
    const categoryMap = new Map<string, BudgetItemTableData>();
    
    budgetItems.forEach(item => {
      const category = item.category || '未分類';
      
      if (!categoryMap.has(category)) {
        const categoryId = generateCategoryId(category);
        categoryMap.set(category, {
          id: categoryId as any,
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
      
      const scheduleInfo = budgetItemSchedules.get(item.id);
      if (scheduleInfo?.scheduleData) {
        scheduleInfo.scheduleData.forEach((monthData, monthKey) => {
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
        });
      }
      
      if (item.monthlyUsedAmounts) {
        Object.entries(item.monthlyUsedAmounts).forEach(([monthKey, amount]) => {
          if (!categoryData.monthlyUsedAmounts) {
            categoryData.monthlyUsedAmounts = {};
          }
          if (!categoryData.monthlyUsedAmounts[monthKey]) {
            categoryData.monthlyUsedAmounts[monthKey] = 0;
          }
          categoryData.monthlyUsedAmounts[monthKey] += amount as number;
          
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
    
    categoryMap.forEach(categoryData => {
      if (monthColumns && monthColumns.length > 0) {
        monthColumns.forEach(monthCol => {
          const fieldKey = `month_${monthCol.year}_${monthCol.month}`;
          const monthlyAmount = getMonthlyAmount(categoryData, monthCol.year, monthCol.month);
          (categoryData as any)[fieldKey] = monthlyAmount;
        });
      }
      
      if (categoryData.monthlyData) {
        Object.values(categoryData.monthlyData).forEach(monthData => {
          categoryData.monthlyTotal! += monthData.budget;
          categoryData.monthlyUsedTotal! += monthData.used;
          categoryData.monthlyRemainingTotal! += monthData.remaining;
        });
      }
    });
    
    return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function generateCategoryColumns(): ColumnDefinition[] {
    const categoryColumns: ColumnDefinition[] = [];
    
    categoryColumns.push({
      title: "カテゴリ",
      field: "name",
      frozen: true,
      minWidth: 150,
      bottomCalc: () => "<strong>合計</strong>",
      bottomCalcFormatter: "html"
    });
    
    categoryColumns.push({
      title: "全体",
      field: "budgetedAmount",
      width: 130,
      minWidth: 110,
      widthGrow: 0.8,
      hozAlign: "right",
      bottomCalcFormatter: "html",
      bottomCalc: () => {
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
    
    categoryColumns.push({
      title: "月計",
      field: "monthTotal",
      width: 130,
      minWidth: 110,
      widthGrow: 0.8,
      hozAlign: "right",
      bottomCalcFormatter: "html",
      bottomCalc: () => {
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
    
    const filteredMonths = getFilteredMonthColumns();
    filteredMonths.forEach(monthCol => {
      const columnDef = {
        title: monthCol.label,
        field: `month_${monthCol.year}_${monthCol.month}`,
        width: 90,
        minWidth: 80,
        maxWidth: 110,
        hozAlign: "right" as const,
        bottomCalcFormatter: "html" as any,
        bottomCalc: () => {
          if (!categoryTableData || categoryTableData.length === 0) {
            return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
          }
          
          let totalBudget = 0;
          let totalUsed = 0;
          let totalRemaining = 0;
          
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          
          const isCurrentOrPast = 
            monthCol.year < currentYear || 
            (monthCol.year === currentYear && monthCol.month <= currentMonth);
          
          categoryTableData.forEach(row => {
            const categoryAvailable = isCategoryMonthAvailable(row.name, monthCol.year, monthCol.month);
            
            if (categoryAvailable) {
              const monthlyBudget = getMonthlyAmount(row, monthCol.year, monthCol.month);
              const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
              const monthlyUsed = row.monthlyUsedAmounts?.[monthKey] || 0;
              const monthlyRemaining = monthlyBudget - monthlyUsed;
              
              totalBudget += monthlyBudget;
            
              if (isCurrentOrPast) {
                totalUsed += monthlyUsed;
                if (monthlyBudget > 0 || monthlyUsed > 0) {
                  totalRemaining += monthlyRemaining;
                }
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
          const fieldKey = `month_${monthCol.year}_${monthCol.month}`;
          const rowData = cell.getRow().getData();
          const monthlyBudget = rowData[fieldKey] || 0;
          
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          
          const isCurrentOrPast = 
            monthCol.year < currentYear || 
            (monthCol.year === currentYear && monthCol.month <= currentMonth);
          
          const categoryName = rowData.name;
          const categoryAvailable = isCategoryMonthAvailable(categoryName, monthCol.year, monthCol.month);
          
          let budgetDisplay = '-';
          if (categoryAvailable) {
            budgetDisplay = monthlyBudget > 0 ? monthlyBudget.toLocaleString() : '0';
          }
          
          let usedDisplay = '-';
          if (isCurrentOrPast) {
            const monthKey = `${monthCol.year}-${monthCol.month.toString().padStart(2, '0')}`;
            const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
            usedDisplay = monthlyUsed > 0 ? monthlyUsed.toLocaleString() : '0';
          }
          
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

  function calculateCategoryTableHeight(): string {
    const viewportHeight = window.innerHeight;
    const CATEGORY_HEIGHT_LARGE = 500;
    const CATEGORY_HEIGHT_MEDIUM = 400;
    const CATEGORY_HEIGHT_SMALL = 300;
    const CATEGORY_VIEWPORT_LARGE = 900;
    const CATEGORY_VIEWPORT_MEDIUM = 700;
    
    if (viewportHeight > CATEGORY_VIEWPORT_LARGE) {
      return `${CATEGORY_HEIGHT_LARGE}px`;
    } else if (viewportHeight > CATEGORY_VIEWPORT_MEDIUM) {
      return `${CATEGORY_HEIGHT_MEDIUM}px`;
    } else {
      return `${CATEGORY_HEIGHT_SMALL}px`;
    }
  }

  function initializeCategoryTable() {
    if (!categoryTableElement) {
      return;
    }
    
    if (!monthColumns || monthColumns.length === 0) {
      initializeTableColumns();
    }
    
    if (categoryTable) {
      categoryTable.destroy();
    }
    
    const categoryColumns = generateCategoryColumns();
    categoryTableData = generateCategoryData();
    
    const tableHeight = calculateCategoryTableHeight();
    
    try {
      categoryTable = new Tabulator(categoryTableElement, {
        data: categoryTableData,
        columns: categoryColumns,
        layout: "fitDataFill",
        height: tableHeight,
        autoResize: false,
        rowHeight: dynamicRowHeight,
        columnDefaults: {
          resizable: true,
          headerWordWrap: true,
          variableHeight: activeItemCount > 1
        },
        renderVertical: "basic",
        renderHorizontal: "basic",
        reactiveData: false,
        placeholder: "カテゴリデータがありません"
      });
      
      categoryTable.on("tableBuilt", () => {
        if (categoryTable) {
          (categoryTable as any).initialized = true;
          categoryTable.redraw(true);
        }
      });
    } catch (error) {
      // エラーハンドリング
    }
  }

  function updateCategoryTable() {
    if (!categoryTableElement) return;
    
    if (!table || !(table as any).initialized) {
      return;
    }
    
    categoryTableData = generateCategoryData();
    
    if (!categoryTable) {
      initializeCategoryTable();
      return;
    }
    
    try {
      if (categoryTable && categoryTable.getColumns && categoryTable.getColumns().length > 0) {
        categoryTable.replaceData(categoryTableData)
          .then(() => {
            if (categoryTable) {
              categoryTable.redraw(true);
            }
          })
          .catch((error) => {
            if (categoryTable) {
              categoryTable.destroy();
              categoryTable = null;
            }
            initializeCategoryTable();
          });
      } else {
        if (categoryTable) {
          categoryTable.destroy();
          categoryTable = null;
        }
        initializeCategoryTable();
      }
    } catch (error) {
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