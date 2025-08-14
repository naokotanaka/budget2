import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

// 予算項目詳細取得
export const GET: RequestHandler = async ({ params }) => {
  try {
    const grantId = parseInt(params.id);
    const budgetItemId = parseInt(params.budgetItemId);
    
    if (isNaN(grantId) || isNaN(budgetItemId)) {
      return json({
        success: false,
        error: '無効なIDです'
      }, { status: 400 });
    }
    
    const budgetItem = await prisma.budgetItem.findFirst({
      where: { 
        id: budgetItemId,
        grantId
      },
      include: {
        allocations: {
          include: {
            transaction: true
          },
          orderBy: { createdAt: 'desc' }
        },
        grant: {
          select: { name: true, status: true }
        }
      }
    });
    
    if (!budgetItem) {
      return json({
        success: false,
        error: '予算項目が見つかりません'
      }, { status: 404 });
    }
    
    const usedAmount = budgetItem.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    
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
        usedAmount,
        allocationsCount: budgetItem.allocations.length,
        grantName: budgetItem.grant.name,
        grantStatus: budgetItem.grant.status
      },
      allocations: budgetItem.allocations.map(alloc => ({
        id: alloc.id,
        amount: alloc.amount,
        note: alloc.note,
        createdAt: alloc.createdAt.toISOString(),
        transaction: {
          id: alloc.transaction.id,
          date: alloc.transaction.date.toISOString(),
          description: alloc.transaction.description,
          amount: alloc.transaction.amount,
          account: alloc.transaction.account,
          supplier: alloc.transaction.supplier
        }
      }))
    });
    
  } catch (error) {
    console.error('予算項目詳細取得エラー:', error);
    
    return json({
      success: false,
      error: '予算項目詳細の取得に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

// 予算項目更新
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const grantId = parseInt(params.id);
    const budgetItemId = parseInt(params.budgetItemId);
    
    if (isNaN(grantId) || isNaN(budgetItemId)) {
      return json({
        success: false,
        error: '無効なIDです'
      }, { status: 400 });
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
    
    const budgetItem = await prisma.budgetItem.update({
      where: { 
        id: budgetItemId,
        grantId // 安全性のため助成金IDも確認
      },
      data: {
        name: name.trim(),
        category: category?.trim() || null,
        budgetedAmount: budgetedAmount ? parseInt(budgetedAmount) : null,
        note: note?.trim() || null
      }
    });
    
    console.log('予算項目更新完了:', budgetItem.id, budgetItem.name);
    
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
        updatedAt: budgetItem.updatedAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('予算項目更新エラー:', error);
    
    return json({
      success: false,
      error: '予算項目の更新に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

// 予算項目削除
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const grantId = parseInt(params.id);
    const budgetItemId = parseInt(params.budgetItemId);
    
    if (isNaN(grantId) || isNaN(budgetItemId)) {
      return json({
        success: false,
        error: '無効なIDです'
      }, { status: 400 });
    }
    
    // 予算項目が存在するかチェック
    const existingBudgetItem = await prisma.budgetItem.findFirst({
      where: { 
        id: budgetItemId,
        grantId // 安全性のため助成金IDも確認
      },
      include: {
        allocations: true,
        schedules: true
      }
    });
    
    if (!existingBudgetItem) {
      return json({
        success: false,
        error: '予算項目が見つかりません'
      }, { status: 404 });
    }
    
    // 削除前の統計情報を取得（ログ用）
    const allocationsCount = existingBudgetItem.allocations.length;
    const schedulesCount = existingBudgetItem.schedules.length;
    
    // トランザクションで予算項目とすべての関連データを削除
    // onDelete: Cascade により、allocations, schedules は自動削除される
    await prisma.budgetItem.delete({
      where: { 
        id: budgetItemId,
        grantId // 安全性のため助成金IDも確認
      }
    });
    
    console.log('予算項目削除完了:', {
      budgetItemId,
      budgetItemName: existingBudgetItem.name,
      grantId,
      deletedAllocations: allocationsCount,
      deletedSchedules: schedulesCount
    });
    
    return json({
      success: true,
      message: '予算項目と関連するデータをすべて削除しました',
      deletedData: {
        allocations: allocationsCount,
        schedules: schedulesCount
      }
    });
    
  } catch (error) {
    console.error('予算項目削除エラー:', error);
    
    return json({
      success: false,
      error: '予算項目の削除に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};;