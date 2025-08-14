// フォーム関連の型定義
import type { Grant, BudgetItem, AllocationSplit, BudgetSchedule } from './models.js';

// 共通フォーム型
export interface FormField {
  name: string;
  value: any;
  error?: string;
  touched?: boolean;
  required?: boolean;
}

export interface FormState {
  fields: Record<string, FormField>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
}

// 助成金フォーム
export interface GrantFormData {
  name: string;
  grantCode: string;
  totalAmount: number | null;
  startDate: string;
  endDate: string;
  status: string;
}

export interface GrantFormErrors extends Record<string, string> {
  name?: string;
  grantCode?: string;
  totalAmount?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface GrantFormState extends FormState {
  data: GrantFormData;
  errors: GrantFormErrors;
  originalData?: GrantFormData;
}

// 予算項目フォーム
export interface BudgetItemFormData {
  name: string;
  category: string;
  budgetedAmount: number | null;
  note: string;
  grantId: number;
  sortOrder: number;
}

export interface BudgetItemFormErrors extends Record<string, string> {
  name?: string;
  category?: string;
  budgetedAmount?: string;
  note?: string;
  grantId?: string;
  sortOrder?: string;
}

export interface BudgetItemFormState extends FormState {
  data: BudgetItemFormData;
  errors: BudgetItemFormErrors;
  originalData?: BudgetItemFormData;
}

// 割り当てフォーム
export interface AllocationFormData {
  budgetItemId: number;
  amount: number;
  note: string;
  transactionId?: string;
  detailId?: bigint;
}

export interface AllocationFormErrors extends Record<string, string> {
  budgetItemId?: string;
  amount?: string;
  note?: string;
  transactionId?: string;
}

export interface AllocationFormState extends FormState {
  data: AllocationFormData;
  errors: AllocationFormErrors;
  originalData?: AllocationFormData;
}

// 一括割り当てフォーム
export interface BulkAllocationFormData {
  transactionIds: string[];
  budgetItemId: number;
  splitMethod: 'equal' | 'manual' | 'percentage';
  allocations: Array<{
    transactionId: string;
    amount: number;
    percentage?: number;
  }>;
  note: string;
}

export interface BulkAllocationFormErrors extends Record<string, string> {
  transactionIds?: string;
  budgetItemId?: string;
  splitMethod?: string;
  allocations?: string;
  note?: string;
}

export interface BulkAllocationFormState extends FormState {
  data: BulkAllocationFormData;
  errors: BulkAllocationFormErrors;
}

// 月割り設定フォーム
export interface MonthlyBudgetFormData {
  budgetItemId: number;
  year: number;
  months: Array<{
    month: number;
    monthlyBudget: number;
    isActive: boolean;
  }>;
  distributionMethod: 'equal' | 'manual' | 'percentage';
  totalBudget?: number;
}

export interface MonthlyBudgetFormErrors extends Record<string, string> {
  budgetItemId?: string;
  year?: string;
  months?: string;
  distributionMethod?: string;
  totalBudget?: string;
}

export interface MonthlyBudgetFormState extends FormState {
  data: MonthlyBudgetFormData;
  errors: MonthlyBudgetFormErrors;
}

// 検索フォーム
export interface TransactionSearchFormData {
  query: string;
  dateFrom: string;
  dateTo: string;
  account: string;
  supplier: string;
  department: string;
  minAmount: number | null;
  maxAmount: number | null;
  hasAllocation: boolean | null;
}

export interface GrantSearchFormData {
  query: string;
  status: string;
  startDateFrom: string;
  startDateTo: string;
  endDateFrom: string;
  endDateTo: string;
}

// CSVインポートフォーム
export interface CsvImportFormData {
  file: File | null;
  type: 'grants' | 'budgetItems';
  skipHeader: boolean;
  delimiter: string;
  encoding: string;
  previewData: Record<string, any>[];
  columnMapping: Record<string, string>;
}

export interface CsvImportFormErrors extends Record<string, string> {
  file?: string;
  type?: string;
  delimiter?: string;
  encoding?: string;
  columnMapping?: string;
}

export interface CsvImportFormState extends FormState {
  data: CsvImportFormData;
  errors: CsvImportFormErrors;
  currentStep: number;
  totalSteps: number;
}

// フィルタフォーム
export interface FilterFormData {
  [key: string]: any;
}

export interface FilterFormState {
  data: FilterFormData;
  activeFilters: string[];
  hasActiveFilters: boolean;
}

// バリデーション関数の型
export type ValidatorFunction<T = any> = (value: T) => string | null;
export type AsyncValidatorFunction<T = any> = (value: T) => Promise<string | null>;

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: ValidatorFunction;
  asyncCustom?: AsyncValidatorFunction;
}

export interface FormValidationSchema {
  [fieldName: string]: FieldValidation;
}

// フォームアクション型
export type FormAction = 
  | { type: 'SET_FIELD'; field: string; value: any }
  | { type: 'SET_ERROR'; field: string; error: string }
  | { type: 'CLEAR_ERROR'; field: string }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_SUBMITTING'; submitting: boolean }
  | { type: 'SET_TOUCHED'; field: string }
  | { type: 'RESET_FORM' }
  | { type: 'LOAD_DATA'; data: any };

// フォームイベント型
export interface FormSubmitEvent<T = any> {
  data: T;
  isValid: boolean;
  errors: Record<string, string>;
}

export interface FormFieldChangeEvent {
  field: string;
  value: any;
  previousValue: any;
}

export interface FormValidationEvent {
  field: string;
  value: any;
  error: string | null;
}

// フォームプロバイダー型
export interface FormContextValue<T = any> {
  formState: FormState;
  data: T;
  errors: Record<string, string>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  setField: (field: string, value: any) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearErrors: () => void;
  validate: (field?: string) => Promise<boolean>;
  submit: () => Promise<void>;
  reset: () => void;
  loadData: (data: any) => void;
}

// 動的フォーム型
export interface DynamicFormField {
  type: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file';
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Array<{ value: any; label: string }>;
  validation?: FieldValidation;
  dependsOn?: string[];
  conditionalDisplay?: (data: any) => boolean;
}

export interface DynamicFormSchema {
  fields: DynamicFormField[];
  validation?: FormValidationSchema;
  submitAction?: string;
  submitMethod?: 'POST' | 'PUT' | 'PATCH';
}

// ウィザード型フォーム
export interface WizardStepData {
  stepId: string;
  title: string;
  description?: string;
  fields: DynamicFormField[];
  validation?: FormValidationSchema;
  canProceed?: (data: any) => boolean;
  onStepComplete?: (data: any) => Promise<void>;
}

export interface WizardFormState {
  currentStep: number;
  totalSteps: number;
  stepData: WizardStepData[];
  formData: Record<string, any>;
  completedSteps: Set<number>;
  canProceedToNext: boolean;
  canGoToPrevious: boolean;
}

export interface WizardFormAction {
  type: 'NEXT_STEP' | 'PREVIOUS_STEP' | 'GO_TO_STEP' | 'COMPLETE_STEP' | 'UPDATE_DATA' | 'RESET_WIZARD';
  payload?: any;
}