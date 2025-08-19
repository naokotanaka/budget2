import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

// 予算項目のスケジュール取得
export const GET: RequestHandler = async ({ params }) => {
  try {
    const budgetItemId = parseInt(params.id);
    
    if (isNaN(budgetItemId)) {
      return json({
        success: false,
        error: '無効な予算項目IDです'
      }, { status: 400 });
    }
    
    const schedules = await prisma.budgetSchedule.findMany({
      where: { 
        budgetItemId,
        isActive: true
      },
      orderBy: [
        { year: 'asc' },
        { month: 'asc' }
      ]
    });
    
    console.log('スケジュール取得完了:', schedules.length, '件');
    
    return json({
      success: true,
      schedules
    });
    
  } catch (error: any) {
    console.error('スケジュール取得エラー:', error);
    
    return json({
      success: false,
      error: 'スケジュールデータの取得に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

// 予算項目のスケジュール更新
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const budgetItemId = parseInt(params.id);
    
    if (isNaN(budgetItemId)) {
      return json({
        success: false,
        error: '無効な予算項目IDです'
      }, { status: 400 });
    }
    
    const body = await request.json();
    const { schedules } = body;
    
    if (!Array.isArray(schedules)) {
      return json({
        success: false,
        error: '無効なスケジュールデータです'
      }, { status: 400 });
    }
    
    console.log('スケジュール更新:', { budgetItemId, schedules });
    
    // トランザクション内でスケジュールを更新
    await prisma.$transaction(async (tx) => {
      // 既存のスケジュールを削除
      await tx.budgetSchedule.deleteMany({
        where: { budgetItemId }
      });
      
      // 新しいスケジュールを作成
      if (schedules.length > 0) {
        await tx.budgetSchedule.createMany({
          data: schedules.map((schedule: any) => ({
            budgetItemId,
            year: schedule.year,
            month: schedule.month,
            isActive: schedule.isActive,
            monthlyBudget: schedule.monthlyBudget
          }))
        });
      }
    });
    
    console.log('スケジュール更新完了');
    
    return json({
      success: true,
      message: 'スケジュールが更新されました'
    });
    
  } catch (error: any) {
    console.error('スケジュール更新エラー:', error);
    
    return json({
      success: false,
      error: 'スケジュールの更新に失敗しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};