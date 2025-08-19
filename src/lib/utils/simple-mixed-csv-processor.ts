/**
 * 簡素化された混在CSVデータ処理ユーティリティ
 * シンプルなフィールド存在チェックベースの分類
 */

import { 
  processCSVFile, 
  type ParsedCSVData, 
  type GrantCSVRow, 
  type BudgetItemCSVRow,
  type ValidationError,
  convertToGrantObjects,
  convertToBudgetItemObjects
} from './csv-processor';

export interface SimpleMixedCSVData {
  grants: GrantCSVRow[];
  budgetItems: BudgetItemCSVRow[];
  ambiguousRows: string[][];
}

export interface SimpleMixedCSVResult {
  isValid: boolean;
  errors: ValidationError[];
  data: SimpleMixedCSVData | null;
  summary: {
    grantsFound: number;
    budgetItemsFound: number;
    ambiguousRows: number;
    totalRows: number;
  };
  debugInfo?: {
    classifications: Array<{
      rowIndex: number;
      data: string[];
      classification: 'grant' | 'budget-item' | 'ambiguous';
      reason: string;
    }>;
  };
}

/**
 * シンプルな分類ロジック
 */
export function classifyRow(row: string[], headers: string[]): { 
  type: 'grant' | 'budget-item' | 'ambiguous'; 
  reason: string; 
} {
  const grantCodeIndex = headers.indexOf('grantCode');
  const startDateIndex = headers.indexOf('startDate');
  const endDateIndex = headers.indexOf('endDate');
  const categoryIndex = headers.indexOf('category');
  const noteIndex = headers.indexOf('note');
  const budgetAmountIndex = headers.indexOf('budgetedAmount');
  
  // 助成金判定条件
  const hasGrantCode = grantCodeIndex >= 0 && row[grantCodeIndex]?.trim();
  const hasDates = startDateIndex >= 0 && endDateIndex >= 0 && 
                   row[startDateIndex]?.trim() && row[endDateIndex]?.trim();
  
  // 予算項目判定条件
  const hasCategory = categoryIndex >= 0 && row[categoryIndex]?.trim();
  const hasNote = noteIndex >= 0 && row[noteIndex]?.trim();
  const hasBudgetAmount = budgetAmountIndex >= 0 && row[budgetAmountIndex]?.trim();
  
  const isGrant = hasGrantCode || hasDates;
  const isBudgetItem = hasCategory || hasNote || hasBudgetAmount;
  
  // 分類決定
  if (isGrant && !isBudgetItem) {
    const reasons = [];
    if (hasGrantCode) reasons.push('助成金コードあり');
    if (hasDates) reasons.push('開始・終了日あり');
    return { type: 'grant', reason: reasons.join(', ') };
  }
  
  if (isBudgetItem && !isGrant) {
    const reasons = [];
    if (hasCategory) reasons.push('カテゴリあり');
    if (hasNote) reasons.push('備考あり');
    if (hasBudgetAmount) reasons.push('予算額あり');
    return { type: 'budget-item', reason: reasons.join(', ') };
  }
  
  // 両方の条件を満たすか、どちらも満たさない場合
  if (isGrant && isBudgetItem) {
    return { type: 'ambiguous', reason: '助成金・予算項目両方の条件に該当' };
  }
  
  return { type: 'ambiguous', reason: 'どの分類条件も満たさない' };
}

/**
 * 混在CSVファイルを処理（簡素版）
 */
export async function processSimpleMixedCSVFile(
  file: File,
  includeDebugInfo = false
): Promise<SimpleMixedCSVResult> {
  try {
    const parsedData = await processCSVFile(file);
    return processSimpleMixedCSVData(parsedData, includeDebugInfo);
  } catch (error: any) {
    return {
      isValid: false,
      errors: [{
        row: 0,
        field: 'file',
        message: `ファイル処理エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      data: null,
      summary: {
        grantsFound: 0,
        budgetItemsFound: 0,
        ambiguousRows: 0,
        totalRows: 0
      }
    };
  }
}

/**
 * パース済みCSVデータを処理（簡素版）
 */
export function processSimpleMixedCSVData(
  parsedData: ParsedCSVData,
  includeDebugInfo = false
): SimpleMixedCSVResult {
  const errors: ValidationError[] = [];
  const grantRows: string[][] = [];
  const budgetItemRows: string[][] = [];
  const ambiguousRows: string[][] = [];
  const debugInfo: Array<{
    rowIndex: number;
    data: string[];
    classification: 'grant' | 'budget-item' | 'ambiguous';
    reason: string;
  }> = [];
  
  // 各行を分類
  parsedData.rows.forEach((row, index) => {
    const classification = classifyRow(row, parsedData.headers);
    
    if (includeDebugInfo) {
      debugInfo.push({
        rowIndex: index + 2, // ヘッダー考慮
        data: row.slice(0, 3), // 最初の3列のみ
        classification: classification.type,
        reason: classification.reason
      });
    }
    
    switch (classification.type) {
      case 'grant':
        grantRows.push(row);
        break;
      case 'budget-item':
        budgetItemRows.push(row);
        break;
      case 'ambiguous':
        ambiguousRows.push(row);
        errors.push({
          row: index + 2,
          field: 'classification',
          message: `データタイプを判定できませんでした: ${classification.reason}`
        });
        break;
    }
  });
  
  // 分類されたデータを変換
  let grants: GrantCSVRow[] = [];
  let budgetItems: BudgetItemCSVRow[] = [];
  
  if (grantRows.length > 0) {
    const grantData: ParsedCSVData = {
      headers: parsedData.headers,
      rows: grantRows,
      rowCount: grantRows.length
    };
    grants = convertToGrantObjects(grantData);
  }
  
  if (budgetItemRows.length > 0) {
    const budgetItemData: ParsedCSVData = {
      headers: parsedData.headers,
      rows: budgetItemRows,
      rowCount: budgetItemRows.length
    };
    budgetItems = convertToBudgetItemObjects(budgetItemData);
  }
  
  const result: SimpleMixedCSVResult = {
    isValid: errors.filter(e => e.field !== 'classification').length === 0,
    errors,
    data: {
      grants,
      budgetItems,
      ambiguousRows
    },
    summary: {
      grantsFound: grants.length,
      budgetItemsFound: budgetItems.length,
      ambiguousRows: ambiguousRows.length,
      totalRows: parsedData.rowCount
    }
  };
  
  if (includeDebugInfo) {
    result.debugInfo = { classifications: debugInfo };
  }
  
  return result;
}

/**
 * 分類統計の表示用文字列を生成
 */
export function generateClassificationSummary(result: SimpleMixedCSVResult): string {
  if (!result.data) {
    return 'データの処理に失敗しました';
  }
  
  const { summary } = result;
  
  let text = `総行数: ${summary.totalRows}件\n`;
  text += `助成金データ: ${summary.grantsFound}件\n`;
  text += `予算項目データ: ${summary.budgetItemsFound}件\n`;
  
  if (summary.ambiguousRows > 0) {
    text += `判定不明: ${summary.ambiguousRows}件\n`;
  }
  
  const successRate = ((summary.grantsFound + summary.budgetItemsFound) / summary.totalRows * 100).toFixed(1);
  text += `分類成功率: ${successRate}%`;
  
  return text;
}