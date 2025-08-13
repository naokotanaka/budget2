import type { PageServerLoad } from './$types';
import { prisma } from '$lib/database';

export const load: PageServerLoad = async () => {
  // 取引とその割当情報を取得
  const transactionsWithAllocations = await prisma.transaction.findMany({
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

  // 助成金を取得
  const grants = await prisma.grant.findMany({
    orderBy: {
      id: 'asc'
    }
  });

  return {
    transactions: transactionsWithAllocations,
    budgetItems: budgetItemsWithCalculations,
    grants
  };
};