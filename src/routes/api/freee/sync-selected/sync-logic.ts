import type { PrismaClient, Transaction } from '@prisma/client';
import { 
  safeBigInt, 
  createTransactionData, 
  hasTransactionChanged 
} from './helpers';
import { logger, PerformanceTimer } from './logger';

/**
 * 同期処理の統計情報
 */
export interface SyncStats {
  selected: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  deletedCount: number;
  errorCount: number;
  errors: Array<{
    freeDealId: string;
    error: string;
  }>;
}

/**
 * 単一取引の処理結果
 */
export interface ProcessResult {
  type: 'created' | 'updated' | 'skipped' | 'error';
  freeDealId: string;
  error?: string;
}

/**
 * 単一取引を処理する
 */
export async function processSingleDeal(
  deal: any,
  existingTransaction: Transaction | undefined,
  tx: any
): Promise<ProcessResult> {
  try {
    const newTransactionData = createTransactionData(deal);
    const freeDealId = deal.id.toString();

    if (existingTransaction) {
      // 既存データと比較して更新が必要かチェック
      if (hasTransactionChanged(existingTransaction, newTransactionData)) {
        // 更新処理
        await tx.transaction.update({
          where: { id: existingTransaction.id },
          data: {
            ...newTransactionData,
            updatedAt: new Date()
          }
        });
        return { type: 'updated', freeDealId };
      } else {
        // 変更なし
        return { type: 'skipped', freeDealId };
      }
    } else {
      // 新規作成
      const transactionData = {
        id: `freee_${deal.id}_${Date.now()}`,
        ...newTransactionData
      };

      await tx.transaction.create({
        data: transactionData
      });
      return { type: 'created', freeDealId };
    }
  } catch (error) {
    return {
      type: 'error',
      freeDealId: deal.id.toString(),
      error: (error as Error).message
    };
  }
}

/**
 * 削除されたトランザクションを処理する
 */
export async function processDeletedTransactions(
  existingTransactions: Transaction[],
  dealIds: Set<string>,
  tx: any
): Promise<{ deletedCount: number; errors: Array<{ freeDealId: string; error: string }> }> {
  let deletedCount = 0;
  const errors: Array<{ freeDealId: string; error: string }> = [];

  // freeeにない既存データを探す
  const toDelete = existingTransactions.filter(
    t => t.freeDealId && !dealIds.has(t.freeDealId.toString())
  );

  for (const transaction of toDelete) {
    try {
      await tx.transaction.delete({
        where: { id: transaction.id }
      });
      deletedCount++;
    } catch (error) {
      errors.push({
        freeDealId: transaction.freeDealId?.toString() || 'unknown',
        error: `削除エラー: ${(error as Error).message}`
      });
    }
  }

  return { deletedCount, errors };
}

/**
 * freee同期処理のメイン機能
 */
export async function executeSync(
  deals: any[],
  prisma: PrismaClient
): Promise<SyncStats> {
  const timer = new PerformanceTimer(`同期処理 ${deals.length}件`);
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      logger.info(`同期開始: ${deals.length}件の取引を処理`);
      
      // freee IDのリストを作成
      const dealIds = deals.map((d: any) => safeBigInt(d.id));
      
      // 既存の取引データを全て取得（比較用）
      const dbTimer = new PerformanceTimer('既存データ取得');
      const existingTransactions = await tx.transaction.findMany({
        where: {
          freeDealId: {
            in: dealIds
          }
        }
      });
      dbTimer.end();
      
      logger.info(`既存データ: ${existingTransactions.length}件`);
      
      // 既存データのマップを作成（freeDealIdをキーとする）
      const existingMap = new Map(
        existingTransactions.map(t => [t.freeDealId?.toString(), t])
      );

      // 統計用カウンター
      const stats: SyncStats = {
        selected: deals.length,
        newCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        deletedCount: 0,
        errorCount: 0,
        errors: []
      };

      // 各dealを処理
      const processTimer = new PerformanceTimer('取引処理');
      for (const deal of deals) {
        const dealIdStr = deal.id.toString();
        const existingTransaction = existingMap.get(dealIdStr);
        
        logger.syncDetail(`処理中: freeDealId ${dealIdStr}`);
        
        const result = await processSingleDeal(deal, existingTransaction, tx);
        
        switch (result.type) {
          case 'created':
            stats.newCount++;
            logger.info(`新規作成: freeDealId ${result.freeDealId}`);
            break;
          case 'updated':
            stats.updatedCount++;
            logger.info(`更新: freeDealId ${result.freeDealId}`);
            break;
          case 'skipped':
            stats.skippedCount++;
            logger.syncDetail(`スキップ: freeDealId ${result.freeDealId}`);
            break;
          case 'error':
            stats.errorCount++;
            logger.error(`エラー: freeDealId ${result.freeDealId}`, result.error);
            if (result.error) {
              stats.errors.push({
                freeDealId: result.freeDealId,
                error: result.error
              });
            }
            break;
        }
      }
      processTimer.end();

      // 削除処理
      const deleteTimer = new PerformanceTimer('削除処理');
      const freeeIdSet = new Set(deals.map((d: any) => d.id.toString()));
      const deleteResult = await processDeletedTransactions(
        existingTransactions,
        freeeIdSet,
        tx
      );
      deleteTimer.end();
      
      stats.deletedCount = deleteResult.deletedCount;
      stats.errors.push(...deleteResult.errors);

      logger.info(`削除処理完了: ${stats.deletedCount}件`);

      return stats;
    });

    return result;
  } finally {
    timer.end();
  }
}