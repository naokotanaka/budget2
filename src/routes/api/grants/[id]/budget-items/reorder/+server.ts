import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

// 予算項目の並び替え
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const grantId = parseInt(params.id);
    
    if (isNaN(grantId)) {
      return json({
        success: false,
        error: '無効な助成金IDです'
      }, { status: 400 });
    }
    
    const body = await request.json();
    const { itemIds } = body; // [1, 3, 2] のような順序配列
    
    if (!Array.isArray(itemIds)) {
      return json({
        success: false,
        error: '無効なデータ形式です'
      }, { status: 400 });
    }
    
    console.log('予算項目並び替え:', { grantId, itemIds });
    
    // トランザクション内で並び順を更新
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < itemIds.length; i++) {
        await tx.budgetItem.update({
          where: { 
            id: itemIds[i],
            grantId // 安全性のため助成金IDも確認
          },
          data: { sortOrder: i }
        });
      }
    });
    
    console.log('予算項目並び替え完了');
    
    return json({
      success: true,
      message: '並び替えが完了しました'
    });
    
  } catch (error) {
    console.error('予算項目並び替えエラー:', error);
    
    return json({
      success: false,
      error: '並び替えに失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};