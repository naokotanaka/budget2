// Grant関連の型定義
export interface Grant {
  id: number;
  name: string;
  grantCode?: string | null;
  totalAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status: 'active' | 'completed' | 'applied' | 'reported';
  budgetItemsCount?: number;
  usedAmount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// BudgetItem関連の型定義
export interface BudgetItem {
  id: number;
  name: string;
  category?: string | null;
  budgetedAmount?: number | null;
  usedAmount?: number;
  monthlyUsedAmounts?: Record<string, number>;
  note?: string | null;
  grantId?: number | null;
  grant?: Grant;
  createdAt?: Date;
  updatedAt?: Date;
}

// Transaction関連の型定義
export interface Transaction {
  id: string;
  journalNumber: bigint;
  journalLineNumber: number;
  detailId: bigint;
  date: Date;
  description?: string | null;
  amount: number;
  account?: string | null;
  supplier?: string | null;
  item?: string | null;
  memo?: string | null;
  remark?: string | null;
  department?: string | null;
  managementNumber?: string | null;
  freeDealId?: bigint | null;
  detailDescription?: string | null;
  receiptIds?: string | null;
  tags?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// AllocationSplit関連の型定義
export interface AllocationSplit {
  id: string;
  detailId?: bigint | null;
  budgetItemId: number;
  amount: number;
  note?: string | null;
  transaction?: Transaction;
  budgetItem?: BudgetItem;
  createdAt?: Date;
  updatedAt?: Date;
}

// Receipt関連の型定義
export interface Receipt {
  id: number;
  transactionId: string;
  fileName: string;
  fileUrl?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt: Date;
  transaction?: Transaction;
}

// BudgetItemSchedule関連の型定義
export interface BudgetItemSchedule {
  id: number;
  budgetItemId: number;
  year: number;
  month: number;
  budgetedAmount: number;
  budgetItem?: BudgetItem;
  createdAt?: Date;
  updatedAt?: Date;
}

// MonthColumn型定義（テーブル用）
export interface MonthColumn {
  field: string;
  title: string;
  year: number;
  month: number;
  monthName?: string;
  isFuture?: boolean;
}

// フォーム用の型定義
export interface GrantForm {
  id?: number;
  name: string;
  grantCode?: string;
  totalAmount?: number | string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'applied' | 'reported';
}

export interface BudgetItemForm {
  id?: number;
  name: string;
  category?: string;
  budgetedAmount?: number | string;
  note?: string;
  grantId?: number;
}

// API レスポンス型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ページデータ型
export interface PageData {
  grants?: Grant[];
  budgetItems?: BudgetItem[];
  transactions?: Transaction[];
  allocations?: AllocationSplit[];
  receipts?: Receipt[];
}

// Freee連携ステータス
export interface FreeeConnectionStatus {
  isConnected: boolean;
  lastSyncDate?: Date | null;
  companyName?: string | null;
  error?: string | null;
}

// インポートプレビュー
export interface ImportPreviewItem {
  rowNumber: number;
  data: Record<string, any>;
  errors?: string[];
  warnings?: string[];
}

// 月別集計データ
export interface MonthlyTotal {
  budget: number;
  used: number;
  remaining: number;
  month: string;
  year: number;
}

// フィルター設定
export interface FilterSettings {
  showCompletedGrants: boolean;
  showReportedGrants: boolean;
  filterYear: string;
  monthFilterStartYear: number;
  monthFilterStartMonth: number;
  monthFilterEndYear: number;
  monthFilterEndMonth: number;
  selectedCategory?: string;
}

// 表示設定
export interface DisplaySettings {
  showMonthlyBudget: boolean;
  showMonthlyUsed: boolean;
  showMonthlyRemaining: boolean;
}