/**
 * レガシーCSVデータの整合性検証機能
 */

import type {
  LegacyCSVFile,
  ConversionResult,
  ValidationResult,
  ParseError,
  LegacyGrantData,
  LegacyBudgetItemData,
  LegacyAllocationData
} from '../types/legacy-csv.js';

export class LegacyCSVValidator {
  private errors: ParseError[] = [];
  private warnings: string[] = [];

  /**
   * レガシーCSVデータの完全検証を実行
   */
  validateLegacyData(legacyData: LegacyCSVFile): ValidationResult {
    this.reset();

    // 基本検証
    this.validateBasicStructure(legacyData);
    
    // データ品質検証
    this.validateDataQuality(legacyData);
    
    // 関係性検証
    const relationshipChecks = this.validateRelationships(legacyData);
    
    // 業務ルール検証
    this.validateBusinessRules(legacyData);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      relationshipChecks
    };
  }

  /**
   * 変換結果の検証
   */
  validateConversionResult(result: ConversionResult): ValidationResult {
    this.reset();

    // 変換後データの基本検証
    result.grants.forEach((grant, index) => {
      if (!grant.name || grant.name.trim() === '') {
        this.addError('converted_grants', index, '助成金名が空です');
      }
      if (!grant.legacyId) {
        this.addError('converted_grants', index, 'レガシーIDが保持されていません');
      }
    });

    result.budgetItems.forEach((item, index) => {
      if (!item.name || item.name.trim() === '') {
        this.addError('converted_budget_items', index, '予算項目名が空です');
      }
      if (!item.legacyId) {
        this.addError('converted_budget_items', index, 'レガシーIDが保持されていません');
      }
    });

    result.allocations.forEach((allocation, index) => {
      if (!allocation.transactionId) {
        this.addError('converted_allocations', index, '取引IDが空です');
      }
      if (allocation.amount <= 0) {
        this.addError('converted_allocations', index, '金額が0以下です');
      }
    });

    return {
      isValid: this.errors.length === 0,
      errors: [...result.errors, ...this.errors],
      warnings: [...result.warnings, ...this.warnings],
      relationshipChecks: {
        missingGrants: [],
        missingBudgetItems: [],
        orphanedBudgetItems: [],
        orphanedAllocations: []
      }
    };
  }

  /**
   * 基本構造の検証
   */
  private validateBasicStructure(legacyData: LegacyCSVFile): void {
    // セクションが存在するかチェック
    if (!legacyData.grants || legacyData.grants.length === 0) {
      this.addError('structure', 0, '助成金データセクションが空か存在しません');
    }

    if (!legacyData.budgetItems || legacyData.budgetItems.length === 0) {
      this.addWarning('予算項目データセクションが空です');
    }

    if (!legacyData.allocations || legacyData.allocations.length === 0) {
      this.addWarning('割当データセクションが空です');
    }

    // 元のパースエラーを含める
    if (legacyData.parseErrors && legacyData.parseErrors.length > 0) {
      this.errors.push(...legacyData.parseErrors);
    }

    if (legacyData.warnings && legacyData.warnings.length > 0) {
      this.warnings.push(...legacyData.warnings);
    }
  }

  /**
   * データ品質の検証
   */
  private validateDataQuality(legacyData: LegacyCSVFile): void {
    // 助成金データの品質チェック
    this.validateGrantsQuality(legacyData.grants);
    
    // 予算項目データの品質チェック
    this.validateBudgetItemsQuality(legacyData.budgetItems);
    
    // 割当データの品質チェック
    this.validateAllocationsQuality(legacyData.allocations);
  }

  /**
   * 助成金データの品質検証
   */
  private validateGrantsQuality(grants: LegacyGrantData[]): void {
    const usedIds = new Set<string>();

    grants.forEach((grant, index) => {
      // ID重複チェック
      if (usedIds.has(grant.ID)) {
        this.addError('grants', index, `重複したID: ${grant.ID}`);
      } else {
        usedIds.add(grant.ID);
      }

      // 必須フィールドチェック
      if (!grant.ID) {
        this.addError('grants', index, 'IDが空です');
      }
      if (!grant.名称) {
        this.addError('grants', index, '名称が空です');
      }

      // 数値フィールドの検証
      if (grant.総額 && grant.総額.trim() !== '') {
        const amount = this.parseNumber(grant.総額);
        if (amount === null) {
          this.addError('grants', index, `総額の形式が不正です: ${grant.総額}`);
        } else if (amount < 0) {
          this.addError('grants', index, `総額が負の値です: ${amount}`);
        }
      }

      // 日付フィールドの検証
      if (grant.開始日 && grant.開始日.trim() !== '') {
        const startDate = this.parseDate(grant.開始日);
        if (!startDate) {
          this.addError('grants', index, `開始日の形式が不正です: ${grant.開始日}`);
        }
      }

      if (grant.終了日 && grant.終了日.trim() !== '') {
        const endDate = this.parseDate(grant.終了日);
        if (!endDate) {
          this.addError('grants', index, `終了日の形式が不正です: ${grant.終了日}`);
        }

        // 開始日と終了日の関係チェック
        if (grant.開始日 && grant.開始日.trim() !== '') {
          const startDate = this.parseDate(grant.開始日);
          if (startDate && endDate && startDate > endDate) {
            this.addError('grants', index, '開始日が終了日より後です');
          }
        }
      }

      // ステータスの検証
      const validStatuses = ['active', 'completed', 'applied', 'inactive'];
      if (grant.ステータス && !validStatuses.includes(grant.ステータス.toLowerCase())) {
        this.addWarning(`助成金ID ${grant.ID}: 不明なステータス値: ${grant.ステータス}`);
      }
    });
  }

  /**
   * 予算項目データの品質検証
   */
  private validateBudgetItemsQuality(budgetItems: LegacyBudgetItemData[]): void {
    const usedIds = new Set<string>();

    budgetItems.forEach((item, index) => {
      // ID重複チェック
      if (usedIds.has(item.ID)) {
        this.addError('budget_items', index, `重複したID: ${item.ID}`);
      } else {
        usedIds.add(item.ID);
      }

      // 必須フィールドチェック
      if (!item.ID) {
        this.addError('budget_items', index, 'IDが空です');
      }
      if (!item.助成金ID) {
        this.addError('budget_items', index, '助成金IDが空です');
      }
      if (!item.名称) {
        this.addError('budget_items', index, '名称が空です');
      }

      // 予算額の検証
      if (item.予算額 && item.予算額.trim() !== '') {
        const amount = this.parseNumber(item.予算額);
        if (amount === null) {
          this.addError('budget_items', index, `予算額の形式が不正です: ${item.予算額}`);
        } else if (amount < 0) {
          this.addError('budget_items', index, `予算額が負の値です: ${amount}`);
        }
      }
    });
  }

  /**
   * 割当データの品質検証
   */
  private validateAllocationsQuality(allocations: LegacyAllocationData[]): void {
    const usedIds = new Set<string>();

    allocations.forEach((allocation, index) => {
      // ID重複チェック
      if (usedIds.has(allocation.ID)) {
        this.addError('allocations', index, `重複したID: ${allocation.ID}`);
      } else {
        usedIds.add(allocation.ID);
      }

      // 必須フィールドチェック
      if (!allocation.ID) {
        this.addError('allocations', index, 'IDが空です');
      }
      if (!allocation.取引ID) {
        this.addError('allocations', index, '取引IDが空です');
      }
      if (!allocation.予算項目ID) {
        this.addError('allocations', index, '予算項目IDが空です');
      }

      // 金額の検証
      if (!allocation.金額 || allocation.金額.trim() === '') {
        this.addError('allocations', index, '金額が空です');
      } else {
        const amount = this.parseNumber(allocation.金額);
        if (amount === null) {
          this.addError('allocations', index, `金額の形式が不正です: ${allocation.金額}`);
        } else if (amount < 0) {
          this.addWarning(`割当ID ${allocation.ID}: 金額が負の値です: ${amount}`);
        }
      }
    });
  }

  /**
   * データ間の関係性検証
   */
  private validateRelationships(legacyData: LegacyCSVFile) {
    const grantIds = new Set(legacyData.grants.map(g => g.ID).filter(id => id));
    const budgetItemIds = new Set(legacyData.budgetItems.map(b => b.ID).filter(id => id));

    // 助成金との関係チェック
    const missingGrants: string[] = [];
    const orphanedBudgetItems: string[] = [];

    legacyData.budgetItems.forEach(item => {
      if (item.助成金ID && !grantIds.has(item.助成金ID)) {
        if (!missingGrants.includes(item.助成金ID)) {
          missingGrants.push(item.助成金ID);
        }
        orphanedBudgetItems.push(item.ID);
      }
    });

    // 予算項目との関係チェック
    const missingBudgetItems: string[] = [];
    const orphanedAllocations: string[] = [];

    legacyData.allocations.forEach(allocation => {
      if (allocation.予算項目ID && !budgetItemIds.has(allocation.予算項目ID)) {
        if (!missingBudgetItems.includes(allocation.予算項目ID)) {
          missingBudgetItems.push(allocation.予算項目ID);
        }
        orphanedAllocations.push(allocation.ID);
      }
    });

    // エラーとして記録
    missingGrants.forEach(grantId => {
      this.addError('relationships', 0, `参照される助成金が存在しません: ${grantId}`);
    });

    missingBudgetItems.forEach(budgetItemId => {
      this.addError('relationships', 0, `参照される予算項目が存在しません: ${budgetItemId}`);
    });

    return {
      missingGrants,
      missingBudgetItems,
      orphanedBudgetItems,
      orphanedAllocations
    };
  }

  /**
   * 業務ルールの検証
   */
  private validateBusinessRules(legacyData: LegacyCSVFile): void {
    // 助成金の予算額と予算項目の合計額の整合性チェック
    const grantBudgetMap = new Map<string, number>();
    
    // 助成金の総額を収集
    legacyData.grants.forEach(grant => {
      if (grant.総額) {
        const amount = this.parseNumber(grant.総額);
        if (amount !== null) {
          grantBudgetMap.set(grant.ID, amount);
        }
      }
    });

    // 予算項目の合計を計算
    const grantItemTotals = new Map<string, number>();
    legacyData.budgetItems.forEach(item => {
      if (item.予算額 && item.助成金ID) {
        const amount = this.parseNumber(item.予算額);
        if (amount !== null) {
          const current = grantItemTotals.get(item.助成金ID) || 0;
          grantItemTotals.set(item.助成金ID, current + amount);
        }
      }
    });

    // 整合性チェック
    for (const [grantId, totalAmount] of grantBudgetMap) {
      const itemsTotal = grantItemTotals.get(grantId) || 0;
      if (itemsTotal > totalAmount) {
        this.addWarning(`助成金ID ${grantId}: 予算項目の合計額(${itemsTotal})が総額(${totalAmount})を超えています`);
      }
    }

    // 割当金額の整合性チェック
    const budgetItemAllocations = new Map<string, number>();
    legacyData.allocations.forEach(allocation => {
      if (allocation.金額 && allocation.予算項目ID) {
        const amount = this.parseNumber(allocation.金額);
        if (amount !== null) {
          const current = budgetItemAllocations.get(allocation.予算項目ID) || 0;
          budgetItemAllocations.set(allocation.予算項目ID, current + amount);
        }
      }
    });

    const budgetItemAmounts = new Map<string, number>();
    legacyData.budgetItems.forEach(item => {
      if (item.予算額) {
        const amount = this.parseNumber(item.予算額);
        if (amount !== null) {
          budgetItemAmounts.set(item.ID, amount);
        }
      }
    });

    for (const [budgetItemId, allocatedTotal] of budgetItemAllocations) {
      const budgetedAmount = budgetItemAmounts.get(budgetItemId) || 0;
      if (allocatedTotal > budgetedAmount) {
        this.addWarning(`予算項目ID ${budgetItemId}: 割当合計額(${allocatedTotal})が予算額(${budgetedAmount})を超えています`);
      }
    }
  }

  /**
   * 数値文字列をパース
   */
  private parseNumber(value: string): number | null {
    if (!value || value.trim() === '') {
      return null;
    }

    const cleanValue = value.replace(/,/g, '').trim();
    const num = parseFloat(cleanValue);
    
    return isNaN(num) ? null : Math.round(num);
  }

  /**
   * 日付文字列をパース
   */
  private parseDate(value: string): Date | null {
    if (!value || value.trim() === '') {
      return null;
    }

    try {
      // ISO形式の場合
      const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // 日本形式の場合
      const jpMatch = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (jpMatch) {
        const [, year, month, day] = jpMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      const date = new Date(value);
      return !isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
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
   * バリデーターの状態をリセット
   */
  private reset(): void {
    this.errors = [];
    this.warnings = [];
  }
}