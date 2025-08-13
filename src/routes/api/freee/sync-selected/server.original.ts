import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';
import {
  bigIntToString,
  safeBigInt,
  normalizeString,
  hasTransactionChanged,
  createTransactionDataFromDeal,
  isDebugEnabled,
  type SyncStats
} from '$lib/utils/freee-sync';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { deals, companyId } = await request.json();
    
    if (!deals || deals.length === 0) {
      return json({ 
        success: false, 
        error: '同期するデータが選択されていません' 
      }, { status: 400 });
    }

    const enableDebug = isDebugEnabled();
    
    if (enableDebug) {
      console.log(`=== 選択されたデータの同期開始: ${deals.length}件 ===`);
      
      // 8/10のデータが含まれているか確認
      const aug10Deals = deals.filter((d: any) => d.issue_date && d.issue_date.includes('08-10'));
      console.log(`8/10のデータ: ${aug10Deals.length}件`);
      if (aug10Deals.length > 0) {
        console.log('8/10のfreeDealIds:', aug10Deals.map((d: any) => d.id));
      }
    }

    // トランザクション処理でデータ整合性を保つ
    const result = await prisma.$transaction(async (tx) => {
      // freee IDのリストを作成
      const dealIds = deals.map((d: any) => safeBigInt(d.id));
      
      // 既存の取引データを全て取得（比較用）
      const existingTransactions = await tx.transaction.findMany({
        where: {
          freeDealId: {
            in: dealIds
          }
        }
      });
      
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
      for (const deal of deals) {
        try {
          // freee dealからトランザクションデータを生成
          let newTransactionData = createTransactionDataFromDeal(deal);

          const dealIdStr = deal.id.toString();
          const existingTransaction = existingMap.get(dealIdStr);
          
          // 取引先名と勘定科目名の解決（既存データがあれば優先）
          if (existingTransaction) {
            if (existingTransaction.supplier && 
                existingTransaction.supplier !== '取引先未設定' && 
                !existingTransaction.supplier.includes('ID:')) {
              newTransactionData.supplier = normalizeString(existingTransaction.supplier);
            }
            
            if (existingTransaction.account && 
                existingTransaction.account !== '勘定科目未設定' && 
                !existingTransaction.account.includes('ID:')) {
              newTransactionData.account = normalizeString(existingTransaction.account);
            }
          }
          
          // 8/10のデータの詳細デバッグ
          if (enableDebug && deal.issue_date && deal.issue_date.includes('08-10')) {
            console.log('\n=== 8/10データ詳細デバッグ ===');
            console.log(`freeDealId: ${dealIdStr}`);
            console.log(`issue_date: ${deal.issue_date}`);
            console.log(`既存データ: ${existingTransaction ? 'あり' : 'なし'}`);
            
            console.log('\n[freee元データ]');
            console.log('deal.ref_number:', deal.ref_number);
            console.log('deal.memo:', deal.memo);
            console.log('deal.partner_name:', deal.partner_name);
            console.log('deal.amount:', deal.amount);
            console.log('deal.details[0].account_item_name:', deal.details?.[0]?.account_item_name);
            console.log('deal.details[0].description:', deal.details?.[0]?.description);
            console.log('deal.details[0].amount:', deal.details?.[0]?.amount);
            
            if (existingTransaction) {
              console.log('\n[既存DBデータ]');
              console.log('date:', existingTransaction.date, '(型:', typeof existingTransaction.date, ')');
              console.log('amount:', existingTransaction.amount, '(型:', typeof existingTransaction.amount, ')');
              console.log('description:', JSON.stringify(existingTransaction.description));
              console.log('account:', JSON.stringify(existingTransaction.account));
              console.log('supplier:', JSON.stringify(existingTransaction.supplier));
              console.log('memo:', JSON.stringify(existingTransaction.memo));
              
              console.log('\n[新データ(newTransactionData)]');
              console.log('date:', newTransactionData.date, '(型:', typeof newTransactionData.date, ')');
              console.log('amount:', newTransactionData.amount, '(型:', typeof newTransactionData.amount, ')');
              console.log('description:', JSON.stringify(newTransactionData.description));
              console.log('account:', JSON.stringify(newTransactionData.account));
              console.log('supplier:', JSON.stringify(newTransactionData.supplier));
              console.log('memo:', JSON.stringify(newTransactionData.memo));
            }
            console.log('=== 8/10デバッグ終了 ===\n');
          }

          if (existingTransaction) {
            // 既存データと比較して更新が必要かチェック
            if (hasTransactionChanged(existingTransaction, newTransactionData, enableDebug)) {
              // 更新処理
              await tx.transaction.update({
                where: { id: existingTransaction.id },
                data: {
                  ...newTransactionData,
                  updatedAt: new Date()
                }
              });
              stats.updatedCount++;
              
              if (enableDebug) {
                console.log(`更新: freee ID ${deal.id} - ${newTransactionData.account} - ¥${newTransactionData.amount.toLocaleString()}`);
              }
            } else {
              // 変更なし
              stats.skippedCount++;
              if (enableDebug) {
                console.log(`スキップ (変更なし): freee ID ${deal.id}`);
              }
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
            stats.newCount++;
            
            if (enableDebug) {
              console.log(`新規作成: ${deal.issue_date} - ${newTransactionData.account} - ¥${newTransactionData.amount.toLocaleString()}`);
            }
          }

        } catch (error) {
          if (enableDebug) {
            console.error(`エラー (freee ID ${deal.id}):`, error);
          }
          stats.errorCount++;
          stats.errors.push({
            freeDealId: deal.id.toString(),
            error: (error as Error).message
          });
        }
      }

      // 削除処理: freeeから削除されたデータをローカルDBからも削除
      
      // freeeにない既存データを探す
      const freeeIdSet = new Set(deals.map((d: any) => d.id.toString()));
      const toDelete = existingTransactions.filter(
        t => t.freeDealId && !freeeIdSet.has(t.freeDealId.toString())
      );

      if (toDelete.length > 0 && enableDebug) {
        console.log(`削除対象: ${toDelete.length}件`);
      }
      
      for (const transaction of toDelete) {
        try {
          // 関連するAllocationSplitも自動削除される（CASCADE設定）
          await tx.transaction.delete({
            where: { id: transaction.id }
          });
          stats.deletedCount++;
          
          if (enableDebug) {
            console.log(`削除: freee ID ${transaction.freeDealId} - ${transaction.description}`);
          }
        } catch (error) {
          if (enableDebug) {
            console.error(`削除エラー (freee ID ${transaction.freeDealId}):`, error);
          }
          stats.errors.push({
            freeDealId: transaction.freeDealId?.toString() || 'unknown',
            error: `削除エラー: ${(error as Error).message}`
          });
        }
      }

      return stats;
    });

    const resultMessage = `
同期完了:
- 選択: ${result.selected}件
- 新規作成: ${result.newCount}件
- 更新: ${result.updatedCount}件
- スキップ (変更なし): ${result.skippedCount}件
- 削除: ${result.deletedCount}件
- エラー: ${result.errorCount}件
    `.trim();

    if (enableDebug) {
      console.log('=== 同期完了 ===');
      console.log(resultMessage);
    }

    const responseData = {
      success: true,
      message: resultMessage,
      stats: {
        selected: result.selected,
        created: result.newCount,
        updated: result.updatedCount,
        skipped: result.skippedCount,
        deleted: result.deletedCount,
        errors: result.errorCount
      },
      errors: result.errors.length > 0 ? result.errors : undefined
    };

    return json(bigIntToString(responseData));

  } catch (error) {
    const enableDebug = isDebugEnabled();
    if (enableDebug) {
      console.error('選択同期エラー:', error);
    }
    const errorResponse = { 
      success: false, 
      error: `同期処理でエラーが発生しました: ${(error as Error).message}` 
    };
    return json(bigIntToString(errorResponse), { status: 500 });
  }
};;