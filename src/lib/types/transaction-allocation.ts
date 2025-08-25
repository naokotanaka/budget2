/**
 * Type definitions for transaction allocation page
 */

import type { SerializedGrant, SerializedBudgetItem, SerializedTransaction } from './serialized';
import type { AllocationSplit } from './models';

/**
 * Budget item with grant information
 */
export interface BudgetItemWithGrant extends SerializedBudgetItem {
  grant?: SerializedGrant;
  grantName: string;
  grantStatus: string;
  grantStartDate: string;
  grantEndDate: string;
  remaining: number;
  allocatedAmount?: number;
  schedules?: Array<{ month: number; year: number }>;
}

/**
 * Transaction row for display
 */
export interface TransactionRow {
  id: string;
  date: string;
  journalNumber: string;
  description: string;
  detailDescription: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  allocationStatus: 'unallocated' | 'partial' | 'full';
  allocationCount: number;
  allocations: Array<AllocationSplit & { 
    budgetItem: SerializedBudgetItem & { grant: SerializedGrant } 
  }>;
  supplier: string;
  department: string;
  account: string;
  memo: string;
  tags: string;
  item: string;
  receiptIds: string[];
  dateObj: Date;
  primaryGrantName: string;
  primaryBudgetItemName: string;
  detailId: string | null;
  freeDealId: string | null;
}

/**
 * Sort field configuration
 */
export interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Allocation form data
 */
export interface AllocationFormData {
  budgetItemId: string;
  amount: string;
  note: string;
}

/**
 * Filter state for persistence
 */
export interface FilterState {
  headerFilters: Record<string, string>;
  checkboxFilters: {
    allocationStatus: string[];
    account: string[];
    department: string[];
    supplier: string[];
    item: string[];
    primaryGrantName: string[];
    primaryBudgetItemName: string[];
  };
  transactionSortFields: SortField[];
  sortFields: SortField[];
  currentPage: number;
  itemsPerPage: number;
  savedAt: string;
}

/**
 * Header filters
 */
export interface TransactionHeaderFilters {
  primaryGrantName: string;
  primaryBudgetItemName: string;
  account: string;
  department: string;
  supplier: string;
  item: string;
  description: string;
  detailDescription: string;
  memo: string;
  tags: string;
  minAmount: string;
  maxAmount: string;
  startDate: string;
  endDate: string;
}

/**
 * Checkbox filters
 */
export interface TransactionCheckboxFilters {
  allocationStatus: Set<string>;
  account: Set<string>;
  department: Set<string>;
  supplier: Set<string>;
  item: Set<string>;
  primaryGrantName: Set<string>;
  primaryBudgetItemName: Set<string>;
}

/**
 * Page constants
 */
export const TRANSACTION_CONSTANTS = {
  LEFT_PANE_WIDTH: 300,
  DEFAULT_BUDGET_STATUS: 'active',
  DEFAULT_TRANSACTION_STATUS: 'all',
  DEFAULT_ITEMS_PER_PAGE: 100,
  MAX_SORT_FIELDS: 3,
  FILTER_STATE_EXPIRY_DAYS: 7,
} as const;

/**
 * Status labels
 */
export const STATUS_LABELS: Record<string, string> = {
  active: '進行中',
  completed: '完了',
  applied: '申請中',
  reported: '報告済',
  unallocated: '未割当',
  partial: '部分割当',
  full: '完全割当',
};

/**
 * Status colors (Tailwind CSS classes)
 */
export const STATUS_COLORS: Record<string, string> = {
  active: 'badge-success',
  completed: 'badge-neutral',
  applied: 'badge-warning',
  reported: 'badge-info',
  unallocated: 'badge-error',
  partial: 'badge-warning',
  full: 'badge-success',
};