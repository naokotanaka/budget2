/**
 * レガシーCSV統合インポートAPI
 * セクション別CSVファイルを解析し、一括でデータをインポートする
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { LegacyCSVParser } from '$lib/utils/legacy-csv-parser.js';
import { LegacyCSVConverter } from '$lib/utils/legacy-csv-converter.js';
import type { ConversionConfig, LegacyImportProgress } from '$lib/types/legacy-csv.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ImportRequest {
  csvContent: string;
  filename?: string;
  config?: ConversionConfig;
  dryRun?: boolean;
}

interface ImportResponse {
  success: boolean;
  message: string;
  results?: {
    grants: { imported: number; total: number; errors: string[] };
    budgetItems: { imported: number; total: number; errors: string[] };
    allocations: { imported: number; total: number; errors: string[] };
  };
  errors?: string[];
  warnings?: string[];
  stats?: {
    totalProcessed: number;
    totalImported: number;
    totalErrors: number;
    totalWarnings: number;
  };
  preview?: any; // dryRun時のプレビューデータ
}

export const POST: RequestHandler = async ({ request }) => {
  let progress: LegacyImportProgress = {
    stage: 'parsing',
    current: 0,
    total: 100,
    percentage: 0,
    message: 'CSVファイルを解析中...'
  };

  try {
    const requestData = await request.json() as ImportRequest;
    const { csvContent, filename, config = {}, dryRun = false } = requestData;

    if (!csvContent || typeof csvContent !== 'string') {
      return json(
        { success: false, message: 'CSVコンテンツが不正です' },
        { status: 400 }
      );
    }

    // 1. CSVファイルの解析
    progress.stage = 'parsing';
    progress.message = 'レガシーCSVファイルを解析中...';
    
    const parser = new LegacyCSVParser();
    const parsedData = await parser.parseCSV(csvContent);

    if (parsedData.parseErrors.length > 0) {
      const criticalErrors = parsedData.parseErrors.filter(e => 
        e.message.includes('必須') || e.message.includes('不正')
      );
      
      if (criticalErrors.length > 0) {
        return json({
          success: false,
          message: 'CSVファイルに重大なエラーがあります',
          errors: criticalErrors.map(e => `${e.section} (行${e.line}): ${e.message}`),
          warnings: parsedData.warnings
        }, { status: 400 });
      }
    }

    // 2. データ変換
    progress.stage = 'converting';
    progress.message = '新システム形式に変換中...';

    const converter = new LegacyCSVConverter(config);
    const conversionResult = await converter.convertLegacyData(parsedData);

    // 3. Dry Run モードの場合はプレビューを返す
    if (dryRun) {
      return json({
        success: true,
        message: 'インポートプレビューを生成しました',
        preview: {
          grants: conversionResult.grants.slice(0, 5), // 最初の5件のみ
          budgetItems: conversionResult.budgetItems.slice(0, 5),
          allocations: conversionResult.allocations.slice(0, 5)
        },
        stats: conversionResult.stats,
        errors: conversionResult.errors.map(e => `${e.section} (行${e.line}): ${e.message}`),
        warnings: conversionResult.warnings
      });
    }

    // 4. データベースへのインポート
    progress.stage = 'importing';
    progress.message = 'データベースにインポート中...';

    const importResults = await performDatabaseImport(conversionResult);

    const response: ImportResponse = {
      success: true,
      message: 'レガシーデータのインポートが完了しました',
      results: importResults,
      errors: conversionResult.errors.map(e => `${e.section} (行${e.line}): ${e.message}`),
      warnings: conversionResult.warnings,
      stats: {
        totalProcessed: conversionResult.stats.grantsConverted + 
                       conversionResult.stats.budgetItemsConverted + 
                       conversionResult.stats.allocationsConverted,
        totalImported: importResults.grants.imported + 
                      importResults.budgetItems.imported + 
                      importResults.allocations.imported,
        totalErrors: conversionResult.errors.length + 
                    importResults.grants.errors.length +
                    importResults.budgetItems.errors.length +
                    importResults.allocations.errors.length,
        totalWarnings: conversionResult.warnings.length
      }
    };

    return json(response);

  } catch (error: any) {
    console.error('レガシーCSVインポートエラー:', error);
    
    return json({
      success: false,
      message: 'インポート処理中にエラーが発生しました',
      errors: [error instanceof Error ? error.message : String(error)]
    }, { status: 500 });
  }
};

/**
 * データベースへの実際のインポート処理
 */
async function performDatabaseImport(conversionResult: any) {
  const results = {
    grants: { imported: 0, total: 0, errors: [] as string[] },
    budgetItems: { imported: 0, total: 0, errors: [] as string[] },
    allocations: { imported: 0, total: 0, errors: [] as string[] }
  };

  // Prismaトランザクション内でインポートを実行
  await prisma.$transaction(async (tx) => {
    // レガシーID -> 新ID のマッピングを保持
    const grantIdMap = new Map<string, number>();
    const budgetItemIdMap = new Map<string, number>();

    // 1. 助成金のインポート
    results.grants.total = conversionResult.grants.length;
    for (const grantData of conversionResult.grants) {
      try {
        const grant = await tx.grant.create({
          data: {
            name: grantData.name,
            grantCode: grantData.grantCode || null,
            totalAmount: grantData.totalAmount || null,
            startDate: grantData.startDate || null,
            endDate: grantData.endDate || null,
            status: grantData.status || 'active'
          }
        });

        grantIdMap.set(grantData.legacyId, grant.id);
        results.grants.imported++;

      } catch (error: any) {
        results.grants.errors.push(`助成金 "${grantData.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 2. 予算項目のインポート
    results.budgetItems.total = conversionResult.budgetItems.length;
    for (const budgetItemData of conversionResult.budgetItems) {
      try {
        const grantId = grantIdMap.get(budgetItemData.legacyGrantId);
        if (!grantId) {
          results.budgetItems.errors.push(`予算項目 "${budgetItemData.name}": 助成金ID "${budgetItemData.legacyGrantId}" が見つかりません`);
          continue;
        }

        const budgetItem = await tx.budgetItem.create({
          data: {
            name: budgetItemData.name,
            category: budgetItemData.category || null,
            budgetedAmount: budgetItemData.budgetedAmount || null,
            note: budgetItemData.note || null,
            sortOrder: budgetItemData.sortOrder || 0,
            grantId: grantId
          }
        });

        budgetItemIdMap.set(budgetItemData.legacyId, budgetItem.id);
        results.budgetItems.imported++;

      } catch (error: any) {
        results.budgetItems.errors.push(`予算項目 "${budgetItemData.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 3. 割当のインポート
    results.allocations.total = conversionResult.allocations.length;
    for (const allocationData of conversionResult.allocations) {
      try {
        const budgetItemId = budgetItemIdMap.get(allocationData.legacyBudgetItemId);
        if (!budgetItemId) {
          results.allocations.errors.push(`割当 "${allocationData.legacyId}": 予算項目ID "${allocationData.legacyBudgetItemId}" が見つかりません`);
          continue;
        }

        await tx.allocationSplit.create({
          data: {
            transactionId: allocationData.transactionId,
            budgetItemId: budgetItemId,
            amount: allocationData.amount,
            note: allocationData.note || null
          }
        });

        results.allocations.imported++;

      } catch (error: any) {
        results.allocations.errors.push(`割当 "${allocationData.legacyId}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  return results;
}

/**
 * インポート進行状況の取得API（WebSocket代替案）
 */
export const GET: RequestHandler = async ({ url }) => {
  const sessionId = url.searchParams.get('sessionId');
  
  if (!sessionId) {
    return json({ error: 'セッションIDが必要です' }, { status: 400 });
  }

  // 実際の実装では、セッションベースの進行状況管理が必要
  // 現在は簡単な応答を返す
  return json({
    stage: 'completed',
    percentage: 100,
    message: '処理が完了しました'
  });
};