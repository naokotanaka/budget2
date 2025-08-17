import type { Transaction } from '@prisma/client';
import { logger } from './logger';

/**
 * BigIntをJSON形式に変換するヘルパー関数
 * オブジェクト内のBigInt値を再帰的に文字列に変換
 */
export function bigIntToString(value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(bigIntToString);
  }
  if (value !== null && typeof value === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = bigIntToString(val);
    }
    return result;
  }
  return value;
}

/**
 * 安全にBigIntに変換するヘルパー関数
 * 数値や文字列をBigIntに変換、変換できない場合はエラー
 */
export function safeBigInt(value: any): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return BigInt(value);
  }
  throw new Error(`Cannot convert ${typeof value} to BigInt: ${value}`);
}

/**
 * 文字列を統一的に正規化する関数
 * null/undefinedを空文字列に変換し、前後の空白を削除
 */
export function normalizeString(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * 金額を統一的に正規化する関数
 * DBではInt型、APIでは数値として扱う
 */
export function normalizeAmount(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  // 直接Infinityをチェック
  if (value === Infinity || value === -Infinity) return 0;
  
  const numValue = Number(value);
  return isNaN(numValue) || !isFinite(numValue) ? 0 : numValue;
}

/**
 * 2つのトランザクションデータを比較して変更があるかチェック
 * 正規化された値同士で比較を行う
 */
export function hasTransactionChanged(existing: Transaction, newData: any): boolean {
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
  
  logger.comparison(`比較開始 - freeDealId: ${existing.freeDealId}`);
  logger.comparison('既存データ(正規化後)', existingNormalized);
  logger.comparison('新データ(正規化後)', newNormalized);
  
  // 各フィールドを比較
  const changes = {
    date: existingNormalized.date !== newNormalized.date,
    amount: existingNormalized.amount !== newNormalized.amount,
    description: existingNormalized.description !== newNormalized.description,
    account: existingNormalized.account !== newNormalized.account,
    supplier: existingNormalized.supplier !== newNormalized.supplier,
    memo: existingNormalized.memo !== newNormalized.memo
  };

  const hasChanges = Object.values(changes).some(changed => changed);
  
  if (hasChanges) {
    const changedFields = Object.entries(changes)
      .filter(([, changed]) => changed)
      .map(([field]) => field);
    logger.comparison(`変更検出: ${changedFields.join(', ')}`);
  } else {
    logger.comparison('変更なし');
  }

  return hasChanges;
}

/**
 * freee dealデータからトランザクションデータを生成
 */
export function createTransactionData(deal: any, tagMap?: Map<number, string>) {
  // 明細データから金額と勘定科目を取得
  let amount = 0;
  let accountItemId = null;
  let accountItemName = '不明';
  let description = '';

  if (deal.details && deal.details.length > 0) {
    const detail = deal.details[0];
    amount = Math.abs(detail.amount || 0);
    accountItemId = detail.account_item_id || null;
    accountItemName = detail.account_item_name || '不明';
    description = detail.description || '';
  } else if (deal.amount) {
    amount = Math.abs(deal.amount);
  }

  // detailIdを適切に生成
  const detailIdValue = deal.details && deal.details.length > 0 && deal.details[0].id 
    ? safeBigInt(deal.details[0].id)
    : safeBigInt(deal.id);

  // 取引先名と勘定科目名を取得
  const resolvedPartnerName = deal.partner_name || null;
  const resolvedAccountName = accountItemName;
  
  // タグIDsからタグ名を取得（メモタグの正しい処理）
  let memoTags: string | null = null;
  
  // まずdealレベルのタグを確認
  if (deal.tag_ids && Array.isArray(deal.tag_ids) && deal.tag_ids.length > 0 && tagMap) {
    const tagNames = deal.tag_ids
      .map((tagId: number) => tagMap.get(String(tagId)))
      .filter((tagName: string | undefined) => tagName !== undefined);
    
    if (tagNames.length > 0) {
      memoTags = tagNames.join(', ');
    }
  }
  
  // 明細レベルのタグも確認（freee APIは明細レベルにもタグを持つ場合がある）
  if (!memoTags && deal.details && deal.details.length > 0) {
    const detail = deal.details[0];
    if (detail.tag_ids && Array.isArray(detail.tag_ids) && detail.tag_ids.length > 0 && tagMap) {
      const tagNames = detail.tag_ids
        .map((tagId: number) => tagMap.get(String(tagId)))
        .filter((tagName: string | undefined) => tagName !== undefined);
      
      if (tagNames.length > 0) {
        memoTags = tagNames.join(', ');
      }
    }
  }
  
  return {
    journalNumber: safeBigInt(deal.id),
    journalLineNumber: 1,
    date: new Date(deal.issue_date),
    description: normalizeString(deal.ref_number || description || ''),
    amount: amount,
    account: normalizeString(resolvedAccountName),
    supplier: normalizeString(resolvedPartnerName),
    memo: normalizeString(deal.memo),  // memoはdeal.memoから取得
    tags: normalizeString(memoTags),    // tagsカラムにタグ名を保存
    freeDealId: safeBigInt(deal.id),
    detailId: detailIdValue
  };
}

/**
 * 同期処理の統計情報を生成
 */
export function createSyncResult(stats: {
  selected: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  deletedCount: number;
  errorCount: number;
  errors: unknown[];
}) {
  const resultMessage = `
同期完了:
- 選択: ${stats.selected}件
- 新規作成: ${stats.newCount}件
- 更新: ${stats.updatedCount}件
- スキップ (変更なし): ${stats.skippedCount}件
- 削除: ${stats.deletedCount}件
- エラー: ${stats.errorCount}件
  `.trim();

  return {
    success: true,
    message: resultMessage,
    stats: {
      selected: stats.selected,
      created: stats.newCount,
      updated: stats.updatedCount,
      skipped: stats.skippedCount,
      deleted: stats.deletedCount,
      errors: stats.errorCount
    },
    errors: stats.errors.length > 0 ? stats.errors : undefined
  };
}