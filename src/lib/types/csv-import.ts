/**
 * CSVインポート関連の型定義
 */

export interface CSVImportResponse {
  success: boolean;
  message: string;
  summary: {
    total: number;
    success: number;
    errors: number;
  };
  data?: any[];
  errors?: string[];
}

export interface CSVImportError extends Error {
  code?: string;
  details?: any;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  stage: 'parsing' | 'validating' | 'importing' | 'completed' | 'error';
  message?: string;
}

// 助成金インポート用の型
export interface GrantImportData {
  name: string;
  grantCode?: string;
  totalAmount?: number;
  startDate?: string;
  endDate?: string;
  status?: 'in_progress' | 'completed' | 'reported';
}

// 予算項目インポート用の型
export interface BudgetItemImportData {
  name: string;
  category?: string;
  budgetedAmount?: number;
  note?: string;
  grantName?: string;
  grantId?: number;
}

// CSVファイルの情報
export interface CSVFileInfo {
  name: string;
  size: number;
  lastModified: number;
  encoding?: string;
  rowCount?: number;
  columnCount?: number;
}

// バリデーションルール
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'email' | 'url';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
}

// インポート設定
export interface ImportConfig {
  importType: 'grants' | 'budget-items';
  allowDuplicates?: boolean;
  updateExisting?: boolean;
  skipErrors?: boolean;
  batchSize?: number;
  delimiter?: string;
  encoding?: 'auto' | 'utf-8' | 'shift_jis' | 'euc-jp';
  validationRules?: ValidationRule[];
}

// プレビューデータ
export interface PreviewData {
  headers: string[];
  rows: string[][];
  mapping?: { [csvColumn: string]: string };  // CSV列名 → データベースフィールドのマッピング
  sampleCount: number;
  totalCount: number;
}

// カラムマッピング
export interface ColumnMapping {
  csvHeader: string;
  dbField: string;
  required: boolean;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  transform?: (value: string) => any;
}

// インポート履歴
export interface ImportHistory {
  id: string;
  timestamp: Date;
  importType: 'grants' | 'budget-items';
  fileName: string;
  fileSize: number;
  totalRows: number;
  successRows: number;
  errorRows: number;
  duration: number;  // milliseconds
  errors?: string[];
  userId?: string;
}

// インポートステータス
export type ImportStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

// エクスポート形式のデータ（参考用）
export interface ExportFormat {
  grants: {
    headers: string[];
    example: string[][];
    description: string;
  };
  budgetItems: {
    headers: string[];
    example: string[][];
    description: string;
  };
}