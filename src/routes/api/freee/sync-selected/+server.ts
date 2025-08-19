import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';
import { bigIntToString, createSyncResult } from './helpers';
import { executeSync } from './sync-logic';

/**
 * freee選択データ同期API
 * 
 * 選択されたfreee取引データをローカルDBと同期する
 * - 新規データの作成
 * - 既存データの更新（変更がある場合のみ）
 * - 変更がないデータのスキップ
 * - freeeから削除されたデータの削除
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { deals, companyId } = await request.json();
    
    // 入力値の検証
    if (!deals || deals.length === 0) {
      return json({ 
        success: false, 
        error: '同期するデータが選択されていません' 
      }, { status: 400 });
    }

    console.log(`=== 選択されたデータの同期開始: ${deals.length}件 ===`);
    
    // 同期処理の実行
    const stats = await executeSync(deals, prisma);

    // 結果の生成
    const responseData = createSyncResult(stats);
    
    console.log('=== 同期完了 ===');
    console.log(responseData.message);

    return json(bigIntToString(responseData));

  } catch (error: any) {
    console.error('選択同期エラー:', error);
    const errorResponse = { 
      success: false, 
      error: `同期処理でエラーが発生しました: ${(error as Error).message}` 
    };
    return json(bigIntToString(errorResponse), { status: 500 });
  }
};