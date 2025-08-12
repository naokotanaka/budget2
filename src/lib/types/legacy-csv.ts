/**
 * レガシーnagaiku-budgetシステムのCSVデータ構造
 * セクション形式: [助成金データ], [予算項目データ], [割当データ]
 */

// レガシーCSVファイルの全体構造
export interface LegacyCSVFile {
  grants: LegacyGrantData[];
  budgetItems: LegacyBudgetItemData[];
  allocations: LegacyAllocationData[];
  parseErrors: ParseError[];
  warnings: string[];
}

// レガシー助成金データ（[助成金データ]セクション）
export interface LegacyGrantData {
  ID: string;
  名称: string;
  総額: string;
  開始日: string;
  終了日: string;
  ステータス: string;
}

// レガシー予算項目データ（[予算項目データ]セクション）
export interface LegacyBudgetItemData {
  ID: string;
  助成金ID: string;
  名称: string;
  カテゴリ: string;
  予算額: string;
}

// レガシー割当データ（[割当データ]セクション）
export interface LegacyAllocationData {
  ID: string;
  取引ID: string;
  予算項目ID: string;
  金額: string;
}

// 新システムの助成金データ（変換後）
export interface ConvertedGrantData {
  id?: number;
  name: string;
  grantCode?: string;
  totalAmount?: number;
  startDate?: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'applied';
  legacyId: string; // 元のレガシーIDを保持
}

// 新システムの予算項目データ（変換後）
export interface ConvertedBudgetItemData {
  id?: number;
  name: string;
  category?: string;
  budgetedAmount?: number;
  note?: string;
  grantId?: number;
  sortOrder?: number;
  legacyId: string; // 元のレガシーIDを保持
  legacyGrantId: string; // 元のレガシー助成金IDを保持
}

// 新システムの割当データ（変換後）
export interface ConvertedAllocationData {
  id?: string;
  transactionId: string;
  budgetItemId?: number;
  amount: number;
  note?: string;
  legacyId: string; // 元のレガシーIDを保持
  legacyBudgetItemId: string; // 元のレガシー予算項目IDを保持
}

// CSVセクション定義
export interface CSVSection {
  name: string;
  startLine: number;
  endLine: number;
  headers: string[];
  data: string[][];
}

// パース時のエラー情報
export interface ParseError {
  section: string;
  line: number;
  column?: number;
  message: string;
  rawData?: string;
}

// レガシーステータスマッピング
export const LEGACY_STATUS_MAPPING: { [key: string]: 'active' | 'completed' | 'applied' } = {
  'active': 'active',
  'completed': 'completed',
  'reported': 'applied',
  'inactive': 'completed'
};

// セクションヘッダーのパターン
export const SECTION_HEADERS = {
  GRANTS: '[助成金データ]',
  BUDGET_ITEMS: '[予算項目データ]',
  ALLOCATIONS: '[割当データ]'
} as const;

// レガシーフィールド名から新システムフィールド名へのマッピング
export const FIELD_MAPPING = {
  grants: {
    'ID': 'id',
    '名称': 'name', 
    '総額': 'totalAmount',
    '開始日': 'startDate',
    '終了日': 'endDate',
    'ステータス': 'status'
  },
  budgetItems: {
    'ID': 'id',
    '助成金ID': 'grantId',
    '名称': 'name',
    'カテゴリ': 'category',
    '予算額': 'budgetedAmount'
  },
  allocations: {
    'ID': 'id',
    '取引ID': 'transactionId',
    '予算項目ID': 'budgetItemId',
    '金額': 'amount'
  }
} as const;

// データ変換設定
export interface ConversionConfig {
  skipInvalidDates?: boolean;
  defaultGrantStatus?: 'active' | 'completed' | 'applied';
  preserveLegacyIds?: boolean;
  validateRelationships?: boolean;
  encoding?: 'utf-8' | 'shift_jis' | 'euc-jp';
}

// 変換結果
export interface ConversionResult {
  grants: ConvertedGrantData[];
  budgetItems: ConvertedBudgetItemData[];
  allocations: ConvertedAllocationData[];
  errors: ParseError[];
  warnings: string[];
  stats: {
    grantsConverted: number;
    budgetItemsConverted: number;
    allocationsConverted: number;
    errorsCount: number;
    warningsCount: number;
  };
}

// インポート検証結果
export interface ValidationResult {
  isValid: boolean;
  errors: ParseError[];
  warnings: string[];
  relationshipChecks: {
    missingGrants: string[]; // 予算項目で参照している存在しない助成金ID
    missingBudgetItems: string[]; // 割当で参照している存在しない予算項目ID
    orphanedBudgetItems: string[]; // 助成金が存在しない予算項目
    orphanedAllocations: string[]; // 予算項目が存在しない割当
  };
}

// インポート進行状況
export interface LegacyImportProgress {
  stage: 'parsing' | 'converting' | 'validating' | 'importing' | 'completed' | 'error';
  current: number;
  total: number;
  percentage: number;
  currentSection?: 'grants' | 'budget_items' | 'allocations';
  message?: string;
  errors?: ParseError[];
}