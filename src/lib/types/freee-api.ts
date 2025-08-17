/**
 * freee API用の型定義
 * API通信に使用される全ての型を定義
 */

// 基本型定義
export interface FreeeCompany {
  id: number;
  name: string;
  name_kana?: string;
  display_name?: string;
  role: string;
  contact_name?: string;
  contact_email?: string;
  phone1?: string;
  phone2?: string;
  fax?: string;
  zip_code?: string;
  prefecture_code?: number;
  prefecture_name?: string;
  address1?: string;
  address2?: string;
}

// 取引（Deal）関連
export interface FreeeDeal {
  id: string | number;
  company_id: number;
  issue_date: string;
  due_date?: string;
  amount: number;
  due_amount?: number;
  type: 'income' | 'expense';
  partner_id?: number;
  partner_code?: string;
  ref_number?: string;
  status: 'unsettled' | 'settled';
  details?: FreeeDealDetail[];
  payments?: FreeeDealPayment[];
  renews?: FreeeDealRenew[];
  partner?: FreeePartner;
  account_item?: FreeeAccountItem;
  tax_code?: number;
  tax_rate?: number;
  vat?: number;
  description?: string;
  tag_ids?: number[];
  segment_1_tag_id?: number;
  segment_2_tag_id?: number;
  segment_3_tag_id?: number;
  txn_number?: string;
  receipt_ids?: number[];
  receipts?: FreeeReceipt[];
}

// レシート関連
export interface FreeeReceipt {
  id: number;
  company_id: number;
  description?: string;
  receipt_metadatum?: {
    partner_name?: string;
    issue_date?: string;
    amount?: number;
  };
  file_src?: string;
  mime_type?: string;
  created_at?: string;
  deal_id?: number;
}

export interface FreeeDealDetail {
  id: number;
  account_item_id: number;
  tax_code: number;
  tax_rate?: number;
  item_id?: number;
  section_id?: number;
  tag_ids?: number[];
  segment_1_tag_id?: number;
  segment_2_tag_id?: number;
  segment_3_tag_id?: number;
  amount: number;
  vat?: number;
  description?: string;
  entry_side?: 'credit' | 'debit';
}

export interface FreeeDealPayment {
  id: number;
  date: string;
  from_walletable_type?: string;
  from_walletable_id?: number;
  amount: number;
}

export interface FreeeDealRenew {
  id: number;
  update_date: string;
  renew_target_id?: number;
  renew_target_type?: string;
  details?: FreeeDealDetail[];
}

// 勘定科目関連
export interface FreeeAccountItem {
  id: number;
  company_id: number;
  name: string;
  shortcut?: string;
  shortcut_num?: string;
  tax_code?: number;
  account_category?: string;
  account_category_id?: number;
  group_name?: string;
  available: boolean;
  walletable_id?: number;
  default_tax_code?: number;
  default_tax_id?: number;
  categories?: string[];
  available_in?: string[];
  searchable?: number;
  accumulated_dep_account_item_id?: number;
  accumulated_dep_account_item_name?: string;
  items?: FreeeItem[];
  partners?: FreeePartner[];
}

// 取引先関連
export interface FreeePartner {
  id: number;
  company_id: number;
  code?: string;
  name: string;
  shortcut1?: string;
  shortcut2?: string;
  long_name?: string;
  name_kana?: string;
  default_title?: string;
  phone?: string;
  contact_name?: string;
  email?: string;
  payer_walletable_id?: number;
  payer_walletable_name?: string;
  payer_walletable_type?: string;
  transfer_fee_handling_side?: 'payer' | 'payee';
  address_attributes?: FreeeAddressAttributes;
  partner_doc_setting_attributes?: FreeePartnerDocSettingAttributes;
  available: boolean;
  country_code?: string;
  invoice_registration_number?: string;
  org_code?: number;
  qualified_invoice_issuer?: boolean;
}

export interface FreeeAddressAttributes {
  zipcode?: string;
  prefecture_code?: number;
  street_name1?: string;
  street_name2?: string;
}

export interface FreeePartnerDocSettingAttributes {
  sending_method?: number;
}

// 部門関連
export interface FreeeSection {
  id: number;
  company_id: number;
  name: string;
  long_name?: string;
  shortcut1?: string;
  shortcut2?: string;
  code?: string;
  display_order?: number;
  parent_id?: number;
  indent_count?: number;
  available: boolean;
}

// 品目関連
export interface FreeeItem {
  id: number;
  company_id: number;
  name: string;
  shortcut1?: string;
  shortcut2?: string;
  code?: string;
  unit?: string;
  available: boolean;
}

// タグ関連
export interface FreeeTag {
  id: number;
  company_id: number;
  name: string;
  shortcut?: string;
  range_type?: 'deal' | 'manual_journal' | 'all';
  update_date?: string;
}

// 口座（Walletable）関連
export interface FreeeWalletable {
  id: number;
  name: string;
  bank_id?: number;
  type: 'bank_account' | 'credit_card' | 'wallet';
  last_balance?: number;
  walletable_balance?: number;
}

export interface FreeeWalletTxn {
  id: number;
  company_id: number;
  date: string;
  balance: number;
  entry_side: 'income' | 'expense';
  walletable_type?: string;
  walletable_id?: number;
  description?: string;
  amount: number;
  due_amount?: number;
  deal_id?: number;
  deal_ids?: number[];
}

// 仕訳帳関連
export interface FreeeJournal {
  id: string;
  company_id: number;
  download_type?: string;
  start_date?: string;
  end_date?: string;
  visible_tags?: string[];
  visible_ids?: string[];
  status_url?: string;
  download_url?: string;
}

export interface FreeeJournalReport {
  id: string;
  company_id: number;
  download_type: string;
  start_date: string;
  end_date: string;
  visible_tags?: string[];
  visible_ids?: string[];
  journals?: FreeeJournalEntry[];
}

export interface FreeeJournalEntry {
  txn_date: string;
  settlement_date?: string;
  created_at: string;
  id: number;
  txn_number: string;
  description?: string;
  details?: FreeeJournalDetail[];
}

export interface FreeeJournalDetail {
  entry_side: 'credit' | 'debit';
  account_item_id: number;
  account_item_name?: string;
  tax_code?: number;
  partner_id?: number;
  partner_name?: string;
  partner_code?: string;
  item_id?: number;
  item_name?: string;
  section_id?: number;
  section_name?: string;
  tag_ids?: number[];
  tag_names?: string[];
  segment_1_tag_id?: number;
  segment_1_tag_name?: string;
  segment_2_tag_id?: number;
  segment_2_tag_name?: string;
  segment_3_tag_id?: number;
  segment_3_tag_name?: string;
  amount: number;
  vat?: number;
  description?: string;
}

// レスポンス型定義
export interface FreeeAPIResponse<T> {
  meta?: {
    total_count?: number;
    total_pages?: number;
    current_page?: number;
    per_page?: number;
  };
  [key: string]: T | T[] | undefined | { total_count?: number; total_pages?: number; current_page?: number; per_page?: number; };
}

export interface FreeeCompaniesResponse extends FreeeAPIResponse<FreeeCompany> {
  companies: FreeeCompany[];
}

export interface FreeeDealsResponse extends FreeeAPIResponse<FreeeDeal> {
  deals: FreeeDeal[];
}

export interface FreeeDealResponse extends FreeeAPIResponse<FreeeDeal> {
  deal: FreeeDeal;
}

export interface FreeeAccountItemsResponse extends FreeeAPIResponse<FreeeAccountItem> {
  account_items: FreeeAccountItem[];
}

export interface FreeePartnersResponse extends FreeeAPIResponse<FreeePartner> {
  partners: FreeePartner[];
}

export interface FreeeSectionsResponse extends FreeeAPIResponse<FreeeSection> {
  sections: FreeeSection[];
}

export interface FreeeItemsResponse extends FreeeAPIResponse<FreeeItem> {
  items: FreeeItem[];
}

export interface FreeeTagsResponse extends FreeeAPIResponse<FreeeTag> {
  tags: FreeeTag[];
}

export interface FreeeWalletTxnsResponse extends FreeeAPIResponse<FreeeWalletTxn> {
  wallet_txns: FreeeWalletTxn[];
}

export interface FreeeJournalsResponse extends FreeeAPIResponse<FreeeJournal> {
  journals: FreeeJournal[];
}

export interface FreeeReceiptsResponse extends FreeeAPIResponse<FreeeReceipt> {
  receipts: FreeeReceipt[];
}

// エラー型定義
export interface FreeeAPIError {
  status_code: number;
  errors?: FreeeErrorDetail[];
  message?: string;
}

export interface FreeeErrorDetail {
  type?: string;
  message: string;
  messages?: string[];
}

// ユーティリティ型
export type FreeeDate = string; // YYYY-MM-DD format
export type FreeeDateTime = string; // ISO 8601 format
export type FreeeAmount = number;
export type FreeeTaxRate = 0 | 5 | 8 | 10;

// 列挙型
export enum FreeeDealType {
  Income = 'income',
  Expense = 'expense'
}

export enum FreeeDealStatus {
  Unsettled = 'unsettled',
  Settled = 'settled'
}

export enum FreeeEntrySide {
  Credit = 'credit',
  Debit = 'debit'
}

export enum FreeeWalletableType {
  BankAccount = 'bank_account',
  CreditCard = 'credit_card',
  Wallet = 'wallet'
}

// パラメータ型定義
export interface FreeeListDealsParams {
  company_id: number;
  partner_id?: number;
  account_item_id?: number;
  partner_code?: string;
  status?: FreeeDealStatus;
  type?: FreeeDealType;
  start_issue_date?: FreeeDate;
  end_issue_date?: FreeeDate;
  start_due_date?: FreeeDate;
  end_due_date?: FreeeDate;
  start_renew_date?: FreeeDate;
  end_renew_date?: FreeeDate;
  offset?: number;
  limit?: number;
  registered_from?: FreeeDateTime;
  accruals?: 'with_accruals' | 'without_accruals';
}

export interface FreeeCreateDealParams {
  company_id: number;
  issue_date: FreeeDate;
  type: FreeeDealType;
  amount: FreeeAmount;
  due_date?: FreeeDate;
  partner_id?: number;
  partner_code?: string;
  ref_number?: string;
  details?: Omit<FreeeDealDetail, 'id'>[];
  payments?: Omit<FreeeDealPayment, 'id'>[];
  receipt_ids?: number[];
}

export interface FreeeUpdateDealParams extends Partial<FreeeCreateDealParams> {
  company_id: number;
}

// 型ガード関数
export function isFreeeDeal(obj: unknown): obj is FreeeDeal {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'company_id' in obj &&
    'issue_date' in obj &&
    'amount' in obj &&
    'type' in obj
  );
}

export function isFreeeAPIError(obj: unknown): obj is FreeeAPIError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'status_code' in obj &&
    typeof (obj as FreeeAPIError).status_code === 'number'
  );
}

export function isFreeeCompaniesResponse(obj: unknown): obj is FreeeCompaniesResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'companies' in obj &&
    Array.isArray((obj as FreeeCompaniesResponse).companies)
  );
}

export function isFreeeDealsResponse(obj: unknown): obj is FreeeDealsResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'deals' in obj &&
    Array.isArray((obj as FreeeDealsResponse).deals)
  );
}