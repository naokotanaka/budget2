/**
 * レガシー予算項目データのインポートAPI
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ConvertedBudgetItemData } from '$lib/types/legacy-csv';
import { prisma } from '$lib/database';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { budgetItems, preserveLegacyIds } = await request.json() as {
      budgetItems: ConvertedBudgetItemData[];
      preserveLegacyIds?: boolean;
    };

    if (!budgetItems || !Array.isArray(budgetItems)) {
      return json({ error: '予算項目データが不正です' }, { status: 400 });
    }

    let imported = 0;
    const errors: string[] = [];

    // トランザクション開始
    await prisma.query('BEGIN');

    try {
      for (const budgetItem of budgetItems) {
        try {
          // 助成金IDの解決（レガシーIDから新IDへ）
          let grantId = budgetItem.grantId;
          
          if (!grantId && budgetItem.legacyGrantId) {
            // レガシー助成金IDから新しい助成金IDを取得
            const grantResult = await prisma.query(
              `SELECT g.id FROM grants g 
               LEFT JOIN grant_metadata gm ON g.id = gm.grant_id 
               WHERE gm.key = 'legacy_id' AND gm.value = $1`,
              [budgetItem.legacyGrantId]
            );
            
            if (grantResult.rows.length > 0) {
              grantId = grantResult.rows[0].id;
            } else {
              errors.push(`予算項目 "${budgetItem.name}": 助成金ID ${budgetItem.legacyGrantId} が見つかりません`);
              continue;
            }
          }

          if (!grantId) {
            errors.push(`予算項目 "${budgetItem.name}": 助成金IDが指定されていません`);
            continue;
          }

          // データの挿入
          const result = await prisma.query(
            `INSERT INTO budget_items (
              name, 
              category, 
              "budgetedAmount", 
              note, 
              "grantId",
              "sortOrder",
              "createdAt", 
              "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING id`,
            [
              budgetItem.name,
              budgetItem.category || null,
              budgetItem.budgetedAmount || null,
              budgetItem.note || null,
              grantId,
              budgetItem.sortOrder || 0
            ]
          );

          if (result.rows.length > 0) {
            imported++;
            
            // レガシーIDの保持が必要な場合
            if (preserveLegacyIds && budgetItem.legacyId) {
              await prisma.query(
                `INSERT INTO budget_item_metadata (budget_item_id, key, value) VALUES ($1, 'legacy_id', $2)
                 ON CONFLICT (budget_item_id, key) DO UPDATE SET value = $2`,
                [result.rows[0].id, budgetItem.legacyId]
              );
            }
          }
        } catch (error) {
          console.error('予算項目インポートエラー:', error);
          errors.push(`予算項目 "${budgetItem.name}": ${error}`);
        }
      }

      await prisma.query('COMMIT');

      return json({
        success: true,
        imported,
        total: budgetItems.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `予算項目 ${imported}/${budgetItems.length} 件をインポートしました`
      });

    } catch (error) {
      await prisma.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('レガシー予算項目インポートエラー:', error);
    return json(
      { 
        error: 'インポート中にエラーが発生しました', 
        details: String(error) 
      }, 
      { status: 500 }
    );
  }
};