import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

// 助成金一覧取得
export const GET: RequestHandler = async () => {
  try {
    console.log('=== 助成金一覧取得 ===');
    
    const grants = await prisma.grant.findMany({
      include: {
        budgetItems: {
          include: {
            allocations: true
          }
        }
      }
    });
    
    // 統計情報を計算
    const grantsWithStats = grants.map(grant => {
      const budgetItemsCount = grant.budgetItems.length;
      const usedAmount = grant.budgetItems.reduce((total, item) => {
        const itemUsed = item.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
        return total + itemUsed;
      }, 0);
      
      return {
        id: grant.id,
        name: grant.name,
        grantCode: grant.grantCode,
        totalAmount: grant.totalAmount,
        startDate: grant.startDate?.toISOString(),
        endDate: grant.endDate?.toISOString(),
        status: grant.status,
        createdAt: grant.createdAt.toISOString(),
        updatedAt: grant.updatedAt.toISOString(),
        budgetItemsCount,
        usedAmount
      };
    });
    
    // カスタムソート：稼働中を上に、終了・報告済みを下に
    const sortedGrants = grantsWithStats.sort((a, b) => {
      // 1. ステータスでグループ分け（進行中が最優先）
      const statusPriority = { active: 0, completed: 1, applied: 1 };
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      // 2. 進行中の場合：終了日順（近い順）、次に開始日順（新しい順）
      if (a.status === 'active') {
        if (a.endDate && b.endDate) {
          const endDateDiff = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          if (endDateDiff !== 0) return endDateDiff; // 終了日が近い順
        }
        if (a.startDate && b.startDate) {
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime(); // 開始日が新しい順
        }
      }
      
      // 3. 終了・報告済みの場合：終了日順（新しい順）
      if (a.endDate && b.endDate) {
        return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
      }
      
      // 4. 最後は名前順
      return a.name.localeCompare(b.name);
    });
    
    console.log('助成金取得完了:', sortedGrants.length, '件');
    
    return json({
      success: true,
      grants: sortedGrants,
      count: sortedGrants.length
    });
    
  } catch (error) {
    console.error('助成金一覧取得エラー:', error);
    
    return json({
      success: false,
      error: '助成金データの取得に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

// 新規助成金作成
export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log('=== 新規助成金作成 ===');
    
    const body = await request.json();
    const { name, grantCode, totalAmount, startDate, endDate, status } = body;
    
    // バリデーション
    if (!name || name.trim() === '') {
      return json({
        success: false,
        error: '助成金名は必須です'
      }, { status: 400 });
    }
    
    const grant = await prisma.grant.create({
      data: {
        name: name.trim(),
        grantCode: grantCode?.trim() || null,
        totalAmount: totalAmount ? parseInt(totalAmount) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'active'
      }
    });
    
    console.log('助成金作成完了:', grant.id, grant.name);
    
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
    console.error('助成金作成エラー:', error);
    
    return json({
      success: false,
      error: '助成金の作成に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};