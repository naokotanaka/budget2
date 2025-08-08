/**
 * レガシーCSVデータから新システム形式への変換機能
 */

import type {
  LegacyCSVFile,
  LegacyGrantData,
  LegacyBudgetItemData,
  LegacyAllocationData,
  ConvertedGrantData,
  ConvertedBudgetItemData,
  ConvertedAllocationData,
  ConversionConfig,
  ConversionResult,
  ParseError,
  LEGACY_STATUS_MAPPING
} from '../types/legacy-csv.js';

export class LegacyCSVConverter {
  private config: ConversionConfig;
  private errors: ParseError[] = [];
  private warnings: string[] = [];

  constructor(config: ConversionConfig = {}) {
    this.config = {
      skipInvalidDates: true,
      defaultGrantStatus: 'in_progress',
      preserveLegacyIds: true,
      validateRelationships: true,
      encoding: 'utf-8',
      ...config
    };
  }

  /**
   * レガシーCSVデータを新システム形式に変換
   */
  convertLegacyData(legacyData: LegacyCSVFile): ConversionResult {
    this.reset();

    try {
      // データ変換
      const grants = this.convertGrants(legacyData.grants);
      const budgetItems = this.convertBudgetItems(legacyData.budgetItems, grants);
      const allocations = this.convertAllocations(legacyData.allocations, budgetItems);

      // 関係性の検証
      if (this.config.validateRelationships) {
        this.validateRelationships(grants, budgetItems, allocations, legacyData);
      }

      // 元のパースエラーも含める
      this.errors.push(...legacyData.parseErrors);
      this.warnings.push(...legacyData.warnings);

      return {
        grants,
        budgetItems,
        allocations,
        errors: this.errors,
        warnings: this.warnings,
        stats: {
          grantsConverted: grants.length,
          budgetItemsConverted: budgetItems.length,
          allocationsConverted: allocations.length,
          errorsCount: this.errors.length,
          warningsCount: this.warnings.length
        }
      };
    } catch (error) {
      this.addError('general', 0, `データ変換中にエラーが発生しました: ${error}`);
      return {
        grants: [],
        budgetItems: [],
        allocations: [],
        errors: this.errors,
        warnings: this.warnings,
        stats: {
          grantsConverted: 0,
          budgetItemsConverted: 0,
          allocationsConverted: 0,
          errorsCount: this.errors.length,
          warningsCount: this.warnings.length
        }
      };
    }
  }

  /**
   * 助成金データを変換
   */
  private convertGrants(legacyGrants: LegacyGrantData[]): ConvertedGrantData[] {
    return legacyGrants.map((grant, index) => {
      try {
        const converted: ConvertedGrantData = {
          name: grant.名称 || `助成金_${grant.ID}`,
          legacyId: grant.ID,
          status: this.convertStatus(grant.ステータス)
        };

        // オプショナルフィールドの変換
        if (grant.総額) {
          const totalAmount = this.parseNumber(grant.総額);
          if (totalAmount !== null) {
            converted.totalAmount = totalAmount;
          } else {
            this.addWarning(`助成金ID ${grant.ID}: 総額の形式が不正です (${grant.総額})`);
          }
        }

        if (grant.開始日) {
          const startDate = this.parseDate(grant.開始日);
          if (startDate) {
            converted.startDate = startDate;
          } else if (!this.config.skipInvalidDates) {
            this.addError('grants', index, `助成金ID ${grant.ID}: 開始日の形式が不正です (${grant.開始日})`);
          } else {
            this.addWarning(`助成金ID ${grant.ID}: 開始日の形式が不正です (${grant.開始日})`);
          }
        }

        if (grant.終了日) {
          const endDate = this.parseDate(grant.終了日);
          if (endDate) {
            converted.endDate = endDate;
          } else if (!this.config.skipInvalidDates) {
            this.addError('grants', index, `助成金ID ${grant.ID}: 終了日の形式が不正です (${grant.終了日})`);
          } else {
            this.addWarning(`助成金ID ${grant.ID}: 終了日の形式が不正です (${grant.終了日})`);
          }
        }

        return converted;
      } catch (error) {
        this.addError('grants', index, `助成金データの変換中にエラー: ${error}`);
        // エラーが発生した場合でも基本的なデータを返す
        return {
          name: grant.名称 || `助成金_${grant.ID}`,
          legacyId: grant.ID,
          status: this.config.defaultGrantStatus || 'in_progress'
        };
      }
    });
  }

  /**
   * 予算項目データを変換
   */
  private convertBudgetItems(
    legacyBudgetItems: LegacyBudgetItemData[], 
    grants: ConvertedGrantData[]
  ): ConvertedBudgetItemData[] {
    const grantMap = new Map(grants.map(g => [g.legacyId, g]));

    return legacyBudgetItems.map((budgetItem, index) => {
      try {
        const converted: ConvertedBudgetItemData = {
          name: budgetItem.名称 || `予算項目_${budgetItem.ID}`,
          legacyId: budgetItem.ID,
          legacyGrantId: budgetItem.助成金ID,
          sortOrder: index
        };

        // カテゴリの設定
        if (budgetItem.カテゴリ) {
          converted.category = budgetItem.カテゴリ;
        }

        // 予算額の変換
        if (budgetItem.予算額) {
          const budgetedAmount = this.parseNumber(budgetItem.予算額);
          if (budgetedAmount !== null) {
            converted.budgetedAmount = budgetedAmount;
          } else {
            this.addWarning(`予算項目ID ${budgetItem.ID}: 予算額の形式が不正です (${budgetItem.予算額})`);
          }
        }

        // 助成金IDの解決
        const grant = grantMap.get(budgetItem.助成金ID);
        if (grant && grant.id) {
          converted.grantId = grant.id;
        } else {
          this.addWarning(`予算項目ID ${budgetItem.ID}: 対応する助成金が見つかりません (助成金ID: ${budgetItem.助成金ID})`);
        }

        return converted;
      } catch (error) {
        this.addError('budget_items', index, `予算項目データの変換中にエラー: ${error}`);
        return {
          name: budgetItem.名称 || `予算項目_${budgetItem.ID}`,
          legacyId: budgetItem.ID,
          legacyGrantId: budgetItem.助成金ID,
          sortOrder: index
        };
      }
    });
  }

  /**
   * 割当データを変換
   */
  private convertAllocations(
    legacyAllocations: LegacyAllocationData[], 
    budgetItems: ConvertedBudgetItemData[]
  ): ConvertedAllocationData[] {
    const budgetItemMap = new Map(budgetItems.map(b => [b.legacyId, b]));

    return legacyAllocations.map((allocation, index) => {
      try {
        const amount = this.parseNumber(allocation.金額);
        if (amount === null) {
          this.addError('allocations', index, `割当ID ${allocation.ID}: 金額の形式が不正です (${allocation.金額})`);
          return null;
        }

        const converted: ConvertedAllocationData = {
          id: `legacy_${allocation.ID}`,
          transactionId: allocation.取引ID,
          amount: amount,
          legacyId: allocation.ID,
          legacyBudgetItemId: allocation.予算項目ID
        };

        // 予算項目IDの解決
        const budgetItem = budgetItemMap.get(allocation.予算項目ID);
        if (budgetItem && budgetItem.id) {
          converted.budgetItemId = budgetItem.id;
        } else {
          this.addWarning(`割当ID ${allocation.ID}: 対応する予算項目が見つかりません (予算項目ID: ${allocation.予算項目ID})`);
        }

        return converted;
      } catch (error) {
        this.addError('allocations', index, `割当データの変換中にエラー: ${error}`);
        return null;
      }
    }).filter((allocation): allocation is ConvertedAllocationData => allocation !== null);
  }

  /**
   * ステータスを新システム形式に変換
   */
  private convertStatus(legacyStatus: string): 'in_progress' | 'completed' | 'reported' {
    const normalizedStatus = legacyStatus.toLowerCase().trim();
    return LEGACY_STATUS_MAPPING[normalizedStatus] || this.config.defaultGrantStatus || 'in_progress';
  }

  /**
   * 数値文字列をパース
   */
  private parseNumber(value: string): number | null {
    if (!value || value.trim() === '') {
      return null;
    }

    // カンマ区切りを除去
    const cleanValue = value.replace(/,/g, '').trim();
    
    // 数値に変換
    const num = parseFloat(cleanValue);
    
    if (isNaN(num)) {
      return null;
    }

    return Math.round(num); // 整数に変換
  }

  /**
   * 日付文字列をパース
   */
  private parseDate(value: string): Date | null {
    if (!value || value.trim() === '') {
      return null;
    }

    try {
      // ISO形式 (YYYY-MM-DD) の場合
      const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // 日本形式 (YYYY/MM/DD) の場合
      const jpMatch = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (jpMatch) {
        const [, year, month, day] = jpMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // その他の形式を試す
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * データ間の関係性を検証
   */
  private validateRelationships(
    grants: ConvertedGrantData[],
    budgetItems: ConvertedBudgetItemData[],
    allocations: ConvertedAllocationData[],
    originalData: LegacyCSVFile
  ): void {
    const grantIds = new Set(grants.map(g => g.legacyId));
    const budgetItemIds = new Set(budgetItems.map(b => b.legacyId));

    // 助成金との関係チェック
    const missingGrants = new Set<string>();
    budgetItems.forEach(budgetItem => {
      if (!grantIds.has(budgetItem.legacyGrantId)) {
        missingGrants.add(budgetItem.legacyGrantId);
      }
    });

    if (missingGrants.size > 0) {
      this.addWarning(`参照される助成金が存在しません: ${Array.from(missingGrants).join(', ')}`);
    }

    // 予算項目との関係チェック
    const missingBudgetItems = new Set<string>();
    allocations.forEach(allocation => {
      if (!budgetItemIds.has(allocation.legacyBudgetItemId)) {
        missingBudgetItems.add(allocation.legacyBudgetItemId);
      }
    });

    if (missingBudgetItems.size > 0) {
      this.addWarning(`参照される予算項目が存在しません: ${Array.from(missingBudgetItems).join(', ')}`);
    }
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
   * コンバーターの状態をリセット
   */
  private reset(): void {
    this.errors = [];
    this.warnings = [];
  }
}