/**
 * CSVファイル処理ユーティリティ
 * UTF-8 BOM対応、文字コード自動検出、日本語ファイル名対応
 */

export interface CSVParseOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
  trimFields?: boolean;
}

export interface ParsedCSVData {
  headers: string[];
  rows: string[][];
  rowCount: number;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data: ParsedCSVData | null;
}

/**
 * UTF-8 BOM (0xEF 0xBB 0xBF) を削除
 */
function removeBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

/**
 * 文字コードを自動検出してテキストをデコード
 * 主にShift_JIS、UTF-8、UTF-16に対応
 */
export async function detectEncoding(buffer: ArrayBuffer): Promise<string> {
  // UTF-8 BOMチェック
  const uint8Array = new Uint8Array(buffer);
  if (uint8Array.length >= 3 && 
      uint8Array[0] === 0xEF && 
      uint8Array[1] === 0xBB && 
      uint8Array[2] === 0xBF) {
    return 'utf-8';
  }

  // UTF-16 BOMチェック
  if (uint8Array.length >= 2) {
    if ((uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) ||
        (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF)) {
      return 'utf-16';
    }
  }

  // 簡易的なShift_JISチェック（日本語文字の存在）
  try {
    const utf8Text = new TextDecoder('utf-8').decode(buffer);
    // UTF-8として正常に読める場合
    return 'utf-8';
  } catch {
    // UTF-8で読めない場合はShift_JISを試す
    return 'shift_jis';
  }
}

/**
 * バッファーからテキストを適切なエンコーディングでデコード
 */
export async function decodeText(buffer: ArrayBuffer): Promise<string> {
  const encoding = await detectEncoding(buffer);
  
  try {
    const decoder = new TextDecoder(encoding);
    const text = decoder.decode(buffer);
    return removeBOM(text);
  } catch (error: any) {
    // フォールバック: UTF-8で再試行
    console.warn(`Failed to decode with ${encoding}, falling back to UTF-8`);
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    return removeBOM(text);
  }
}

/**
 * CSV行をパース（引用符とエスケープに対応）
 */
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされた引用符
        current += '"';
        i += 2;
      } else {
        // 引用符の開始/終了
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === delimiter && !inQuotes) {
      // フィールドの区切り
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * CSVテキストをパース
 */
export function parseCSV(
  text: string,
  options: CSVParseOptions = {}
): ParsedCSVData {
  const {
    delimiter = ',',
    skipEmptyLines = true,
    trimFields = true
  } = options;

  const lines = text.split(/\r?\n/);
  const filteredLines = skipEmptyLines 
    ? lines.filter(line => line.trim().length > 0)
    : lines;

  if (filteredLines.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const headers = parseCSVLine(filteredLines[0], delimiter);
  const rows: string[][] = [];

  for (let i = 1; i < filteredLines.length; i++) {
    const row = parseCSVLine(filteredLines[i], delimiter);
    
    // フィールド数を統一（不足分は空文字で補完）
    while (row.length < headers.length) {
      row.push('');
    }
    
    if (trimFields) {
      rows.push(row.map(field => field.trim()));
    } else {
      rows.push(row);
    }
  }

  return {
    headers: trimFields ? headers.map(h => h.trim()) : headers,
    rows,
    rowCount: rows.length
  };
}

/**
 * ファイルからCSVデータを読み取り・パース
 */
export async function processCSVFile(
  file: File,
  options?: CSVParseOptions
): Promise<ParsedCSVData> {
  try {
    const buffer = await file.arrayBuffer();
    const text = await decodeText(buffer);
    return parseCSV(text, options);
  } catch (error: any) {
    throw new Error(`CSVファイルの処理に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 助成金データのバリデーション
 */
export interface GrantCSVRow {
  name: string;
  grantCode?: string;
  totalAmount?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export function validateGrantCSV(data: ParsedCSVData): CSVValidationResult {
  const errors: ValidationError[] = [];
  const requiredFields = ['name'];
  const optionalFields = ['grantCode', 'totalAmount', 'startDate', 'endDate', 'status'];
  
  // ヘッダーチェック
  const hasRequiredHeaders = requiredFields.every(field => 
    data.headers.some(header => 
      header.toLowerCase().includes(field.toLowerCase()) ||
      (field === 'name' && (header.includes('名') || header.includes('助成金')))
    )
  );

  if (!hasRequiredHeaders) {
    errors.push({
      row: 0,
      field: 'headers',
      message: '必須項目が不足しています。助成金名は必須です。'
    });
  }

  // データ行チェック
  data.rows.forEach((row, index) => {
    const rowNum = index + 2; // ヘッダーを考慮して+2
    
    // 助成金名チェック
    const nameIndex = data.headers.findIndex(h => 
      h.toLowerCase().includes('name') || h.includes('名') || h.includes('助成金')
    );
    
    if (nameIndex !== -1 && (!row[nameIndex] || row[nameIndex].trim() === '')) {
      errors.push({
        row: rowNum,
        field: 'name',
        message: '助成金名は必須です',
        value: row[nameIndex]
      });
    }

    // 金額チェック
    const amountIndex = data.headers.findIndex(h => 
      h.toLowerCase().includes('amount') || h.includes('金額') || h.includes('総額')
    );
    
    if (amountIndex !== -1 && row[amountIndex] && row[amountIndex].trim() !== '') {
      const amount = parseInt(row[amountIndex].replace(/[,¥]/g, ''));
      if (isNaN(amount) || amount < 0) {
        errors.push({
          row: rowNum,
          field: 'totalAmount',
          message: '金額は有効な数値で入力してください',
          value: row[amountIndex]
        });
      }
    }

    // 日付チェック
    const startDateIndex = data.headers.findIndex(h => 
      h.toLowerCase().includes('start') || h.includes('開始') || h.includes('開始日')
    );
    
    if (startDateIndex !== -1 && row[startDateIndex] && row[startDateIndex].trim() !== '') {
      const dateValue = row[startDateIndex];
      if (!isValidDateString(dateValue)) {
        errors.push({
          row: rowNum,
          field: 'startDate',
          message: '開始日は有効な日付形式で入力してください（例：2024-01-01）',
          value: dateValue
        });
      }
    }

    const endDateIndex = data.headers.findIndex(h => 
      h.toLowerCase().includes('end') || h.includes('終了') || h.includes('終了日')
    );
    
    if (endDateIndex !== -1 && row[endDateIndex] && row[endDateIndex].trim() !== '') {
      const dateValue = row[endDateIndex];
      if (!isValidDateString(dateValue)) {
        errors.push({
          row: rowNum,
          field: 'endDate',
          message: '終了日は有効な日付形式で入力してください（例：2024-12-31）',
          value: dateValue
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    data
  };
}

/**
 * 予算項目データのバリデーション
 */
export interface BudgetItemCSVRow {
  name: string;
  category?: string;
  budgetedAmount?: number;
  note?: string;
  grantName?: string;
}

export function validateBudgetItemCSV(data: ParsedCSVData): CSVValidationResult {
  const errors: ValidationError[] = [];
  const requiredFields = ['name'];
  
  // ヘッダーチェック
  const hasRequiredHeaders = requiredFields.every(field => 
    data.headers.some(header => 
      header.toLowerCase().includes(field.toLowerCase()) ||
      (field === 'name' && (header.includes('名') || header.includes('項目')))
    )
  );

  if (!hasRequiredHeaders) {
    errors.push({
      row: 0,
      field: 'headers',
      message: '必須項目が不足しています。項目名は必須です。'
    });
  }

  // データ行チェック
  data.rows.forEach((row, index) => {
    const rowNum = index + 2;
    
    // 項目名チェック
    const nameIndex = data.headers.findIndex(h => 
      h.toLowerCase().includes('name') || h.includes('名') || h.includes('項目')
    );
    
    if (nameIndex !== -1 && (!row[nameIndex] || row[nameIndex].trim() === '')) {
      errors.push({
        row: rowNum,
        field: 'name',
        message: '項目名は必須です',
        value: row[nameIndex]
      });
    }

    // 予算額チェック
    const budgetIndex = data.headers.findIndex(h => 
      h.toLowerCase().includes('budget') || 
      h.toLowerCase().includes('amount') || 
      h.includes('予算') || 
      h.includes('金額')
    );
    
    if (budgetIndex !== -1 && row[budgetIndex] && row[budgetIndex].trim() !== '') {
      const amount = parseInt(row[budgetIndex].replace(/[,¥]/g, ''));
      if (isNaN(amount) || amount < 0) {
        errors.push({
          row: rowNum,
          field: 'budgetedAmount',
          message: '予算額は有効な数値で入力してください',
          value: row[budgetIndex]
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    data
  };
}

/**
 * 日付文字列の有効性チェック
 */
function isValidDateString(dateStr: string): boolean {
  // 日本語形式も含めて様々な日付形式をサポート
  const dateFormats = [
    /^\d{4}-\d{2}-\d{2}$/,           // 2024-01-01
    /^\d{4}\/\d{1,2}\/\d{1,2}$/,    // 2024/1/1 or 2024/01/01
    /^\d{4}年\d{1,2}月\d{1,2}日$/,   // 2024年1月1日
  ];

  if (!dateFormats.some(format => format.test(dateStr))) {
    return false;
  }

  // 実際の日付として有効かチェック
  const date = new Date(dateStr.replace(/年|月|日/g, '').replace(/\//g, '-'));
  return !isNaN(date.getTime());
}

/**
 * CSVデータを助成金オブジェクトに変換
 */
export function convertToGrantObjects(data: ParsedCSVData): GrantCSVRow[] {
  const nameIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('name') || h.includes('名') || h.includes('助成金')
  );
  const codeIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('code') || h.includes('コード')
  );
  const amountIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('amount') || h.includes('金額') || h.includes('総額')
  );
  const startDateIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('start') || h.includes('開始')
  );
  const endDateIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('end') || h.includes('終了')
  );
  const statusIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('status') || h.includes('状態')
  );

  return data.rows.map(row => {
    const grant: GrantCSVRow = {
      name: row[nameIndex]?.trim() || ''
    };

    if (codeIndex !== -1 && row[codeIndex]) {
      grant.grantCode = row[codeIndex].trim();
    }

    if (amountIndex !== -1 && row[amountIndex]) {
      const amount = parseInt(row[amountIndex].replace(/[,¥]/g, ''));
      if (!isNaN(amount)) {
        grant.totalAmount = amount;
      }
    }

    if (startDateIndex !== -1 && row[startDateIndex]) {
      grant.startDate = row[startDateIndex].trim();
    }

    if (endDateIndex !== -1 && row[endDateIndex]) {
      grant.endDate = row[endDateIndex].trim();
    }

    if (statusIndex !== -1 && row[statusIndex]) {
      grant.status = row[statusIndex].trim();
    }

    return grant;
  });
}

/**
 * CSVデータを予算項目オブジェクトに変換
 */
export function convertToBudgetItemObjects(data: ParsedCSVData): BudgetItemCSVRow[] {
  const nameIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('name') || h.includes('名') || h.includes('項目')
  );
  const categoryIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('category') || h.includes('カテゴリ')
  );
  const budgetIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('budget') || 
    h.toLowerCase().includes('amount') || 
    h.includes('予算') || 
    h.includes('金額')
  );
  const noteIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('note') || h.includes('備考') || h.includes('メモ')
  );
  const grantIndex = data.headers.findIndex(h => 
    h.toLowerCase().includes('grant') || h.includes('助成金')
  );

  return data.rows.map(row => {
    const budgetItem: BudgetItemCSVRow = {
      name: row[nameIndex]?.trim() || ''
    };

    if (categoryIndex !== -1 && row[categoryIndex]) {
      budgetItem.category = row[categoryIndex].trim();
    }

    if (budgetIndex !== -1 && row[budgetIndex]) {
      const amount = parseInt(row[budgetIndex].replace(/[,¥]/g, ''));
      if (!isNaN(amount)) {
        budgetItem.budgetedAmount = amount;
      }
    }

    if (noteIndex !== -1 && row[noteIndex]) {
      budgetItem.note = row[noteIndex].trim();
    }

    if (grantIndex !== -1 && row[grantIndex]) {
      budgetItem.grantName = row[grantIndex].trim();
    }

    return budgetItem;
  });
}