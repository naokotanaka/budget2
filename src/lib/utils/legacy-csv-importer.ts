/**
 * レガシーnagaiku-budgetシステムのCSVインポーター
 * 全機能を統合したメインクラス
 */

import type {
  LegacyCSVFile,
  ConversionConfig,
  ConversionResult,
  ValidationResult,
  LegacyImportProgress,
  ConvertedGrantData,
  ConvertedBudgetItemData,
  ConvertedAllocationData,
  SupportedEncoding
} from '../types/legacy-csv.js';

import { LegacyCSVParser } from './legacy-csv-parser.js';
import { LegacyCSVConverter } from './legacy-csv-converter.js';
import { LegacyCSVValidator } from './legacy-csv-validator.js';
import { EncodingDetector, type EncodingDetectionResult } from './encoding-detector.js';

export interface LegacyImportConfig extends ConversionConfig {
  dryRun?: boolean; // 実際のインポートは行わず、検証のみ
  batchSize?: number; // バッチサイズ（データベースインポート用）
  progressCallback?: (progress: LegacyImportProgress) => void;
}

export interface LegacyImportResult {
  success: boolean;
  message: string;
  validation: ValidationResult;
  conversion: ConversionResult;
  encoding: EncodingDetectionResult;
  imported?: {
    grants: number;
    budgetItems: number;
    allocations: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * レガシーCSVインポーターのメインクラス
 */
export class LegacyCSVImporter {
  private config: LegacyImportConfig;
  private parser: LegacyCSVParser;
  private converter: LegacyCSVConverter;
  private validator: LegacyCSVValidator;

  constructor(config: LegacyImportConfig = {}) {
    this.config = {
      skipInvalidDates: true,
      defaultGrantStatus: 'active',
      preserveLegacyIds: true,
      validateRelationships: true,
      encoding: 'auto',
      dryRun: false,
      batchSize: 100,
      ...config
    };

    this.parser = new LegacyCSVParser();
    this.converter = new LegacyCSVConverter(this.config);
    this.validator = new LegacyCSVValidator();
  }

  /**
   * レガシーCSVファイルをインポート
   */
  async importLegacyCSV(
    file: File | string,
    hintEncoding?: SupportedEncoding
  ): Promise<LegacyImportResult> {
    try {
      this.reportProgress('parsing', 0, 100, 'ファイルを読み込んでいます...');

      // エンコーディング検出とファイル読み込み
      const encoding = await this.detectEncoding(file, hintEncoding);
      this.reportProgress('parsing', 20, 100, 'エンコーディング検出完了');

      // CSVパース
      const legacyData = await this.parser.parseCSV(encoding.content);
      this.reportProgress('parsing', 40, 100, 'CSVデータの解析完了');

      // データ検証
      this.reportProgress('validating', 50, 100, 'データの検証中...');
      const validation = this.validator.validateLegacyData(legacyData);
      this.reportProgress('validating', 70, 100, 'データ検証完了');

      // データ変換
      this.reportProgress('converting', 80, 100, 'データを新システム形式に変換中...');
      const conversion = this.converter.convertLegacyData(legacyData);
      this.reportProgress('converting', 90, 100, 'データ変換完了');

      // 変換結果の検証
      const conversionValidation = this.validator.validateConversionResult(conversion);
      
      // 結果の統合
      const combinedValidation: ValidationResult = {
        isValid: validation.isValid && conversionValidation.isValid,
        errors: [...validation.errors, ...conversionValidation.errors],
        warnings: [...validation.warnings, ...conversionValidation.warnings],
        relationshipChecks: {
          ...validation.relationshipChecks,
          ...conversionValidation.relationshipChecks
        }
      };

      // インポート実行
      let imported: { grants: number; budgetItems: number; allocations: number } | undefined;
      if (!this.config.dryRun && combinedValidation.isValid) {
        this.reportProgress('importing', 95, 100, 'データベースへのインポート中...');
        imported = await this.executeImport(conversion);
      }

      this.reportProgress('completed', 100, 100, 'インポート完了');

      const result: LegacyImportResult = {
        success: combinedValidation.isValid,
        message: this.generateResultMessage(combinedValidation, conversion, imported),
        validation: combinedValidation,
        conversion,
        encoding,
        imported,
        errors: combinedValidation.errors.map(e => `[${e.section}:${e.line}] ${e.message}`),
        warnings: combinedValidation.warnings
      };

      return result;
    } catch (error: any) {
      this.reportProgress('error', 0, 100, `エラーが発生しました: ${error}`);
      
      return {
        success: false,
        message: `インポート中にエラーが発生しました: ${error}`,
        validation: {
          isValid: false,
          errors: [{ section: 'general', line: 0, message: String(error) }],
          warnings: [],
          relationshipChecks: {
            missingGrants: [],
            missingBudgetItems: [],
            orphanedBudgetItems: [],
            orphanedAllocations: []
          }
        },
        conversion: {
          grants: [],
          budgetItems: [],
          allocations: [],
          errors: [],
          warnings: [],
          stats: {
            grantsConverted: 0,
            budgetItemsConverted: 0,
            allocationsConverted: 0,
            errorsCount: 1,
            warningsCount: 0
          }
        },
        encoding: {
          detectedEncoding: 'unknown',
          confidence: 0,
          content: ''
        },
        errors: [String(error)],
        warnings: []
      };
    }
  }

  /**
   * エンコーディング検出
   */
  private async detectEncoding(
    file: File | string, 
    hintEncoding?: SupportedEncoding
  ): Promise<EncodingDetectionResult> {
    if (typeof file === 'string') {
      return {
        detectedEncoding: 'utf-8',
        confidence: 1.0,
        content: file
      };
    }

    return await EncodingDetector.detectFromFile(file, hintEncoding);
  }

  /**
   * データベースへのインポート実行
   */
  private async executeImport(conversion: ConversionResult): Promise<{
    grants: number;
    budgetItems: number;
    allocations: number;
  }> {
    try {
      // 助成金データをインポート
      const importedGrants = await this.importGrants(conversion.grants);
      
      // 予算項目データをインポート
      const importedBudgetItems = await this.importBudgetItems(conversion.budgetItems);
      
      // 割当データをインポート
      const importedAllocations = await this.importAllocations(conversion.allocations);

      return {
        grants: importedGrants,
        budgetItems: importedBudgetItems,
        allocations: importedAllocations
      };
    } catch (error: any) {
      throw new Error(`データベースインポート中にエラー: ${error}`);
    }
  }

  /**
   * 助成金データをデータベースにインポート
   */
  private async importGrants(grants: ConvertedGrantData[]): Promise<number> {
    if (grants.length === 0) return 0;

    try {
      // バッチ処理でインポート
      let imported = 0;
      const batchSize = this.config.batchSize || 100;
      
      for (let i = 0; i < grants.length; i += batchSize) {
        const batch = grants.slice(i, i + batchSize);
        
        const response = await fetch('/api/grants/legacy-import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grants: batch,
            preserveLegacyIds: this.config.preserveLegacyIds
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`助成金インポートAPIエラー: ${error}`);
        }

        const result = await response.json();
        imported += result.imported || 0;
      }

      return imported;
    } catch (error: any) {
      throw new Error(`助成金データのインポートに失敗: ${error}`);
    }
  }

  /**
   * 予算項目データをデータベースにインポート
   */
  private async importBudgetItems(budgetItems: ConvertedBudgetItemData[]): Promise<number> {
    if (budgetItems.length === 0) return 0;

    try {
      let imported = 0;
      const batchSize = this.config.batchSize || 100;
      
      for (let i = 0; i < budgetItems.length; i += batchSize) {
        const batch = budgetItems.slice(i, i + batchSize);
        
        const response = await fetch('/api/budget-items/legacy-import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            budgetItems: batch,
            preserveLegacyIds: this.config.preserveLegacyIds
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`予算項目インポートAPIエラー: ${error}`);
        }

        const result = await response.json();
        imported += result.imported || 0;
      }

      return imported;
    } catch (error: any) {
      throw new Error(`予算項目データのインポートに失敗: ${error}`);
    }
  }

  /**
   * 割当データをデータベースにインポート
   */
  private async importAllocations(allocations: ConvertedAllocationData[]): Promise<number> {
    if (allocations.length === 0) return 0;

    try {
      let imported = 0;
      const batchSize = this.config.batchSize || 100;
      
      for (let i = 0; i < allocations.length; i += batchSize) {
        const batch = allocations.slice(i, i + batchSize);
        
        const response = await fetch('/api/allocations/legacy-import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            allocations: batch,
            preserveLegacyIds: this.config.preserveLegacyIds
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`割当インポートAPIエラー: ${error}`);
        }

        const result = await response.json();
        imported += result.imported || 0;
      }

      return imported;
    } catch (error: any) {
      throw new Error(`割当データのインポートに失敗: ${error}`);
    }
  }

  /**
   * 進行状況を報告
   */
  private reportProgress(
    stage: LegacyImportProgress['stage'],
    current: number,
    total: number,
    message?: string
  ): void {
    if (this.config.progressCallback) {
      this.config.progressCallback({
        stage,
        current,
        total,
        percentage: Math.round((current / total) * 100),
        message
      });
    }
  }

  /**
   * 結果メッセージを生成
   */
  private generateResultMessage(
    validation: ValidationResult,
    conversion: ConversionResult,
    imported?: { grants: number; budgetItems: number; allocations: number }
  ): string {
    const { stats } = conversion;
    
    if (!validation.isValid) {
      return `インポートに失敗しました。エラー: ${validation.errors.length}個、警告: ${validation.warnings.length}個`;
    }

    if (this.config.dryRun) {
      return `検証完了（ドライラン）: 助成金${stats.grantsConverted}件、予算項目${stats.budgetItemsConverted}件、割当${stats.allocationsConverted}件が変換可能です。`;
    }

    if (imported) {
      return `インポート完了: 助成金${imported.grants}件、予算項目${imported.budgetItems}件、割当${imported.allocations}件をインポートしました。`;
    }

    return `変換完了: 助成金${stats.grantsConverted}件、予算項目${stats.budgetItemsConverted}件、割当${stats.allocationsConverted}件を変換しました。`;
  }

  /**
   * サンプルCSVファイルのテンプレートを生成
   */
  static generateSampleCSV(): string {
    const lines = [
      '[助成金データ]',
      'ID,名称,総額,開始日,終了日,ステータス',
      '1,サンプル助成金A,1000000,2025-01-01,2025-12-31,active',
      '2,サンプル助成金B,500000,2025-02-01,2025-11-30,active',
      '',
      '[予算項目データ]',
      'ID,助成金ID,名称,カテゴリ,予算額',
      '1,1,人件費,人件費,400000',
      '2,1,事務用品費,事業費,100000',
      '3,2,旅費交通費,事業費,150000',
      '',
      '[割当データ]',
      'ID,取引ID,予算項目ID,金額',
      '1,TXN001,1,50000',
      '2,TXN002,2,15000',
      '3,TXN003,3,25000'
    ];
    
    return lines.join('\n');
  }

  /**
   * インポート設定のバリデーション
   */
  static validateConfig(config: LegacyImportConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.batchSize && (config.batchSize < 1 || config.batchSize > 1000)) {
      errors.push('バッチサイズは1〜1000の範囲で指定してください');
    }

    const validEncodings: SupportedEncoding[] = ['auto', 'utf-8', 'shift_jis', 'euc-jp'];
    if (config.encoding && !validEncodings.includes(config.encoding)) {
      errors.push(`サポートされていないエンコーディング: ${config.encoding}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}