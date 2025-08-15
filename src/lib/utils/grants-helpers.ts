// Grant管理画面のヘルパー関数

import type { Grant as PrismaGrant, BudgetItem as PrismaBudgetItem } from '@prisma/client';
import type { MonthColumn, BudgetItemTableData } from '../types/tabulator';

// Prismaモデルを拡張
export interface Grant extends Partial<PrismaGrant> {
  id: number;
  name: string;
  grantCode?: string | null;
  totalAmount?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  status: 'active' | 'completed' | 'applied';
  budgetItemsCount?: number;
  usedAmount?: number;
}

export interface BudgetItem extends Partial<PrismaBudgetItem> {
  id: number;
  name: string;
  category?: string | null;
  budgetedAmount?: number | null;
  usedAmount?: number | null;
  note?: string | null;
}

// MonthColumnはtabulator.tsからexport済み

// 進行中助成金の期間に基づいて月絞り込み範囲を設定
export function setDefaultFilterRangeFromInProgressGrants(
  grants: Grant[],
  monthFilterStartYear: number,
  monthFilterStartMonth: number,
  monthFilterEndYear: number,
  monthFilterEndMonth: number
) {
  const inProgressGrants = grants.filter(grant => grant.status === 'active');
  
  if (inProgressGrants.length === 0) {
    console.log('📅 進行中の助成金がないため、デフォルト範囲を維持');
    return { monthFilterStartYear, monthFilterStartMonth, monthFilterEndYear, monthFilterEndMonth };
  }
  
  let earliestStart: Date | null = null;
  let latestEnd: Date | null = null;
  
  inProgressGrants.forEach(grant => {
    if (grant.startDate) {
      const startDate = new Date(grant.startDate);
      if (!earliestStart || startDate < earliestStart) {
        earliestStart = startDate;
      }
    }
    
    if (grant.endDate) {
      const endDate = new Date(grant.endDate);
      if (!latestEnd || endDate > latestEnd) {
        latestEnd = endDate;
      }
    }
  });
  
  const isDefaultRange = (monthFilterStartYear === 2025 && monthFilterEndYear === 2025);
  
  if (isDefaultRange) {
    if (earliestStart) {
      monthFilterStartYear = earliestStart.getFullYear();
      monthFilterStartMonth = earliestStart.getMonth() + 1;
    }
    
    if (latestEnd) {
      monthFilterEndYear = latestEnd.getFullYear();
      monthFilterEndMonth = latestEnd.getMonth() + 1;
    }
  }
  
  return { monthFilterStartYear, monthFilterStartMonth, monthFilterEndYear, monthFilterEndMonth };
}

// 月列生成時に自動的にフィルター範囲を調整
export function adjustFilterRangeToData(
  monthColumns: MonthColumn[],
  monthFilterStartYear: number,
  monthFilterEndYear: number
) {
  if (monthColumns && monthColumns.length > 0) {
    const years = monthColumns.map(col => col.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    
    if (monthFilterStartYear === 2025 && monthFilterEndYear === 2025) {
      monthFilterStartYear = minYear;
      monthFilterEndYear = maxYear;
    }
  }
  
  return { monthFilterStartYear, monthFilterEndYear };
}

// 月データの合計を計算するヘルパー関数
export function calculateMonthlyTotals(rowData: BudgetItemTableData, monthColumns: MonthColumn[]) {
  interface DisplaySettings {
    showMonthlyBudget: boolean;
    showMonthlyUsed: boolean;
    showMonthlyRemaining: boolean;
    monthFilterStartYear: number;
    monthFilterStartMonth: number;
    monthFilterEndYear: number;
    monthFilterEndMonth: number;
  }
  
  const settings = (window as unknown as { monthDisplaySettings?: DisplaySettings }).monthDisplaySettings || {
    showMonthlyBudget: true,
    showMonthlyUsed: true,
    showMonthlyRemaining: true
  };
  
  let totalBudget = 0;
  let totalUsed = 0;
  let totalRemaining = 0;
  
  monthColumns.forEach(monthCol => {
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
  
  return { totalBudget, totalUsed, totalRemaining };
}

// 月列生成関数
export function generateMonthColumns(
  grantsData: Grant[], 
  selectedGrantData: Grant | null, 
  currentBudgetItems: BudgetItem[]
): MonthColumn[] {
  if (!grantsData || grantsData.length === 0) {
    console.log('No grants data, returning empty months');
    return [];
  }

  const displayedGrantIds = new Set(grantsData.filter(g => g.status === 'active').map(g => g.id));
  const grantMonths = new Map<string, Set<string>>();
  
  grantsData.forEach(grant => {
    if (!displayedGrantIds.has(grant.id)) return;
    
    if (grant.startDate && grant.endDate) {
      const startDate = new Date(grant.startDate);
      const endDate = new Date(grant.endDate);
      
      let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endDateMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      
      while (currentDate <= endDateMonth) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const key = `${year}-${month}`;
        
        if (!grantMonths.has(grant.id.toString())) {
          grantMonths.set(grant.id.toString(), new Set());
        }
        grantMonths.get(grant.id.toString())!.add(key);
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
  });
  
  const allMonths = new Set<string>();
  grantMonths.forEach(months => {
    months.forEach(month => allMonths.add(month));
  });
  
  const sortedMonths = Array.from(allMonths).sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    if (yearA !== yearB) return yearA - yearB;
    return monthA - monthB;
  });
  
  const monthColumnDefs = sortedMonths.map(key => {
    const [year, month] = key.split('-').map(Number);
    return {
      year,
      month,
      label: `${year}/${month}`
    };
  });
  
  return monthColumnDefs;
}

// フィルター関連のヘルパー関数
export function getFilteredCompletedGrants(grants: Grant[]): Grant[] {
  const completedGrants = grants.filter(g => g.status === 'completed');
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  return completedGrants.filter(grant => {
    if (!grant.endDate) return false;
    const endDate = new Date(grant.endDate);
    return endDate >= threeMonthsAgo;
  });
}

export function getFilteredReportedGrants(grants: Grant[]): Grant[] {
  const reportedGrants = grants.filter(g => g.status === 'applied');
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  return reportedGrants.filter(grant => {
    if (!grant.endDate) return false;
    const endDate = new Date(grant.endDate);
    return endDate >= threeMonthsAgo;
  });
}

export function getAvailableYears(grants: Grant[]): string[] {
  const years = new Set<string>();
  grants
    .filter(g => g.status === 'completed' || g.status === 'applied')
    .forEach(grant => {
      if (grant.endDate) {
        const year = new Date(grant.endDate).getFullYear().toString();
        years.add(year);
      }
    });
  return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
}

// CSV処理関数（メインファイルから移動）
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result.map(field => {
    if (field.startsWith('"') && field.endsWith('"')) {
      return field.slice(1, -1);
    }
    return field;
  });
}

export function parseAmount(value: string): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/[¥,]/g, '');
  const parsed = parseInt(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export function parseDate(value: string): string | null {
  if (!value?.trim()) return null;
  const dateStr = value.trim().replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  return null;
}

export function parseStatus(value: string): 'active' | 'completed' | 'applied' {
  const trimmed = value?.trim() || '';
  switch (trimmed) {
    case '終了':
    case 'completed':
      return 'completed';
    case '報告済み':
    case 'applied':
      return 'applied';
    default:
      return 'active';
  }
}