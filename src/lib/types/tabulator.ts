/**
 * Tabulator テーブル用の型定義
 * データグリッドコンポーネントで使用される型を定義
 */

import type { ColumnDefinition, Tabulator } from 'tabulator-tables';
import type { Grant, BudgetItem } from './models';

// 予算項目テーブルのデータ型
export interface BudgetItemTableData {
  // 基本フィールド
  id: number;
  grantId: number;
  grantName: string;
  name: string;
  category: string;
  budgetedAmount: number;
  usedAmount: number;
  remainingAmount: number;
  description?: string | null;
  
  // 月別データ（動的フィールド）
  monthlyUsedAmounts?: Record<string, number>;
  monthlyData?: Record<string, { budget: number; used: number; remaining: number }>;
  [key: `month_${number}_${number}`]: number;
  
  // カテゴリ集計用フィールド
  allocationsCount?: number;
  monthlyTotal?: number;
  monthlyUsedTotal?: number;
  monthlyRemainingTotal?: number;
  
  // UI用フィールド
  actions?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// 助成金テーブルのデータ型
export interface GrantTableData {
  id: number;
  name: string;
  fiscalYear: number;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  startDate?: string | null;
  endDate?: string | null;
  status: 'active' | 'completed' | 'pending';
  description?: string | null;
  
  // 集計データ
  budgetItemCount?: number;
  allocationCount?: number;
  
  // UI用フィールド
  actions?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// 取引テーブルのデータ型
export interface TransactionTableData {
  id: number;
  freeeId?: bigint | string | null;
  issueDate: string;
  dueDate?: string | null;
  partnerName?: string | null;
  accountItemName?: string | null;
  description?: string | null;
  amount: number;
  type: 'income' | 'expense';
  status: 'settled' | 'unsettled';
  
  // 割当データ
  allocationAmount?: number;
  isAllocated?: boolean;
  allocationCount?: number;
  
  // UI用フィールド
  actions?: string;
  selectable?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// 割当テーブルのデータ型
export interface AllocationTableData {
  id: number;
  transactionId: number;
  budgetItemId: number;
  amount: number;
  
  // 関連データ
  transactionDate?: string;
  transactionDescription?: string;
  budgetItemName?: string;
  grantName?: string;
  
  // UI用フィールド
  actions?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// 月列の定義
export interface MonthColumn {
  year: number;
  month: number;
  label: string;
}

// 月別集計データ
export interface MonthlyTotals {
  totalBudget: number;
  totalUsed: number;
  totalRemaining: number;
}

// 表示設定
export interface TableDisplaySettings {
  showMonthlyBudget: boolean;
  showMonthlyUsed: boolean;
  showMonthlyRemaining: boolean;
  monthFilterStartYear: number;
  monthFilterStartMonth: number;
  monthFilterEndYear: number;
  monthFilterEndMonth: number;
}

// フォーマッター関数の型
export type CellFormatter<T = any> = (cell: CellComponent<T>) => string | HTMLElement;
export type CellComponent<T = any> = {
  getValue: () => any;
  getRow: () => RowComponent<T>;
  getColumn: () => ColumnComponent;
  getField: () => string;
  getElement: () => HTMLElement;
};

export type RowComponent<T = any> = {
  getData: () => T;
  getIndex: () => number;
  getPosition: () => number;
  getCells: () => CellComponent<T>[];
  getElement: () => HTMLElement;
  select: () => void;
  deselect: () => void;
  isSelected: () => boolean;
};

export type ColumnComponent = {
  getField: () => string;
  getDefinition: () => ColumnDefinition;
  getElement: () => HTMLElement;
  hide: () => void;
  show: () => void;
  toggle: () => void;
  isVisible: () => boolean;
};

// カスタムカラム定義
export interface CustomColumnDefinition extends ColumnDefinition {
  // 基本プロパティ
  title: string;
  field: string;
  
  // 幅設定
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  widthGrow?: number;
  widthShrink?: number;
  
  // 配置
  hozAlign?: 'left' | 'center' | 'right';
  vertAlign?: 'top' | 'middle' | 'bottom';
  headerHozAlign?: 'left' | 'center' | 'right';
  
  // 機能
  frozen?: boolean;
  sorter?: string | ((a: any, b: any) => number);
  formatter?: CellFormatter;
  headerFilter?: boolean | string;
  headerFilterFunc?: string | ((headerValue: any, rowValue: any, rowData: any, filterParams: any) => boolean);
  
  // イベント
  cellClick?: (e: Event, cell: CellComponent) => void;
  cellDblClick?: (e: Event, cell: CellComponent) => void;
  cellContext?: (e: Event, cell: CellComponent) => void;
  
  // その他
  visible?: boolean;
  resizable?: boolean;
  moveable?: boolean;
  editable?: boolean;
  editor?: string | ((cell: CellComponent) => HTMLElement);
  validator?: string | ((cell: CellComponent, value: any) => boolean);
}

// テーブルオプション
export interface TableOptions {
  // データ
  data?: any[];
  columns: CustomColumnDefinition[];
  
  // レイアウト
  layout?: 'fitData' | 'fitDataFill' | 'fitDataStretch' | 'fitDataTable' | 'fitColumns';
  responsiveLayout?: boolean | 'hide' | 'collapse';
  height?: string | number;
  minHeight?: number;
  maxHeight?: number;
  
  // ページネーション
  pagination?: boolean | 'local' | 'remote';
  paginationSize?: number;
  paginationSizeSelector?: boolean | number[];
  paginationCounter?: string | ((pageSize: number, currentRow: number, currentPage: number, totalRows: number, totalPages: number) => string);
  
  // 選択
  selectable?: boolean | number | 'highlight';
  selectableRangeMode?: 'click' | 'shift';
  selectablePersistence?: boolean;
  
  // スクロール
  scrollToColumnPosition?: 'left' | 'center' | 'right';
  scrollToColumnVisibility?: 'visible' | 'hidden';
  virtualDom?: boolean;
  virtualDomVert?: boolean;
  virtualDomHorz?: boolean;
  
  // 操作
  movableColumns?: boolean;
  movableRows?: boolean;
  resizableColumns?: boolean | 'header' | 'cell';
  resizableRows?: boolean;
  
  // その他
  reactiveData?: boolean;
  placeholder?: string | HTMLElement;
  footerElement?: string | HTMLElement;
  tooltips?: boolean | ((cell: CellComponent) => string);
  history?: boolean;
  clipboard?: boolean | 'copy' | 'paste';
  clipboardCopySelector?: 'active' | 'table' | 'all';
}

// イベントハンドラー
export interface TableEventHandlers {
  // データイベント
  dataLoaded?: (data: any[]) => void;
  dataChanged?: (data: any[]) => void;
  dataFiltered?: (filters: any[], rows: RowComponent[]) => void;
  dataSorted?: (sorters: any[], rows: RowComponent[]) => void;
  
  // 行イベント
  rowClick?: (e: Event, row: RowComponent) => void;
  rowDblClick?: (e: Event, row: RowComponent) => void;
  rowContext?: (e: Event, row: RowComponent) => void;
  rowAdded?: (row: RowComponent) => void;
  rowDeleted?: (row: RowComponent) => void;
  rowUpdated?: (row: RowComponent) => void;
  rowSelected?: (row: RowComponent) => void;
  rowDeselected?: (row: RowComponent) => void;
  
  // セルイベント
  cellClick?: (e: Event, cell: CellComponent) => void;
  cellDblClick?: (e: Event, cell: CellComponent) => void;
  cellContext?: (e: Event, cell: CellComponent) => void;
  cellEditing?: (cell: CellComponent) => void;
  cellEdited?: (cell: CellComponent) => void;
  cellEditCancelled?: (cell: CellComponent) => void;
  
  // テーブルイベント
  tableBuilt?: () => void;
  tableBuilding?: () => void;
  renderStarted?: () => void;
  renderComplete?: () => void;
  
  // ページネーションイベント
  pageLoaded?: (pageno: number) => void;
}

// テーブルインスタンスの拡張型
export interface ExtendedTabulator extends Tabulator {
  // カスタムメソッド
  refreshData?: () => Promise<void>;
  exportData?: (format: 'csv' | 'json' | 'xlsx') => void;
  getSelectedData?: () => any[];
  clearSelection?: () => void;
  
  // 状態管理
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

// ヘルパー関数の型
export type TableDataTransformer<T, R> = (data: T) => R;
export type TableFilterFunction<T> = (data: T) => boolean;
export type TableSortFunction<T> = (a: T, b: T) => number;

// エクスポート設定
export interface TableExportConfig {
  filename?: string;
  sheetName?: string;
  columns?: string[];
  type?: 'csv' | 'json' | 'xlsx' | 'pdf';
  download?: boolean;
  encoding?: string;
}

// フィルター定義
export interface TableFilter {
  field: string;
  type: '=' | '!=' | 'like' | '<' | '>' | '<=' | '>=' | 'in' | 'regex';
  value: any;
}

// ソート定義
export interface TableSorter {
  column: string;
  dir: 'asc' | 'desc';
}

// グループ設定
export interface TableGroupConfig {
  field?: string;
  startOpen?: boolean | ((value: any, count: number, data: any[], group: any) => boolean);
  header?: string | ((value: any, count: number, data: any[], group: any) => string);
}

// 検証ルール
export interface TableValidationRule {
  field: string;
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'regex' | 'custom';
  value?: any;
  message?: string;
  validator?: (value: any, data: any) => boolean;
}

// テーブルの状態
export interface TableState {
  // ページネーション
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  
  // フィルター・ソート
  filters: TableFilter[];
  sorters: TableSorter[];
  
  // 選択
  selectedRows: number[];
  
  // 表示
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  
  // スクロール位置
  scrollTop: number;
  scrollLeft: number;
}