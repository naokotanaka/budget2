/**
 * 混在CSVデータ処理ユーティリティ
 * 助成金と予算項目が同一ファイルに混在するCSVを処理
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

export interface MixedCSVData {
  grants: GrantCSVRow[];
  budgetItems: BudgetItemCSVRow[];
  unmatchedRows: string[][];
}

export interface MixedCSVValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data: MixedCSVData | null;
  summary: {
    grantsFound: number;
    budgetItemsFound: number;
    unmatchedRows: number;
    totalRows: number;
  };
}

export interface DataTypeHeuristics {
  isGrantRow: (row: string[], headers: string[]) => boolean;
  isBudgetItemRow: (row: string[], headers: string[]) => boolean;
  getConfidence: (row: string[], headers: string[]) => {
    grant: number;
    budgetItem: number;
  };
}

/**
 * データタイプ判定のヒューリスティクス
 */
export function createDataTypeHeuristics(): DataTypeHeuristics {
  
  // 助成金らしいキーワード
  const grantKeywords = ['助成金', 'grant', '総額', 'totalAmount', '開始日', 'startDate', '終了日', 'endDate'];
  
  // 予算項目らしいキーワード  
  const budgetItemKeywords = ['項目', 'item', '予算額', 'budgetedAmount', 'カテゴリ', 'category', '備考', 'note'];

  return {
    isGrantRow: (row: string[], headers: string[]) => {
      const confidence = getRowConfidence(row, headers, grantKeywords, budgetItemKeywords);
      return confidence.grant > confidence.budgetItem && confidence.grant > 0.3;
    },

    isBudgetItemRow: (row: string[], headers: string[]) => {
      const confidence = getRowConfidence(row, headers, grantKeywords, budgetItemKeywords);
      return confidence.budgetItem > confidence.grant && confidence.budgetItem > 0.3;
    },

    getConfidence: (row: string[], headers: string[]) => {
      return getRowConfidence(row, headers, grantKeywords, budgetItemKeywords);
    }
  };
}

/**
 * 行の信頼度を計算
 */
function getRowConfidence(
  row: string[], 
  headers: string[], 
  grantKeywords: string[], 
  budgetItemKeywords: string[]
): { grant: number; budgetItem: number } {
  let grantScore = 0;
  let budgetItemScore = 0;

  // ヘッダーベースのスコア
  headers.forEach((header, index) => {
    const value = row[index]?.trim() || '';
    if (!value) return;

    const headerLower = header.toLowerCase();
    
    // 助成金スコア
    if (grantKeywords.some(keyword => 
      headerLower.includes(keyword.toLowerCase()) || header.includes(keyword)
    )) {
      grantScore += 0.3;
      
      // 総額や日付フィールドに値があれば追加スコア
      if (header.includes('総額') || header.includes('金額')) {
        const amount = parseInt(value.replace(/[,¥]/g, ''));
        if (!isNaN(amount) && amount > 100000) { // 大きな金額は助成金らしい
          grantScore += 0.4;
        }
      }
    }
    
    // 予算項目スコア
    if (budgetItemKeywords.some(keyword => 
      headerLower.includes(keyword.toLowerCase()) || header.includes(keyword)
    )) {
      budgetItemScore += 0.3;
      
      // カテゴリフィールドで一般的な予算項目カテゴリ
      if (header.includes('カテゴリ') && 
          ['消耗', '賃金', '旅費', '通信', '委託', '備品'].some(cat => value.includes(cat))) {
        budgetItemScore += 0.4;
      }
    }
  });

  // データ内容ベースのスコア
  const dataText = row.join(' ').toLowerCase();
  
  // 助成金らしいパターン
  if (/^\d{6}_/.test(dataText)) { // 助成金コードパターン
    grantScore += 0.2;
  }
  if (dataText.includes('active') || dataText.includes('completed') || dataText.includes('進行中')) {
    grantScore += 0.3;
  }
  
  // 予算項目らしいパターン
  if (['消耗品', '人件費', '旅費交通費', '通信運搬費'].some(cat => dataText.includes(cat))) {
    budgetItemScore += 0.4;
  }

  return {
    grant: Math.min(grantScore, 1.0),
    budgetItem: Math.min(budgetItemScore, 1.0)
  };
}

/**
 * 混在CSVファイルを処理
 */
export async function processMixedCSVFile(file: File): Promise<MixedCSVValidationResult> {
  try {
    const parsedData = await processCSVFile(file);
    return processMixedCSVData(parsedData);
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
        unmatchedRows: 0,
        totalRows: 0
      }
    };
  }
}

/**
 * パース済みCSVデータを混在データとして処理
 */
export function processMixedCSVData(parsedData: ParsedCSVData): MixedCSVValidationResult {
  const heuristics = createDataTypeHeuristics();
  const errors: ValidationError[] = [];
  
  const grantRows: string[][] = [];
  const budgetItemRows: string[][] = [];
  const unmatchedRows: string[][] = [];

  // 各行を分類
  parsedData.rows.forEach((row, index) => {
    const confidence = heuristics.getConfidence(row, parsedData.headers);
    
    // デバッグ情報をコンソールに出力
    console.log(`Row ${index + 2}: Grant=${confidence.grant.toFixed(2)}, BudgetItem=${confidence.budgetItem.toFixed(2)}`, row.slice(0, 3));
    
    if (confidence.grant > confidence.budgetItem && confidence.grant > 0.3) {
      grantRows.push(row);
    } else if (confidence.budgetItem > confidence.grant && confidence.budgetItem > 0.3) {
      budgetItemRows.push(row);
    } else {
      unmatchedRows.push(row);
      
      // 判定できない行はwarningレベルのエラーとして記録
      errors.push({
        row: index + 2,
        field: 'classification',
        message: `データタイプを判定できませんでした（Grant: ${confidence.grant.toFixed(2)}, BudgetItem: ${confidence.budgetItem.toFixed(2)}）`
      });
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

  const result: MixedCSVValidationResult = {
    isValid: errors.filter(e => e.field !== 'classification').length === 0,
    errors,
    data: {
      grants,
      budgetItems,
      unmatchedRows
    },
    summary: {
      grantsFound: grants.length,
      budgetItemsFound: budgetItems.length,
      unmatchedRows: unmatchedRows.length,
      totalRows: parsedData.rowCount
    }
  };

  return result;
}

/**
 * ヘッダーから予想されるデータタイプを判定
 */
export function predictDataTypeFromHeaders(headers: string[]): 'grants' | 'budget-items' | 'mixed' | 'unknown' {
  const headerText = headers.join(' ').toLowerCase();
  
  const hasGrantHeaders = headers.some(h => 
    h.includes('助成金') || 
    h.includes('総額') || 
    h.includes('開始日') || 
    h.includes('終了日') ||
    h.toLowerCase().includes('grant')
  );
  
  const hasBudgetItemHeaders = headers.some(h => 
    h.includes('項目') || 
    h.includes('予算額') || 
    h.includes('カテゴリ') ||
    h.toLowerCase().includes('budget')
  );

  if (hasGrantHeaders && hasBudgetItemHeaders) {
    return 'mixed';
  } else if (hasGrantHeaders) {
    return 'grants';
  } else if (hasBudgetItemHeaders) {
    return 'budget-items';
  } else {
    return 'unknown';
  }
}

/**
 * 混在データのサマリーを生成
 */
export function generateMixedDataSummary(result: MixedCSVValidationResult): string {
  if (!result.data) {
    return 'データの処理に失敗しました';
  }

  const { summary } = result;
  
  let summaryText = `総行数: ${summary.totalRows}件\n`;
  summaryText += `助成金データ: ${summary.grantsFound}件\n`;
  summaryText += `予算項目データ: ${summary.budgetItemsFound}件\n`;
  
  if (summary.unmatchedRows > 0) {
    summaryText += `判定不明: ${summary.unmatchedRows}件\n`;
  }
  
  return summaryText;
}