import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/database';

export const load: PageServerLoad = async () => {
  // 【事】【管】勘定科目のフィルタリング
  const transactionsWithAllocations = await prisma.transaction.findMany({
    where: {
      OR: [
        { account: { contains: '【事】' } },
        { account: { contains: '【管】' } },
      ]
    },
    include: {
      allocations: {
        include: {
          budgetItem: {
            include: {
              grant: true
            }
          }
        }
      }
    },
    orderBy: {
      date: 'desc'
    }
  });

  // 全予算項目を取得（割当用）
  const budgetItems = await prisma.budgetItem.findMany({
    include: {
      grant: true,
      schedules: {
        where: {
          isActive: true
        },
        orderBy: [
          { year: 'asc' },
          { month: 'asc' }
        ]
      },
      allocations: true
    },
    orderBy: [
      { grantId: 'asc' },
      { sortOrder: 'asc' },
      { id: 'asc' }
    ]
  });
  
  // 各予算項目の割当済み金額と残額を計算
  const budgetItemsWithCalculations = budgetItems.map(item => {
    const allocatedAmount = item.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    const remaining = (item.budgetedAmount || 0) - allocatedAmount;
    return {
      ...item,
      allocatedAmount,
      remaining
    };
  });

  // 助成金を取得（ステータス情報含む）
  const grants = await prisma.grant.findMany({
    orderBy: [
      { status: 'asc' }, // activeが最初に来るように
      { id: 'asc' }
    ]
  });

  // 取引データに割当状況を追加
  const processedTransactions = transactionsWithAllocations.map(transaction => {
    const allocatedAmount = transaction.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    const unallocatedAmount = transaction.amount - allocatedAmount;
    
    let allocationStatus: 'unallocated' | 'partial' | 'full';
    if (allocatedAmount === 0) {
      allocationStatus = 'unallocated';
    } else if (allocatedAmount < transaction.amount) {
      allocationStatus = 'partial';
    } else {
      allocationStatus = 'full';
    }

    return {
      ...transaction,
      allocatedAmount,
      unallocatedAmount,
      allocationStatus
    };
  });

  // すべての割当を取得（リアルタイム更新用）
  const allocations = await prisma.allocationSplit.findMany({
    include: {
      budgetItem: {
        include: {
          grant: true
        }
      }
    }
  });

  return {
    transactions: processedTransactions,
    budgetItems: budgetItemsWithCalculations,
    grants,
    allocations
  };
};

export const actions: Actions = {
  saveAllocation: async ({ request }) => {
    const data = await request.formData();
    const transactionId = data.get('transactionId') as string;
    const budgetItemId = parseInt(data.get('budgetItemId') as string);
    const amount = parseInt(data.get('amount') as string);
    const note = data.get('note') as string || null;
    const allocationId = data.get('allocationId') as string || null;

    if (!transactionId || !budgetItemId || !amount) {
      return fail(400, { message: '必須項目が入力されていません' });
    }

    try {
      // 取引の詳細IDを取得
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId }
      });

      if (!transaction) {
        return fail(404, { message: '取引が見つかりません' });
      }

      // 既存割当の合計を確認
      const existingAllocations = await prisma.allocationSplit.findMany({
        where: { 
          detailId: transaction.detailId,
          ...(allocationId ? { id: { not: allocationId } } : {})
        }
      });

      const existingTotal = existingAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      
      // 割当額の合計が取引金額を超えないかチェック
      if (existingTotal + amount > transaction.amount) {
        return fail(400, { 
          message: `割当額の合計が取引金額を超えています（合計: ¥${(existingTotal + amount).toLocaleString()}, 取引金額: ¥${transaction.amount.toLocaleString()}）` 
        });
      }

      if (allocationId) {
        // 更新
        await prisma.allocationSplit.update({
          where: { id: allocationId },
          data: {
            budgetItemId,
            amount,
            note
          }
        });
      } else {
        // 新規作成
        await prisma.allocationSplit.create({
          data: {
            detailId: transaction.detailId,
            budgetItemId,
            amount,
            note
          }
        });
      }

      return { success: true };
    } catch (error) {
      console.error('割当保存エラー:', error);
      return fail(500, { message: '割当の保存に失敗しました' });
    }
  },

  deleteAllocation: async ({ request }) => {
    const data = await request.formData();
    const allocationId = data.get('allocationId') as string;

    if (!allocationId) {
      return fail(400, { message: '割当IDが指定されていません' });
    }

    try {
      await prisma.allocationSplit.delete({
        where: { id: allocationId }
      });

      return { success: true };
    } catch (error) {
      console.error('割当削除エラー:', error);
      return fail(500, { message: '割当の削除に失敗しました' });
    }
  },

  bulkAllocation: async ({ request }) => {
    const data = await request.formData();
    const transactionIds = data.getAll('transactionIds') as string[];
    const budgetItemId = parseInt(data.get('budgetItemId') as string);
    const note = data.get('note') as string || null;

    if (!transactionIds.length || !budgetItemId) {
      return fail(400, { message: '必須項目が入力されていません' });
    }

    try {
      // 各取引の未割当金額を取得して一括割当
      const allocations = [];
      
      for (const transactionId of transactionIds) {
        const transaction = await prisma.transaction.findUnique({
          where: { id: transactionId },
          include: { allocations: true }
        });

        if (transaction) {
          const allocatedAmount = transaction.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
          const unallocatedAmount = transaction.amount - allocatedAmount;
          
          if (unallocatedAmount > 0) {
            allocations.push({
              detailId: transaction.detailId,
              budgetItemId,
              amount: unallocatedAmount,
              note
            });
          }
        }
      }

      if (allocations.length > 0) {
        await prisma.allocationSplit.createMany({
          data: allocations
        });
      }

      return { success: true, allocatedCount: allocations.length };
    } catch (error) {
      console.error('一括割当エラー:', error);
      return fail(500, { message: '一括割当の保存に失敗しました' });
    }
  }
};
