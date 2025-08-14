// API関連の型定義
import type {
  Transaction,
  Grant,
  BudgetItem,
  AllocationSplit,
  BudgetSchedule,
  GrantWithBudgetItems,
  BudgetItemWithAllocations,
  TransactionWithAllocations,
  GrantSummary,
  BudgetItemUsage,
  PaginatedResult,
  ValidationError
} from './models.js';

// API共通レスポンス型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
}

// リクエスト型
export interface CreateGrantRequest {
  name: string;
  grantCode?: string;
  totalAmount?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface UpdateGrantRequest {
  name?: string;
  grantCode?: string;
  totalAmount?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface CreateBudgetItemRequest {
  name: string;
  category?: string;
  budgetedAmount?: number;
  note?: string;
  grantId: number;
  sortOrder?: number;
}

export interface UpdateBudgetItemRequest {
  name?: string;
  category?: string;
  budgetedAmount?: number;
  note?: string;
  sortOrder?: number;
}

export interface CreateAllocationRequest {
  budgetItemId: number;
  amount: number;
  note?: string;
  detailId?: bigint;
}

export interface UpdateAllocationRequest {
  amount?: number;
  note?: string;
  budgetItemId?: number;
}

export interface CreateBudgetScheduleRequest {
  budgetItemId: number;
  year: number;
  month: number;
  monthlyBudget?: number;
  isActive?: boolean;
}

export interface UpdateBudgetScheduleRequest {
  monthlyBudget?: number;
  isActive?: boolean;
}

// レスポンス型
export interface GetGrantsResponse extends ApiResponse<GrantWithBudgetItems[]> {}
export interface GetGrantResponse extends ApiResponse<GrantWithBudgetItems> {}
export interface CreateGrantResponse extends ApiResponse<Grant> {}
export interface UpdateGrantResponse extends ApiResponse<Grant> {}
export interface DeleteGrantResponse extends ApiResponse<{ id: number }> {}

export interface GetBudgetItemsResponse extends ApiResponse<BudgetItemWithAllocations[]> {}
export interface GetBudgetItemResponse extends ApiResponse<BudgetItemWithAllocations> {}
export interface CreateBudgetItemResponse extends ApiResponse<BudgetItem> {}
export interface UpdateBudgetItemResponse extends ApiResponse<BudgetItem> {}
export interface DeleteBudgetItemResponse extends ApiResponse<{ id: number }> {}

export interface GetTransactionsResponse extends ApiResponse<PaginatedResult<TransactionWithAllocations>> {}
export interface GetTransactionResponse extends ApiResponse<TransactionWithAllocations> {}

export interface GetAllocationsResponse extends ApiResponse<AllocationSplit[]> {}
export interface CreateAllocationResponse extends ApiResponse<AllocationSplit> {}
export interface UpdateAllocationResponse extends ApiResponse<AllocationSplit> {}
export interface DeleteAllocationResponse extends ApiResponse<{ id: string }> {}

export interface GetBudgetSchedulesResponse extends ApiResponse<BudgetSchedule[]> {}
export interface CreateBudgetScheduleResponse extends ApiResponse<BudgetSchedule> {}
export interface UpdateBudgetScheduleResponse extends ApiResponse<BudgetSchedule> {}
export interface DeleteBudgetScheduleResponse extends ApiResponse<{ id: number }> {}

// 統計・集計レスポンス型
export interface GetGrantSummariesResponse extends ApiResponse<GrantSummary[]> {}
export interface GetBudgetUsageResponse extends ApiResponse<BudgetItemUsage[]> {}

// CSVインポート関連
export interface CsvImportRequest {
  file: File;
  type: 'grants' | 'budgetItems';
  skipHeader?: boolean;
  delimiter?: string;
}

export interface CsvImportResponse extends ApiResponse<{
  imported: number;
  skipped: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}> {}

export interface CsvValidationResponse extends ApiResponse<{
  isValid: boolean;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value: string;
  }>;
  preview: Record<string, any>[];
}> {}

// freee API関連
export interface FreeeAuthRequest {
  code: string;
  state?: string;
}

export interface FreeeAuthResponse extends ApiResponse<{
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
  scope?: string;
}> {}

export interface FreeeSyncRequest {
  companyId: number;
  dateFrom?: string;
  dateTo?: string;
  force?: boolean;
}

export interface FreeeSyncResponse extends ApiResponse<{
  syncId: number;
  status: string;
  message: string;
  recordCount: number;
  syncedAt: string;
}> {}

// 検索・フィルタリング用
export interface SearchTransactionsRequest {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  account?: string;
  supplier?: string;
  department?: string;
  minAmount?: number;
  maxAmount?: number;
  hasAllocation?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchGrantsRequest {
  query?: string;
  status?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// バルク操作用
export interface BulkCreateBudgetItemsRequest {
  grantId: number;
  items: Omit<CreateBudgetItemRequest, 'grantId'>[];
}

export interface BulkCreateBudgetItemsResponse extends ApiResponse<BudgetItem[]> {}

export interface BulkUpdateBudgetItemsRequest {
  updates: Array<{
    id: number;
    data: UpdateBudgetItemRequest;
  }>;
}

export interface BulkUpdateBudgetItemsResponse extends ApiResponse<BudgetItem[]> {}

export interface BulkDeleteRequest {
  ids: number[];
}

export interface BulkDeleteResponse extends ApiResponse<{ deletedCount: number }> {}

// 月別予算関連
export interface MonthlyBudgetRequest {
  budgetItemId: number;
  year: number;
  months: Array<{
    month: number;
    monthlyBudget: number;
    isActive?: boolean;
  }>;
}

export interface MonthlyBudgetResponse extends ApiResponse<BudgetSchedule[]> {}

export interface GetMonthlyUsageRequest {
  budgetItemId?: number;
  grantId?: number;
  year: number;
  month?: number;
}

export interface GetMonthlyUsageResponse extends ApiResponse<Array<{
  budgetItemId: number;
  budgetItem: BudgetItem;
  year: number;
  month: number;
  plannedAmount: number;
  actualAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  isOverBudget: boolean;
}>>> {}

// エクスポート関連
export interface ExportRequest {
  format: 'csv' | 'excel';
  type: 'transactions' | 'grants' | 'budgetItems' | 'allocations';
  filter?: Record<string, any>;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportResponse extends ApiResponse<{
  filename: string;
  downloadUrl: string;
  expiresAt: string;
}> {}

// ダッシュボード関連
export interface DashboardDataResponse extends ApiResponse<{
  grants: {
    total: number;
    active: number;
    totalBudget: number;
    totalUsed: number;
    usagePercentage: number;
  };
  transactions: {
    total: number;
    totalAmount: number;
    unallocated: number;
    recentCount: number;
  };
  budgetItems: {
    total: number;
    overBudget: number;
    nearLimit: number;
  };
  recentTransactions: TransactionWithAllocations[];
  topBudgetItems: Array<{
    budgetItem: BudgetItem;
    usagePercentage: number;
    totalUsed: number;
  }>;
}> {}