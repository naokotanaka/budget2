import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

// 全予算項目一覧取得
export const GET: RequestHandler = async () => {
  try {
    const budgetItems = await prisma.budgetItem.findMany({
      include: {
        allocations: {
          include: {
            transaction: {
              select: {
                date: true
              }
            }
          }
        },
        grant: {
          select: { 
            id: true,
            name: true, 
            status: true,
            startDate: true,
            endDate: true
          }
        }
      },
      orderBy: [
        { grant: { name: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
    
    // 統計情報を計算
    const budgetItemsWithStats = budgetItems.map(item => {
      const usedAmount = item.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      
      // 月別使用額を計算
      const monthlyUsedAmounts: { [key: string]: number } = {};
      item.allocations.forEach(alloc => {
        if (alloc.transaction && alloc.transaction.date) {
          const date = new Date(alloc.transaction.date);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
          
          monthlyUsedAmounts[monthKey] = (monthlyUsedAmounts[monthKey] || 0) + alloc.amount;
        }
      });
      
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        budgetedAmount: item.budgetedAmount,
        note: item.note,
        grantId: item.grantId,
        usedAmount,
        monthlyUsedAmounts,
        allocationsCount: item.allocations.length,
        grantName: item.grant.name,
        grantStatus: item.grant.status,
        grantStartDate: item.grant.startDate,
        grantEndDate: item.grant.endDate
      };
    });
    
    console.log('全予算項目取得完了:', budgetItemsWithStats.length, '件');
    
    return json({
      success: true,
      budgetItems: budgetItemsWithStats,
      count: budgetItemsWithStats.length
    });
    
  } catch (error: unknown) {
    console.error('全予算項目一覧取得エラー:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    return json({
      success: false,
      error: '予算項目データの取得に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
};