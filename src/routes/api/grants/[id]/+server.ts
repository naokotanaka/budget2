import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

// 助成金詳細取得
export const GET: RequestHandler = async ({ params }) => {
  try {
    const grantId = parseInt(params.id);
    
    if (isNaN(grantId)) {
      return json({
        success: false,
        error: '無効な助成金IDです'
      }, { status: 400 });
    }
    
    const grant = await prisma.grant.findUnique({
      where: { id: grantId },
      include: {
        budgetItems: {
          include: {
            allocations: true
          },
          orderBy: { name: 'asc' }
        }
      }
    });
    
    if (!grant) {
      return json({
        success: false,
        error: '助成金が見つかりません'
      }, { status: 404 });
    }
    
    // 統計情報を計算
    const usedAmount = grant.budgetItems.reduce((total, item) => {
      const itemUsed = item.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      return total + itemUsed;
    }, 0);
    
    const budgetItems = grant.budgetItems.map(item => {
      const itemUsedAmount = item.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        budgetedAmount: item.budgetedAmount,
        note: item.note,
        usedAmount: itemUsedAmount,
        allocationsCount: item.allocations.length
      };
    });
    
    return json({
      success: true,
      grant: {
        id: grant.id,
        name: grant.name,
        grantCode: grant.grantCode,
        totalAmount: grant.totalAmount,
        startDate: grant.startDate?.toISOString(),
        endDate: grant.endDate?.toISOString(),
        status: grant.status,
        createdAt: grant.createdAt.toISOString(),
        updatedAt: grant.updatedAt.toISOString(),
        usedAmount,
        budgetItemsCount: grant.budgetItems.length
      },
      budgetItems
    });
    
  } catch (error) {
    console.error('助成金詳細取得エラー:', error);
    
    return json({
      success: false,
      error: '助成金詳細の取得に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

// 助成金更新
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
    const { name, grantCode, totalAmount, startDate, endDate, status } = body;
    
    // バリデーション
    if (!name || name.trim() === '') {
      return json({
        success: false,
        error: '助成金名は必須です'
      }, { status: 400 });
    }
    
    const grant = await prisma.grant.update({
      where: { id: grantId },
      data: {
        name: name.trim(),
        grantCode: grantCode?.trim() || null,
        totalAmount: totalAmount ? parseInt(totalAmount) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'in_progress'
      }
    });
    
    console.log('助成金更新完了:', grant.id, grant.name);
    
    return json({
      success: true,
      grant: {
        id: grant.id,
        name: grant.name,
        grantCode: grant.grantCode,
        totalAmount: grant.totalAmount,
        startDate: grant.startDate?.toISOString(),
        endDate: grant.endDate?.toISOString(),
        status: grant.status,
        createdAt: grant.createdAt.toISOString(),
        updatedAt: grant.updatedAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('助成金更新エラー:', error);
    
    return json({
      success: false,
      error: '助成金の更新に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

// 助成金削除
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const grantId = parseInt(params.id);
    
    if (isNaN(grantId)) {
      return json({
        success: false,
        error: '無効な助成金IDです'
      }, { status: 400 });
    }
    
    // 予算項目がある場合は削除を拒否
    const budgetItemsCount = await prisma.budgetItem.count({
      where: { grantId }
    });
    
    if (budgetItemsCount > 0) {
      return json({
        success: false,
        error: '予算項目が存在するため削除できません。先に予算項目を削除してください。'
      }, { status: 400 });
    }
    
    await prisma.grant.delete({
      where: { id: grantId }
    });
    
    console.log('助成金削除完了:', grantId);
    
    return json({
      success: true,
      message: '助成金を削除しました'
    });
    
  } catch (error) {
    console.error('助成金削除エラー:', error);
    
    return json({
      success: false,
      error: '助成金の削除に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};