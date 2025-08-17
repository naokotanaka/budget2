import type { Transaction } from '@prisma/client';
import type { FreeeDeal as APIDeal, FreeeDealDetail as APIDetail } from '../types/freee-api';

// 既存のコードとの互換性のためエイリアスを提供
export type FreeDeal = APIDeal & {
  partner_name?: string;
  ref_number?: string;
  memo?: string;
};

export type FreeDealDetail = APIDetail & {
  account_item_name?: string;
};

// トランザクションデータの型定義（DB保存用）
export interface TransactionData {
  journalNumber: bigint;
  journalLineNumber: number;
  date: Date;
  description: string;
  amount: number;
  account: string;
  supplier: string;
  memo: string;
  freeDealId: bigint;
  detailId: bigint;
}

// 再帰的な型定義
type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// BigIntをJSON形式に変換するヘルパー関数
export function bigIntToString(value: unknown): JsonValue {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(bigIntToString);
  }
  if (value !== null && typeof value === 'object') {
    const result: JsonObject = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = bigIntToString(val);
    }
    return result;
  }
  return value;
}

// 安全にBigIntに変換するヘルパー関数
export function safeBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.trim() === '') {
      throw new Error(`Cannot convert empty string to BigInt`);
    }
    return BigInt(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot convert ${value} to BigInt: not finite`);
    }
    return BigInt(value);
  }
  throw new Error(`Cannot convert ${typeof value} to BigInt: ${value}`);
}

// 文字列を統一的に正規化する関数
export function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// 金額を統一的に正規化する関数（DBではInt型、APIでは数値）
export function normalizeAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }
  return 0;
}

// 2つのトランザクションデータを比較して変更があるかチェック
export function hasTransactionChanged(existing: Transaction, newData: TransactionData, enableDebug: boolean = false): boolean {
  if (enableDebug) {
    console.log('=== 変更検出比較開始 ===');
    console.log('比較対象ID:', existing.id, '(freeDealId:', existing.freeDealId?.toString(), ')');
  }
  
  // 既存データの正規化
  const existingNormalized = {
    date: new Date(existing.date).toDateString(),
    amount: normalizeAmount(existing.amount),
    description: normalizeString(existing.description),
    account: normalizeString(existing.account),
    supplier: normalizeString(existing.supplier),
    memo: normalizeString(existing.memo)
  };
  
  // 新データの正規化
  const newNormalized = {
    date: new Date(newData.date).toDateString(),
    amount: normalizeAmount(newData.amount),
    description: normalizeString(newData.description),
    account: normalizeString(newData.account),
    supplier: normalizeString(newData.supplier),
    memo: normalizeString(newData.memo)
  };
  
  if (enableDebug) {
    console.log('既存データ(正規化後):', existingNormalized);
    console.log('新データ(正規化後):', newNormalized);
  }
  
  // 日付の比較
  if (existingNormalized.date !== newNormalized.date) {
    if (enableDebug) {
      console.log(`[変更検出] 日付: "${existingNormalized.date}" → "${newNormalized.date}"`);
    }
    return true;
  }

  // 金額の比較
  if (existingNormalized.amount !== newNormalized.amount) {
    if (enableDebug) {
      console.log(`[変更検出] 金額: ${existingNormalized.amount} → ${newNormalized.amount}`);
    }
    return true;
  }

  // 説明の比較
  if (existingNormalized.description !== newNormalized.description) {
    if (enableDebug) {
      console.log(`[変更検出] 説明: "${existingNormalized.description}" → "${newNormalized.description}"`);
    }
    return true;
  }

  // 勘定科目の比較
  if (existingNormalized.account !== newNormalized.account) {
    if (enableDebug) {
      console.log(`[変更検出] 勘定科目: "${existingNormalized.account}" → "${newNormalized.account}"`);
    }
    return true;
  }

  // 取引先の比較
  if (existingNormalized.supplier !== newNormalized.supplier) {
    if (enableDebug) {
      console.log(`[変更検出] 取引先: "${existingNormalized.supplier}" → "${newNormalized.supplier}"`);
    }
    return true;
  }

  // メモの比較
  if (existingNormalized.memo !== newNormalized.memo) {
    if (enableDebug) {
      console.log(`[変更検出] メモ: "${existingNormalized.memo}" → "${newNormalized.memo}"`);
    }
    return true;
  }

  if (enableDebug) {
    console.log('[変更検出] 変更なし');
  }
  return false;
}

// freee dealからトランザクションデータを生成する関数
export function createTransactionDataFromDeal(deal: FreeDeal, tagMap?: Map<number, string>): TransactionData {
  // 明細データから金額と勘定科目を取得
  let amount = 0;
  let accountItemName = '不明';
  let description = '';

  if (deal.details && deal.details.length > 0) {
    const detail = deal.details[0];
    amount = Math.abs(detail.amount || 0);
    accountItemName = detail.account_item_name || '不明';
    description = detail.description || '';
  } else if (deal.amount) {
    amount = Math.abs(deal.amount);
  }

  // detailIdを適切に生成
  const detailIdValue = deal.details && deal.details.length > 0 && deal.details[0].id 
    ? safeBigInt(deal.details[0].id)
    : safeBigInt(deal.id);

  // タグIDsからタグ名を取得（メモタグの正しい処理）
  let memoTags: string | null = null;
  if (deal.tag_ids && Array.isArray(deal.tag_ids) && deal.tag_ids.length > 0 && tagMap) {
    // tag_idsからタグ名を取得し、複数ある場合はカンマ区切りで結合
    const tagNames = deal.tag_ids
      .map((tagId: number) => tagMap.get(tagId))
      .filter((tagName: string | undefined) => tagName !== undefined);
    
    if (tagNames.length > 0) {
      memoTags = tagNames.join(', ');
    }
  }

  return {
    journalNumber: safeBigInt(deal.id),
    journalLineNumber: 1,
    date: new Date(deal.issue_date),
    description: normalizeString(deal.ref_number || description || ''),
    amount: amount,
    account: normalizeString(accountItemName),
    supplier: normalizeString(deal.partner_name),
    memo: normalizeString(memoTags),
    freeDealId: safeBigInt(deal.id),
    detailId: detailIdValue
  };
}

// 同期処理の統計情報
export interface SyncStats {
  selected: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  deletedCount: number;
  errorCount: number;
  errors: Array<{
    freeDealId: string;
    error: string;
  }>;
}

// 環境変数によるデバッグログの制御
export function isDebugEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.FREEE_SYNC_DEBUG === 'true';
}