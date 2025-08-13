// Tabulator テーブル設定
import type { ColumnDefinition } from 'tabulator-tables';
import { getPeriodColor, getAmountColor } from '$lib/utils/color-rules';

export function createTableColumns(monthColumns: any[]): ColumnDefinition[] {
  const baseColumns: ColumnDefinition[] = [
    {
      title: "予算項目",
      field: "name",
      frozen: true,
      width: 200,
      formatter: "plaintext",
      headerSort: true
    },
    {
      title: "カテゴリ",
      field: "category",
      width: 120,
      formatter: function(cell: any) {
        const value = cell.getValue();
        if (!value) return "";
        const colorClass = value.includes('管理') ? 'text-blue-600' :
                         value.includes('事業') ? 'text-green-600' :
                         'text-gray-600';
        return `<span class="${colorClass}">${value}</span>`;
      },
      headerSort: true
    },
    {
      title: "年間予算",
      field: "budgetedAmount",
      width: 120,
      formatter: function(cell: any) {
        const value = cell.getValue();
        if (!value || value === 0) return "-";
        const formattedValue = value.toLocaleString();
        const bgColor = getAmountColor(value);
        return `<div class="${bgColor} px-2 py-1 rounded">¥${formattedValue}</div>`;
      },
      headerSort: true,
      hozAlign: "right"
    },
    {
      title: "使用額",
      field: "usedAmount", 
      width: 120,
      formatter: function(cell: any) {
        const value = cell.getValue();
        const budget = cell.getRow().getData().budgetedAmount;
        if (!value || value === 0) return "-";
        const percentage = budget > 0 ? Math.round((value / budget) * 100) : 0;
        const textColor = percentage > 80 ? 'text-red-600' :
                         percentage > 60 ? 'text-yellow-600' :
                         'text-green-600';
        return `<div class="${textColor} font-semibold">¥${value.toLocaleString()} (${percentage}%)</div>`;
      },
      headerSort: true,
      hozAlign: "right"
    },
    {
      title: "残額",
      field: "remainingAmount",
      width: 120,
      formatter: function(cell: any) {
        const rowData = cell.getRow().getData();
        const budget = rowData.budgetedAmount || 0;
        const used = rowData.usedAmount || 0;
        const remaining = budget - used;
        
        if (budget === 0) return "-";
        
        const percentage = budget > 0 ? Math.round((remaining / budget) * 100) : 0;
        const bgColor = percentage < 20 ? 'bg-red-100 text-red-800' :
                       percentage < 40 ? 'bg-yellow-100 text-yellow-800' :
                       'bg-green-100 text-green-800';
        
        return `<div class="${bgColor} px-2 py-1 rounded font-semibold">¥${remaining.toLocaleString()}</div>`;
      },
      headerSort: true,
      hozAlign: "right"
    }
  ];

  // 月別列の動的追加
  const monthlyColumns = monthColumns.map(monthCol => {
    const year = monthCol.year;
    const month = monthCol.month;
    const fieldName = `month_${year}_${month}`;
    
    return {
      title: `${year}/${month}`,
      field: fieldName,
      width: 100,
      formatter: createMonthFormatter(year, month),
      headerSort: true,
      hozAlign: "right",
      visible: true
    } as ColumnDefinition;
  });

  // 合計列を追加
  const totalColumns: ColumnDefinition[] = [
    {
      title: "月別合計",
      field: "monthlyTotal",
      width: 120,
      formatter: createMonthlyTotalFormatter(),
      headerSort: true,
      hozAlign: "right"
    }
  ];

  return [...baseColumns, ...monthlyColumns, ...totalColumns];
}

// 月別フォーマッター作成関数
export function createMonthFormatter(year: number, month: number) {
  return function(cell: any) {
    const settings = (window as any).monthDisplaySettings || {
      showMonthlyBudget: true,
      showMonthlyUsed: true,
      showMonthlyRemaining: true,
      monthFilterStartYear: 2024,
      monthFilterStartMonth: 1,
      monthFilterEndYear: 2026,
      monthFilterEndMonth: 12
    };
    
    const targetDate = year * 100 + month;
    const filterStartDate = settings.monthFilterStartYear * 100 + settings.monthFilterStartMonth;
    const filterEndDate = settings.monthFilterEndYear * 100 + settings.monthFilterEndMonth;
    
    if (targetDate < filterStartDate || targetDate > filterEndDate) {
      return "";
    }
    
    const value = cell.getValue();
    const rowData = cell.getRow().getData();
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const isCurrentMonth = year === currentYear && month === currentMonth;
    const isPast = year < currentYear || (year === currentYear && month < currentMonth);
    const isFuture = year > currentYear || (year === currentYear && month > currentMonth);
    
    const monthlyBudget = value || 0;
    const monthlyUsed = isPast || isCurrentMonth ? 0 : null;
    const monthlyRemaining = monthlyBudget > 0 && monthlyUsed !== null ? 
                            monthlyBudget - monthlyUsed : null;
    
    let displayParts = [];
    
    if (settings.showMonthlyBudget && monthlyBudget > 0) {
      const budgetColor = monthlyBudget >= 50000 ? 'text-blue-600' :
                         monthlyBudget >= 20000 ? 'text-green-600' :
                         'text-gray-600';
      displayParts.push(`<span class="${budgetColor} font-semibold">¥${monthlyBudget.toLocaleString()}</span>`);
    }
    
    if (settings.showMonthlyUsed && monthlyUsed !== null) {
      const usedDisplay = monthlyUsed === 0 ? 
        '<span class="text-gray-400 text-xs">¥0</span>' : 
        `<span class="text-orange-600 text-xs">¥${monthlyUsed.toLocaleString()}</span>`;
      displayParts.push(usedDisplay);
    } else if (settings.showMonthlyUsed && isFuture) {
      displayParts.push('<span class="text-gray-300 text-xs">-</span>');
    }
    
    if (settings.showMonthlyRemaining && monthlyRemaining !== null) {
      const remainingColor = monthlyRemaining === monthlyBudget ? 'text-green-500' :
                            monthlyRemaining > monthlyBudget * 0.5 ? 'text-blue-500' :
                            monthlyRemaining > monthlyBudget * 0.2 ? 'text-yellow-500' :
                            'text-red-500';
      displayParts.push(`<span class="${remainingColor} text-xs">残¥${monthlyRemaining.toLocaleString()}</span>`);
    } else if (settings.showMonthlyRemaining && isFuture && monthlyBudget > 0) {
      displayParts.push('<span class="text-gray-300 text-xs">-</span>');
    }
    
    if (displayParts.length === 0) {
      return '<span class="text-gray-300">-</span>';
    }
    
    const bgColor = isCurrentMonth ? 'bg-yellow-50' :
                   isPast ? 'bg-gray-50' :
                   '';
    
    return `<div class="${bgColor} px-1 py-0.5 space-y-0.5">${displayParts.join('<br>')}</div>`;
  };
}

// 月別合計フォーマッター作成関数
export function createMonthlyTotalFormatter() {
  return function(cell: any) {
    const settings = (window as any).monthDisplaySettings || {
      showMonthlyBudget: true,
      showMonthlyUsed: true,
      showMonthlyRemaining: true
    };
    
    const rowData = cell.getRow().getData();
    const monthColumns = (window as any).currentMonthColumns || [];
    
    let totalBudget = 0;
    let totalUsed = 0;
    let totalRemaining = 0;
    
    monthColumns.forEach((monthCol: any) => {
      const fieldName = `month_${monthCol.year}_${monthCol.month}`;
      const monthlyBudget = rowData[fieldName] || 0;
      
      const targetYear = monthCol.year;
      const targetMonth = monthCol.month;
      const targetDate = targetYear * 100 + targetMonth;
      const filterStartDate = settings.monthFilterStartYear * 100 + settings.monthFilterStartMonth;
      const filterEndDate = settings.monthFilterEndYear * 100 + settings.monthFilterEndMonth;
      
      if (targetDate < filterStartDate || targetDate > filterEndDate) {
        return;
      }
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      const isCurrentOrPast = 
        targetYear < currentYear || 
        (targetYear === currentYear && targetMonth <= currentMonth);
      
      if (monthlyBudget > 0) {
        totalBudget += monthlyBudget;
      }
      
      if (isCurrentOrPast) {
        const monthlyUsed = 0;
        totalUsed += monthlyUsed;
      }
      
      if (isCurrentOrPast && monthlyBudget > 0) {
        const monthlyUsed = 0;
        const monthlyRemaining = monthlyBudget - monthlyUsed;
        totalRemaining += monthlyRemaining;
      }
    });
    
    let displayParts = [];
    
    if (settings.showMonthlyBudget && totalBudget > 0) {
      const budgetColor = totalBudget >= 100000 ? 'text-blue-700 font-bold' :
                         totalBudget >= 50000 ? 'text-blue-600 font-semibold' :
                         'text-gray-600';
      displayParts.push(`<span class="${budgetColor}">¥${totalBudget.toLocaleString()}</span>`);
    }
    
    if (settings.showMonthlyUsed && totalUsed >= 0) {
      const usedDisplay = totalUsed === 0 ? 
        '<span class="text-gray-400 text-xs">¥0</span>' : 
        `<span class="text-orange-600 text-xs font-semibold">¥${totalUsed.toLocaleString()}</span>`;
      displayParts.push(usedDisplay);
    }
    
    if (settings.showMonthlyRemaining && totalRemaining >= 0) {
      const remainingColor = totalRemaining === totalBudget ? 'text-green-600 font-semibold' :
                            totalRemaining > totalBudget * 0.5 ? 'text-blue-500' :
                            totalRemaining > totalBudget * 0.2 ? 'text-yellow-500' :
                            'text-red-500 font-semibold';
      displayParts.push(`<span class="${remainingColor} text-xs">残¥${totalRemaining.toLocaleString()}</span>`);
    }
    
    if (displayParts.length === 0) {
      return '<span class="text-gray-300">-</span>';
    }
    
    return `<div class="bg-gray-100 px-2 py-1 rounded space-y-0.5 border border-gray-300">${displayParts.join('<br>')}</div>`;
  };
}