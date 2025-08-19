/**
 * レガシーnagaiku-budgetシステムのCSVパーサー
 * セクション形式（[助成金データ], [予算項目データ], [割当データ]）のCSVファイルを解析
 */

import type {
  LegacyCSVFile,
  LegacyGrantData,
  LegacyBudgetItemData,
  LegacyAllocationData,
  CSVSection,
  ParseError,
  SECTION_HEADERS
} from '../types/legacy-csv.js';

export class LegacyCSVParser {
  private lines: string[] = [];
  private currentLine = 0;
  private errors: ParseError[] = [];
  private warnings: string[] = [];

  /**
   * レガシーCSVファイルをパースする
   */
  async parseCSV(csvContent: string): Promise<LegacyCSVFile> {
    this.reset();
    
    // BOM除去とライン分割
    const cleanContent = csvContent.replace(/^\uFEFF/, '');
    this.lines = cleanContent.split(/\r?\n/).map(line => line.trim());

    try {
      // セクションを識別
      const sections = this.identifySections();
      
      // 各セクションをパース
      const grants = this.parseGrantsSection(sections.grants);
      const budgetItems = this.parseBudgetItemsSection(sections.budgetItems);
      const allocations = this.parseAllocationsSection(sections.allocations);

      return {
        grants,
        budgetItems,
        allocations,
        parseErrors: this.errors,
        warnings: this.warnings
      };
    } catch (error: any) {
      this.addError('general', this.currentLine, `CSVパース中にエラーが発生しました: ${error}`);
      return {
        grants: [],
        budgetItems: [],
        allocations: [],
        parseErrors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * CSVファイル内のセクションを識別
   */
  private identifySections(): { grants?: CSVSection; budgetItems?: CSVSection; allocations?: CSVSection } {
    const sections: { grants?: CSVSection; budgetItems?: CSVSection; allocations?: CSVSection } = {};
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      
      if (line === '[助成金データ]') {
        sections.grants = this.extractSection(i, '[助成金データ]');
      } else if (line === '[予算項目データ]') {
        sections.budgetItems = this.extractSection(i, '[予算項目データ]');
      } else if (line === '[割当データ]') {
        sections.allocations = this.extractSection(i, '[割当データ]');
      }
    }

    // 必須セクションの存在チェック
    if (!sections.grants) {
      this.addWarning('助成金データセクション [助成金データ] が見つかりません');
    }
    if (!sections.budgetItems) {
      this.addWarning('予算項目データセクション [予算項目データ] が見つかりません');
    }
    if (!sections.allocations) {
      this.addWarning('割当データセクション [割当データ] が見つかりません');
    }

    return sections;
  }

  /**
   * 指定されたセクションのデータを抽出
   */
  private extractSection(startLine: number, sectionName: string): CSVSection {
    const headerLine = startLine + 1;
    let endLine = this.lines.length;
    
    // 次のセクションまたは空行を見つける
    for (let i = headerLine + 1; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (line.startsWith('[') && line.endsWith(']')) {
        endLine = i;
        break;
      }
      if (line === '' && this.isEndOfSection(i)) {
        endLine = i;
        break;
      }
    }

    // ヘッダー行を取得
    const headers = headerLine < this.lines.length ? 
      this.parseCsvLine(this.lines[headerLine]) : [];

    // データ行を取得
    const data: string[][] = [];
    for (let i = headerLine + 1; i < endLine; i++) {
      const line = this.lines[i];
      if (line.trim() !== '') {
        data.push(this.parseCsvLine(line));
      }
    }

    return {
      name: sectionName,
      startLine,
      endLine,
      headers,
      data
    };
  }

  /**
   * セクションの終了を判定
   */
  private isEndOfSection(lineIndex: number): boolean {
    // 現在行とその後数行が空行の場合、セクション終了とみなす
    for (let i = lineIndex; i < Math.min(lineIndex + 3, this.lines.length); i++) {
      if (this.lines[i].trim() !== '') {
        return false;
      }
    }
    return true;
  }

  /**
   * CSVラインをパース（簡単な実装）
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i-1] === ',')) {
        inQuotes = true;
      } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * 助成金データセクションをパース
   */
  private parseGrantsSection(section?: CSVSection): LegacyGrantData[] {
    if (!section) {
      return [];
    }

    const expectedHeaders = ['ID', '名称', '総額', '開始日', '終了日', 'ステータス'];
    const grants: LegacyGrantData[] = [];

    // ヘッダー検証
    if (!this.validateHeaders(section.headers, expectedHeaders, '助成金データ')) {
      return grants;
    }

    // データ行を処理
    section.data.forEach((row, index) => {
      const lineNumber = section.startLine + 2 + index; // セクション名+ヘッダー+データ行番号
      
      try {
        if (row.length !== expectedHeaders.length) {
          this.addError('助成金データ', lineNumber, 
            `列数が不正です。期待値: ${expectedHeaders.length}, 実際: ${row.length}`);
          return;
        }

        const grant: LegacyGrantData = {
          ID: row[0] || '',
          名称: row[1] || '',
          総額: row[2] || '',
          開始日: row[3] || '',
          終了日: row[4] || '',
          ステータス: row[5] || ''
        };

        // 基本的な検証
        if (!grant.ID) {
          this.addError('助成金データ', lineNumber, 'IDが空です');
        }
        if (!grant.名称) {
          this.addError('助成金データ', lineNumber, '名称が空です');
        }

        grants.push(grant);
      } catch (error: any) {
        this.addError('助成金データ', lineNumber, `行の処理中にエラー: ${error}`);
      }
    });

    return grants;
  }

  /**
   * 予算項目データセクションをパース
   */
  private parseBudgetItemsSection(section?: CSVSection): LegacyBudgetItemData[] {
    if (!section) {
      return [];
    }

    const expectedHeaders = ['ID', '助成金ID', '名称', 'カテゴリ', '予算額'];
    const budgetItems: LegacyBudgetItemData[] = [];

    // ヘッダー検証
    if (!this.validateHeaders(section.headers, expectedHeaders, '予算項目データ')) {
      return budgetItems;
    }

    // データ行を処理
    section.data.forEach((row, index) => {
      const lineNumber = section.startLine + 2 + index;
      
      try {
        if (row.length !== expectedHeaders.length) {
          this.addError('予算項目データ', lineNumber,
            `列数が不正です。期待値: ${expectedHeaders.length}, 実際: ${row.length}`);
          return;
        }

        const budgetItem: LegacyBudgetItemData = {
          ID: row[0] || '',
          助成金ID: row[1] || '',
          名称: row[2] || '',
          カテゴリ: row[3] || '',
          予算額: row[4] || ''
        };

        // 基本的な検証
        if (!budgetItem.ID) {
          this.addError('予算項目データ', lineNumber, 'IDが空です');
        }
        if (!budgetItem.助成金ID) {
          this.addError('予算項目データ', lineNumber, '助成金IDが空です');
        }
        if (!budgetItem.名称) {
          this.addError('予算項目データ', lineNumber, '名称が空です');
        }

        budgetItems.push(budgetItem);
      } catch (error: any) {
        this.addError('予算項目データ', lineNumber, `行の処理中にエラー: ${error}`);
      }
    });

    return budgetItems;
  }

  /**
   * 割当データセクションをパース
   */
  private parseAllocationsSection(section?: CSVSection): LegacyAllocationData[] {
    if (!section) {
      return [];
    }

    const expectedHeaders = ['ID', '取引ID', '予算項目ID', '金額'];
    const allocations: LegacyAllocationData[] = [];

    // ヘッダー検証
    if (!this.validateHeaders(section.headers, expectedHeaders, '割当データ')) {
      return allocations;
    }

    // データ行を処理
    section.data.forEach((row, index) => {
      const lineNumber = section.startLine + 2 + index;
      
      try {
        if (row.length !== expectedHeaders.length) {
          this.addError('割当データ', lineNumber,
            `列数が不正です。期待値: ${expectedHeaders.length}, 実際: ${row.length}`);
          return;
        }

        const allocation: LegacyAllocationData = {
          ID: row[0] || '',
          取引ID: row[1] || '',
          予算項目ID: row[2] || '',
          金額: row[3] || ''
        };

        // 基本的な検証
        if (!allocation.ID) {
          this.addError('割当データ', lineNumber, 'IDが空です');
        }
        if (!allocation.取引ID) {
          this.addError('割当データ', lineNumber, '取引IDが空です');
        }
        if (!allocation.予算項目ID) {
          this.addError('割当データ', lineNumber, '予算項目IDが空です');
        }

        allocations.push(allocation);
      } catch (error: any) {
        this.addError('割当データ', lineNumber, `行の処理中にエラー: ${error}`);
      }
    });

    return allocations;
  }

  /**
   * ヘッダーの検証
   */
  private validateHeaders(actualHeaders: string[], expectedHeaders: string[], sectionName: string): boolean {
    if (actualHeaders.length !== expectedHeaders.length) {
      this.addError(sectionName, this.currentLine,
        `ヘッダー数が不正です。期待値: ${expectedHeaders.length}, 実際: ${actualHeaders.length}`);
      return false;
    }

    for (let i = 0; i < expectedHeaders.length; i++) {
      if (actualHeaders[i] !== expectedHeaders[i]) {
        this.addError(sectionName, this.currentLine,
          `ヘッダー[${i}]が不正です。期待値: "${expectedHeaders[i]}", 実際: "${actualHeaders[i]}"`);
        return false;
      }
    }

    return true;
  }

  /**
   * エラーを追加
   */
  private addError(section: string, line: number, message: string): void {
    this.errors.push({
      section,
      line,
      message
    });
  }

  /**
   * 警告を追加
   */
  private addWarning(message: string): void {
    this.warnings.push(message);
  }

  /**
   * パーサーの状態をリセット
   */
  private reset(): void {
    this.lines = [];
    this.currentLine = 0;
    this.errors = [];
    this.warnings = [];
  }
}