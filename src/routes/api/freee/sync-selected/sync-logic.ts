import type { PrismaClient, Transaction } from '@prisma/client';
import { 
  safeBigInt, 
  createTransactionData, 
  hasTransactionChanged 
} from './helpers';
import { logger, PerformanceTimer } from './logger';
import { FreeeAPIClient } from '$lib/freee/client';
import { prisma } from '$lib/database';

// freee API設定を取得
function getFreeeConfig() {
  return {
    clientId: process.env.FREEE_CLIENT_ID || '',
    clientSecret: process.env.FREEE_CLIENT_SECRET || '',
    redirectUri: process.env.FREEE_REDIRECT_URI || 'https://nagaiku.top/budget2/auth/freee/callback',
    baseUrl: process.env.FREEE_BASE_URL || 'https://api.freee.co.jp'
  };
}

/**
 * 会社IDとアクセストークンを取得
 */
async function getFreeeCredentials(): Promise<{ companyId: number; accessToken: string } | null> {
  try {
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      logger.error('freee トークンが見つからないか期限切れです');
      return null;
    }
    
    const client = new FreeeAPIClient(getFreeeConfig());
    const companies = await client.getCompanies(tokenRecord.accessToken);
    
    if (companies.length === 0) {
      logger.error('アクセス可能な会社が見つかりません');
      return null;
    }
    
    return {
      companyId: companies[0].id,
      accessToken: tokenRecord.accessToken
    };
  } catch (error: any) {
    logger.error('freee認証情報取得エラー:', error);
    return null;
  }
}

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
  tx: any,
  tagMap?: Map<number, string>,
  receiptsMap?: Map<number, number[]>
): Promise<ProcessResult> {
  try {
    const newTransactionData = createTransactionData(deal, tagMap, receiptsMap);
    const freeDealId = deal.id.toString();
    
    // 明細IDを取得（freee APIの構造により、最初の明細のIDを使用）
    const detailId = deal.details?.[0]?.id;

    if (existingTransaction) {
      // 常に更新（変更チェックなし）
      await tx.transaction.update({
        where: { id: existingTransaction.id },
        data: {
          ...newTransactionData,
          updatedAt: new Date()
        }
      });
      
      // 既存の割当を明細IDで検索して紐付け（detailIdがNULLの割当を更新）
      if (detailId) {
        const existingAllocations = await tx.allocationSplit.findMany({
          where: { 
            detailId: null // まだ明細IDが設定されていない割当
          }
        });
        
        // 該当する割当があれば、最初に見つかったものを紐付け
        // TODO: より精密なマッチングロジックが必要な場合は要検討
        if (existingAllocations.length > 0) {
          // 金額や日付でマッチングする場合はここにロジックを追加
          logger.info(`未紐付けの割当が${existingAllocations.length}件見つかりました。明細ID ${detailId} の取引と照合中...`);
        }
      }
      
      return { type: 'updated', freeDealId };
    } else {
      // 新規作成
      const transactionData = {
        id: `freee_${deal.id}_${Date.now()}`,
        ...newTransactionData
      };

      const created = await tx.transaction.create({
        data: transactionData
      });
      
      // 既存の割当を明細IDで検索して紐付け（detailIdがNULLの割当を更新）
      if (detailId) {
        const existingAllocations = await tx.allocationSplit.findMany({
          where: { 
            detailId: null // まだ明細IDが設定されていない割当
          }
        });
        
        // 該当する割当があれば、最初に見つかったものを紐付け
        // TODO: より精密なマッチングロジックが必要な場合は要検討
        if (existingAllocations.length > 0) {
          // 金額や日付でマッチングする場合はここにロジックを追加
          logger.info(`未紐付けの割当が${existingAllocations.length}件見つかりました。明細ID ${detailId} の取引と照合中...`);
        }
      }
      
      return { type: 'created', freeDealId };
    }
  } catch (error: any) {
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
    } catch (error: any) {
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
    // タグマップとレシートマップを取得（同期処理の前に一度だけ取得）
    let tagMap: Map<number, string> | undefined;
    let receiptsMap: Map<number, number[]> | undefined;
    
    try {
      const credentials = await getFreeeCredentials();
      if (credentials) {
        const client = new FreeeAPIClient(getFreeeConfig());
        
        // タグマップ取得
        const tags = await client.getTags(credentials.accessToken, credentials.companyId);
        tagMap = new Map(tags.map(tag => [tag.id, tag.name]));
        logger.info(`タグマップ取得: ${tagMap.size}件`);
        
        // 各取引のgetDealDetailを並列で呼び出してreceipt_idsを取得
        logger.info(`=== receipt_ids取得開始: ${deals.length}件の取引 ===`);
        
        // バッチサイズを10に設定（API制限を考慮）
        const batchSize = 10;
        let totalReceiptIds = 0;
        
        for (let i = 0; i < deals.length; i += batchSize) {
          const batch = deals.slice(i, Math.min(i + batchSize, deals.length));
          const batchPromises = batch.map(async (deal, index) => {
            const dealIndex = i + index;
            try {
              logger.info(`[${dealIndex+1}/${deals.length}] Deal ${deal.id} の詳細取得中...`);
              const dealDetail = await client.getDealDetail(
                credentials.accessToken,
                credentials.companyId,
                deal.id
              );
              
              // freee APIのreceiptsで��なくreceiptsディレクトリを返す
              if (dealDetail && dealDetail.receipts && Array.isArray(dealDetail.receipts) && dealDetail.receipts.length > 0) {
                // receipts配列からIDを抽出
                const receiptIds = dealDetail.receipts.map((r: any) => r.id);
                deals[dealIndex].receipt_ids = receiptIds;
                totalReceiptIds += receiptIds.length;
                logger.info(`✓ Deal ${deal.id}: ${receiptIds.length}件のレシートID取得 => ${JSON.stringify(receiptIds)}`);
              } else {
                logger.info(`- Deal ${deal.id}: レシートなし`);
              }
            } catch (error: any) {
              logger.error(`Deal ${deal.id} の詳細取得エラー:`, error);
              // エラーがあっても処理を続行
            }
          });
          
          // バッチ内の処理を並列実行
          await Promise.all(batchPromises);
          
          // API制限回避のため待機（バッチごと）
          if (i + batchSize < deals.length) {
            logger.info(`API制限回避のため300ms待機...`);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        logger.info(`=== receipt_ids取得完了: 合計${totalReceiptIds}件のレシートID ===`);
      } else {
        logger.warn('freee認証情報が取得できないため、タグマップなしで処理を続行');
      }
    } catch (error: any) {
      logger.error('マップ取得エラー:', error);
      logger.warn('タグマップなしで処理を続行');
    }
    
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

      // 各dealを処理（支出のみ）
      const processTimer = new PerformanceTimer('取引処理');
      for (const deal of deals) {
        // 支出取引のみ処理（収入はスキップ）
        if (deal.type === 'income' || (deal.amount && deal.amount > 0 && deal.type !== 'expense')) {
          logger.info(`収入取引をスキップ: freeDealId ${deal.id}, type: ${deal.type}, amount: ${deal.amount}`);
          stats.skippedCount++;
          continue;
        }
        
        const dealIdStr = deal.id.toString();
        const existingTransaction = existingMap.get(dealIdStr);
        
        logger.syncDetail(`処理中: freeDealId ${dealIdStr}`);
        
        const result = await processSingleDeal(deal, existingTransaction, tx, tagMap, receiptsMap);
        
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