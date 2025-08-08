/**
 * レガシー助成金データのインポートAPI
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ConvertedGrantData } from '$lib/types/legacy-csv';
import { prisma } from '$lib/database';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { grants, preserveLegacyIds } = await request.json() as {
      grants: ConvertedGrantData[];
      preserveLegacyIds?: boolean;
    };

    if (!grants || !Array.isArray(grants)) {
      return json({ error: '助成金データが不正です' }, { status: 400 });
    }

    let imported = 0;
    const errors: string[] = [];

    // トランザクション開始
    await prisma.query('BEGIN');

    try {
      for (const grant of grants) {
        try {
          // データの挿入
          const result = await prisma.query(
            `INSERT INTO grants (
              name, 
              "grantCode", 
              "totalAmount", 
              "startDate", 
              "endDate", 
              status, 
              "createdAt", 
              "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING id`,
            [
              grant.name,
              grant.grantCode || null,
              grant.totalAmount || null,
              grant.startDate || null,
              grant.endDate || null,
              grant.status || 'in_progress'
            ]
          );

          if (result.rows.length > 0) {
            imported++;
            
            // レガシーIDの保持が必要な場合
            if (preserveLegacyIds && grant.legacyId) {
              // メタデータテーブルまたはカスタムフィールドにレガシーIDを保存
              await prisma.query(
                `INSERT INTO grant_metadata (grant_id, key, value) VALUES ($1, 'legacy_id', $2)
                 ON CONFLICT (grant_id, key) DO UPDATE SET value = $2`,
                [result.rows[0].id, grant.legacyId]
              );
            }
          }
        } catch (error) {
          console.error('助成金インポートエラー:', error);
          errors.push(`助成金 "${grant.name}": ${error}`);
        }
      }

      await prisma.query('COMMIT');

      return json({
        success: true,
        imported,
        total: grants.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `助成金 ${imported}/${grants.length} 件をインポートしました`
      });

    } catch (error) {
      await prisma.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('レガシー助成金インポートエラー:', error);
    return json(
      { 
        error: 'インポート中にエラーが発生しました', 
        details: String(error) 
      }, 
      { status: 500 }
    );
  }
};