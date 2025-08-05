import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

// 予算項目一覧取得
export const GET: RequestHandler = async ({ params }) => {
  try {
    const grantId = parseInt(params.id);
    
    if (isNaN(grantId)) {
      return json({
        success: false,
        error: '無効な助成金IDです'
      }, { status: 400 });
    }
    
    const budgetItems = await prisma.budgetItem.findMany({
      where: { grantId },
      include: {
        allocations: true,
        grant: {
          select: { name: true, status: true }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
    
    // 統計情報を計算
    const budgetItemsWithStats = budgetItems.map(item => {
      const usedAmount = item.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        budgetedAmount: item.budgetedAmount,
        note: item.note,
        usedAmount,
        allocationsCount: item.allocations.length,
        grantName: item.grant.name,
        grantStatus: item.grant.status
      };
    });
    
    console.log('予算項目取得完了:', budgetItemsWithStats.length, '件');
    
    return json({
      success: true,
      budgetItems: budgetItemsWithStats,
      count: budgetItemsWithStats.length
    });
    
  } catch (error) {
    console.error('予算項目一覧取得エラー:', error);
    
    return json({
      success: false,
      error: '予算項目データの取得に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

// 新規予算項目作成
export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const grantId = parseInt(params.id);
    
    if (isNaN(grantId)) {
      return json({
        success: false,
        error: '無効な助成金IDです'
      }, { status: 400 });
    }
    
    // 助成金の存在確認
    const grant = await prisma.grant.findUnique({
      where: { id: grantId }
    });
    
    if (!grant) {
      return json({
        success: false,
        error: '助成金が見つかりません'
      }, { status: 404 });
    }
    
    const body = await request.json();
    const { name, category, budgetedAmount, note } = body;
    
    // バリデーション
    if (!name || name.trim() === '') {
      return json({
        success: false,
        error: '予算項目名は必須です'
      }, { status: 400 });
    }
    
    const budgetItem = await prisma.budgetItem.create({
      data: {
        name: name.trim(),
        category: category?.trim() || null,
        budgetedAmount: budgetedAmount ? parseInt(budgetedAmount) : null,
        note: note?.trim() || null,
        grantId
      }
    });
    
    console.log('予算項目作成完了:', budgetItem.id, budgetItem.name);
    
    return json({
      success: true,
      budgetItem: {
        id: budgetItem.id,
        name: budgetItem.name,
        category: budgetItem.category,
        budgetedAmount: budgetItem.budgetedAmount,
        note: budgetItem.note,
        grantId: budgetItem.grantId,
        createdAt: budgetItem.createdAt.toISOString(),
        updatedAt: budgetItem.updatedAt.toISOString(),
        usedAmount: 0,
        allocationsCount: 0
      }
    });
    
  } catch (error) {
    console.error('予算項目作成エラー:', error);
    
    return json({
      success: false,
      error: '予算項目の作成に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};