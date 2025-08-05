/**
 * freee関連の型定義
 * 型安全性を向上してランタイムエラーを防ぐ
 */

export interface FreeeCompany {
  id: number;
  name: string;
  display_name?: string;
  role: string;
}

export interface FreeePageData {
  isConnected: boolean;
  companies: FreeeCompany[];
  lastSyncAt: string | null;
  connectionError: string | null;
}

export interface FreeeTransaction {
  id: number;
  issue_date: string;
  partner_name: string;
  description: string;
  account_item_name: string;
  amount: number;
  type: 'income' | 'expense';
}

export interface FreeeAPIResponse {
  success: boolean;
  data?: FreeeTransaction[];
  count?: number;
  message?: string;
  error?: string;
  needsSetup?: boolean;
}

// ガード関数：型安全性を保証
export function isFreeePageData(data: any): data is FreeePageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.isConnected === 'boolean' &&
    Array.isArray(data.companies) &&
    (data.lastSyncAt === null || typeof data.lastSyncAt === 'string') &&
    (data.connectionError === null || typeof data.connectionError === 'string')
  );
}

export function isFreeeAPIResponse(data: any): data is FreeeAPIResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.success === 'boolean'
  );
}

// デフォルト値
export const defaultFreeePageData: FreeePageData = {
  isConnected: false,
  companies: [],
  lastSyncAt: null,
  connectionError: null
};