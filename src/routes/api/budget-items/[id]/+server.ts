import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

// 予算項目詳細取得
export const GET: RequestHandler = async ({ params }) => {
  try {
    const budgetItemId = parseInt(params.id);
    
    if (isNaN(budgetItemId)) {
      return json({
        success: false,
        error: '無効なIDです'
      }, { status: 400 });
    }
    
    const budgetItem = await prisma.budgetItem.findUnique({
      where: { id: budgetItemId },
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
    
    const totalAllocated = budgetItem.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    
    return json({
      success: true,
      budgetItem: {
        id: budgetItem.id,
        name: budgetItem.name,
        category: budgetItem.category,
        budgetedAmount: budgetItem.budgetedAmount,
        note: budgetItem.note,
        grantId: budgetItem.grantId,
        totalAllocated,
        allocationCount: budgetItem.allocations.length,
        grantName: budgetItem.grant.name,
        grantStatus: budgetItem.grant.status,
        createdAt: budgetItem.createdAt.toISOString(),
        updatedAt: budgetItem.updatedAt.toISOString()
      }
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

// 予算項目部分更新（PATCH）
export const PATCH: RequestHandler = async ({ params, request }) => {
  try {
    const budgetItemId = parseInt(params.id);
    
    if (isNaN(budgetItemId)) {
      return json({
        success: false,
        error: '無効なIDです'
      }, { status: 400 });
    }
    
    const body = await request.json();
    const { name, category, budgetedAmount, note } = body;
    
    // 部分更新用のデータオブジェクトを構築
    const updateData: any = {};
    
    if (name !== undefined) {
      if (!name || name.trim() === '') {
        return json({
          success: false,
          error: '予算項目名は必須です'
        }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    
    if (category !== undefined) {
      updateData.category = category?.trim() || null;
    }
    
    if (budgetedAmount !== undefined) {
      const amount = parseFloat(budgetedAmount);
      if (isNaN(amount) || amount < 0) {
        return json({
          success: false,
          error: '予算額は0以上の数値で入力してください'
        }, { status: 400 });
      }
      updateData.budgetedAmount = amount;
    }
    
    if (note !== undefined) {
      updateData.note = note?.trim() || null;
    }
    
    // 更新するフィールドがない場合
    if (Object.keys(updateData).length === 0) {
      return json({
        success: false,
        error: '更新するデータがありません'
      }, { status: 400 });
    }
    
    // データベース更新
    const budgetItem = await prisma.budgetItem.update({
      where: { id: budgetItemId },
      data: updateData,
      include: {
        grant: {
          select: { name: true, status: true }
        }
      }
    });
    
    console.log('予算項目部分更新完了:', budgetItem.id, '更新フィールド:', Object.keys(updateData));
    
    return json({
      success: true,
      message: '予算項目を更新しました',
      budgetItem: {
        id: budgetItem.id,
        name: budgetItem.name,
        category: budgetItem.category,
        budgetedAmount: budgetItem.budgetedAmount,
        note: budgetItem.note,
        grantId: budgetItem.grantId,
        grantName: budgetItem.grant.name,
        grantStatus: budgetItem.grant.status,
        updatedAt: budgetItem.updatedAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('予算項目部分更新エラー:', error);
    
    if (error.code === 'P2025') {
      return json({
        success: false,
        error: '予算項目が見つかりません'
      }, { status: 404 });
    }
    
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
    const budgetItemId = parseInt(params.id);
    
    if (isNaN(budgetItemId)) {
      return json({
        success: false,
        error: '無効なIDです'
      }, { status: 400 });
    }
    
    // 削除前に項目が存在するかチェック
    const existingItem = await prisma.budgetItem.findUnique({
      where: { id: budgetItemId },
      include: {
        _count: {
          select: { allocations: true }
        }
      }
    });
    
    if (!existingItem) {
      return json({
        success: false,
        error: '予算項目が見つかりません'
      }, { status: 404 });
    }
    
    // 割当がある場合は削除を拒否
    if (existingItem._count.allocations > 0) {
      return json({
        success: false,
        error: `この予算項目には${existingItem._count.allocations}件の予算割当が存在します。先に割当を削除してから予算項目を削除してください。`
      }, { status: 400 });
    }
    
    // 削除実行
    await prisma.budgetItem.delete({
      where: { id: budgetItemId }
    });
    
    console.log('予算項目削除完了:', budgetItemId, existingItem.name);
    
    return json({
      success: true,
      message: `予算項目「${existingItem.name}」を削除しました`
    });
    
  } catch (error) {
    console.error('予算項目削除エラー:', error);
    
    if (error.code === 'P2025') {
      return json({
        success: false,
        error: '予算項目が見つかりません'
      }, { status: 404 });
    }
    
    return json({
      success: false,
      error: '予算項目の削除に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};