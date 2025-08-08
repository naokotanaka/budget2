// CSVパーサーユーティリティ

export interface CSVParseResult<T = any> {
  success: boolean;
  data: T[];
  errors: string[];
  headers: string[];
}

export interface GrantCSVData {
  name: string;
  grantCode?: string;
  totalAmount?: number;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'applied';
}

export interface BudgetItemCSVData {
  grantId?: number;
  grantCode?: string;
  name: string;
  category?: string;
  budgetedAmount?: number;
  note?: string;
}

/**
 * CSVファイルを読み込んでパースする
 */
export async function parseCSVFile<T = any>(file: File, type: 'grants' | 'budgetItems'): Promise<CSVParseResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseCSVText<T>(text, type);
        resolve(result);
      } catch (error) {
        resolve({
          success: false,
          data: [],
          errors: [error instanceof Error ? error.message : 'ファイル読み込みエラー'],
          headers: []
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        success: false,
        data: [],
        errors: ['ファイル読み込みに失敗しました'],
        headers: []
      });
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * CSV文字列をパースする
 */
export function parseCSVText<T = any>(text: string, type: 'grants' | 'budgetItems'): CSVParseResult<T> {
  const errors: string[] = [];
  const lines = text.split(/\r\n|\r|\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return {
      success: false,
      data: [],
      errors: ['CSVファイルが空です'],
      headers: []
    };
  }
  
  // ヘッダー行を解析
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  if (headers.length === 0) {
    return {
      success: false,
      data: [],
      errors: ['ヘッダー行が見つかりません'],
      headers: []
    };
  }
  
  // データ行を解析
  const data: T[] = [];
  const dataLines = lines.slice(1);
  
  for (let i = 0; i < dataLines.length; i++) {
    const lineNumber = i + 2; // ヘッダー行を考慮して+2
    const line = dataLines[i];
    
    if (line.trim() === '') continue; // 空行をスキップ
    
    const columns = parseCSVLine(line);
    
    try {
      let parsedData: any;
      
      if (type === 'grants') {
        parsedData = parseGrantRow(columns, headers, lineNumber);
      } else if (type === 'budgetItems') {
        parsedData = parseBudgetItemRow(columns, headers, lineNumber);
      } else {
        throw new Error(`サポートされていないタイプ: ${type}`);
      }
      
      if (parsedData) {
        data.push(parsedData as T);
      }
      
    } catch (error) {
      errors.push(`行${lineNumber}: ${error instanceof Error ? error.message : '解析エラー'}`);
    }
  }
  
  return {
    success: errors.length === 0,
    data,
    errors,
    headers
  };
}

/**
 * CSV行を解析（カンマ区切り、ダブルクォート対応）
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされたクォート
        current += '"';
        i += 2;
        continue;
      } else {
        // クォートの開始/終了
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }
    
    if (char === ',' && !inQuotes) {
      // フィールドの終了
      result.push(current.trim());
      current = '';
      i++;
      continue;
    }
    
    current += char;
    i++;
  }
  
  // 最後のフィールドを追加
  result.push(current.trim());
  
  return result;
}

/**
 * 助成金CSVの行をパースする
 */
function parseGrantRow(columns: string[], headers: string[], lineNumber: number): GrantCSVData | null {
  const expectedHeaders = ['名称', '助成金コード', '総額', '開始日', '終了日', 'ステータス'];
  
  // 最低限必要な列数チェック
  if (columns.length < 1) {
    throw new Error('列数が不足しています');
  }
  
  // ヘッダーマッピング
  const getColumnIndex = (targetHeaders: string[]) => {
    for (const target of targetHeaders) {
      const index = headers.findIndex(h => h.includes(target) || target.includes(h));
      if (index !== -1) return index;
    }
    return -1;
  };
  
  const nameIndex = getColumnIndex(['名称', '助成金名', 'name']);
  const codeIndex = getColumnIndex(['助成金コード', 'コード', 'code']);
  const amountIndex = getColumnIndex(['総額', '金額', 'amount']);
  const startDateIndex = getColumnIndex(['開始日', 'start']);
  const endDateIndex = getColumnIndex(['終了日', 'end']);
  const statusIndex = getColumnIndex(['ステータス', '状態', 'status']);
  
  if (nameIndex === -1 || !columns[nameIndex] || columns[nameIndex].trim() === '') {
    throw new Error('助成金名は必須です');
  }
  
  // 日付形式の正規化
  const normalizeDate = (dateStr: string): string | undefined => {
    if (!dateStr || dateStr.trim() === '') return undefined;
    
    // 2025/7/28 → 2025-07-28 形式に変換
    const slashMatch = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (slashMatch) {
      const [, year, month, day] = slashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // 既にYYYY-MM-DD形式の場合はそのまま
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    return dateStr; // その他の形式はそのまま（バリデーションでエラーになる）
  };
  
  // ステータスの正規化
  const normalizeStatus = (statusStr: string): 'active' | 'completed' | 'applied' => {
    if (!statusStr || statusStr.trim() === '') return 'active';
    
    const status = statusStr.trim().toLowerCase();
    if (status.includes('完了') || status.includes('終了') || status === 'completed') {
      return 'completed';
    } else if (status.includes('申請') || status.includes('applied')) {
      return 'applied';
    }
    return 'active';
  };
  
  const result: GrantCSVData = {
    name: columns[nameIndex].trim(),
    grantCode: codeIndex !== -1 && columns[codeIndex] ? columns[codeIndex].trim() : undefined,
    totalAmount: amountIndex !== -1 && columns[amountIndex] ? parseAmount(columns[amountIndex]) : undefined,
    startDate: startDateIndex !== -1 ? normalizeDate(columns[startDateIndex]) : undefined,
    endDate: endDateIndex !== -1 ? normalizeDate(columns[endDateIndex]) : undefined,
    status: statusIndex !== -1 ? normalizeStatus(columns[statusIndex]) : 'active'
  };
  
  return result;
}

/**
 * 予算項目CSVの行をパースする
 */
function parseBudgetItemRow(columns: string[], headers: string[], lineNumber: number): BudgetItemCSVData | null {
  // 最低限必要な列数チェック
  if (columns.length < 2) {
    throw new Error('列数が不足しています');
  }
  
  // ヘッダーマッピング
  const getColumnIndex = (targetHeaders: string[]) => {
    for (const target of targetHeaders) {
      const index = headers.findIndex(h => h.includes(target) || target.includes(h));
      if (index !== -1) return index;
    }
    return -1;
  };
  
  const grantIdIndex = getColumnIndex(['助成金ID', 'ID']);
  const grantCodeIndex = getColumnIndex(['助成金コード', 'コード']);
  const nameIndex = getColumnIndex(['名称', '予算項目名', 'name']);
  const categoryIndex = getColumnIndex(['カテゴリ', 'category']);
  const amountIndex = getColumnIndex(['予算額', '金額', 'amount']);
  const noteIndex = getColumnIndex(['備考', 'メモ', 'note']);
  
  if (nameIndex === -1 || !columns[nameIndex] || columns[nameIndex].trim() === '') {
    throw new Error('予算項目名は必須です');
  }
  
  if (grantIdIndex === -1 && grantCodeIndex === -1) {
    throw new Error('助成金IDまたは助成金コードは必須です');
  }
  
  const result: BudgetItemCSVData = {
    grantId: grantIdIndex !== -1 && columns[grantIdIndex] ? parseInt(columns[grantIdIndex]) : undefined,
    grantCode: grantCodeIndex !== -1 && columns[grantCodeIndex] ? columns[grantCodeIndex].trim() : undefined,
    name: columns[nameIndex].trim(),
    category: categoryIndex !== -1 && columns[categoryIndex] ? columns[categoryIndex].trim() : undefined,
    budgetedAmount: amountIndex !== -1 && columns[amountIndex] ? parseAmount(columns[amountIndex]) : undefined,
    note: noteIndex !== -1 && columns[noteIndex] ? columns[noteIndex].trim() : undefined
  };
  
  return result;
}

/**
 * 金額文字列を数値に変換
 */
function parseAmount(amountStr: string): number | undefined {
  if (!amountStr || amountStr.trim() === '') return undefined;
  
  // カンマと全角数字を除去して数値変換
  const cleanAmount = amountStr.replace(/[,，]/g, '').replace(/[０-９]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
  
  const amount = parseFloat(cleanAmount);
  return isNaN(amount) ? undefined : Math.floor(amount);
}

/**
 * CSVのサンプルデータを生成
 */
export function generateSampleCSV(type: 'grants' | 'budgetItems'): string {
  if (type === 'grants') {
    return [
      '名称,助成金コード,総額,開始日,終了日,ステータス',
      'WAM補助金,WAM2025,7000000,2025-04-01,2026-03-31,active',
      'つながり10,TSUNAGARI10,305213,2025-04-01,2026-03-31,active',
      'POPOLO,POPOLO,3183200,2025-04-01,2026-03-31,active'
    ].join('\n');
  } else {
    return [
      '助成金コード,名称,カテゴリ,予算額,備考',
      'WAM2025,消耗品費,消耗,508000,',
      'WAM2025,家賃,家賃,1141200,',
      'POPOLO,生活必需品・学用品,消耗,310500,',
      'POPOLO,人件費,賃金,360000,'
    ].join('\n');
  }
}