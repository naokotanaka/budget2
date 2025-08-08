/**
 * レガシー割当データのインポートAPI
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ConvertedAllocationData } from '$lib/types/legacy-csv';
import { prisma } from '$lib/database';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { allocations, preserveLegacyIds } = await request.json() as {
      allocations: ConvertedAllocationData[];
      preserveLegacyIds?: boolean;
    };

    if (!allocations || !Array.isArray(allocations)) {
      return json({ error: '割当データが不正です' }, { status: 400 });
    }

    let imported = 0;
    const errors: string[] = [];

    // トランザクション開始
    await prisma.query('BEGIN');

    try {
      for (const allocation of allocations) {
        try {
          // 予算項目IDの解決（レガシーIDから新IDへ）
          let budgetItemId = allocation.budgetItemId;
          
          if (!budgetItemId && allocation.legacyBudgetItemId) {
            // レガシー予算項目IDから新しい予算項目IDを取得
            const budgetItemResult = await prisma.query(
              `SELECT bi.id FROM budget_items bi 
               LEFT JOIN budget_item_metadata bim ON bi.id = bim.budget_item_id 
               WHERE bim.key = 'legacy_id' AND bim.value = $1`,
              [allocation.legacyBudgetItemId]
            );
            
            if (budgetItemResult.rows.length > 0) {
              budgetItemId = budgetItemResult.rows[0].id;
            } else {
              errors.push(`割当ID ${allocation.legacyId}: 予算項目ID ${allocation.legacyBudgetItemId} が見つかりません`);
              continue;
            }
          }

          if (!budgetItemId) {
            errors.push(`割当ID ${allocation.legacyId}: 予算項目IDが指定されていません`);
            continue;
          }

          // 取引データの存在確認
          const transactionResult = await prisma.query(
            'SELECT id FROM transactions WHERE id = $1',
            [allocation.transactionId]
          );

          if (transactionResult.rows.length === 0) {
            errors.push(`割当ID ${allocation.legacyId}: 取引ID ${allocation.transactionId} が存在しません`);
            continue;
          }

          // データの挿入
          const result = await prisma.query(
            `INSERT INTO allocation_splits (
              id,
              "transactionId", 
              "budgetItemId", 
              amount, 
              note,
              "createdAt", 
              "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING id`,
            [
              allocation.id || `legacy_${allocation.legacyId}`,
              allocation.transactionId,
              budgetItemId,
              allocation.amount,
              allocation.note || null
            ]
          );

          if (result.rows.length > 0) {
            imported++;
            
            // レガシーIDの保持が必要な場合
            if (preserveLegacyIds && allocation.legacyId) {
              await prisma.query(
                `INSERT INTO allocation_metadata (allocation_id, key, value) VALUES ($1, 'legacy_id', $2)
                 ON CONFLICT (allocation_id, key) DO UPDATE SET value = $2`,
                [result.rows[0].id, allocation.legacyId]
              );
            }
          }
        } catch (error) {
          console.error('割当インポートエラー:', error);
          errors.push(`割当ID ${allocation.legacyId}: ${error}`);
        }
      }

      await prisma.query('COMMIT');

      return json({
        success: true,
        imported,
        total: allocations.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `割当 ${imported}/${allocations.length} 件をインポートしました`
      });

    } catch (error) {
      await prisma.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('レガシー割当インポートエラー:', error);
    return json(
      { 
        error: 'インポート中にエラーが発生しました', 
        details: String(error) 
      }, 
      { status: 500 }
    );
  }
};