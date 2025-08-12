import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';
import { Decimal } from '@prisma/client/runtime/library';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { deals, companyId } = await request.json();
    
    if (!deals || deals.length === 0) {
      return json({ 
        success: false, 
        error: '同期するデータが選択されていません' 
      }, { status: 400 });
    }

    console.log(`=== 選択されたデータの同期開始: ${deals.length}件 ===`);

    // 既存の取引IDを取得（重複チェック用）
    const existingFreeeIds = await prisma.transaction.findMany({
      where: {
        freeeId: {
          in: deals.map((d: any) => d.id)
        }
      },
      select: { freeeId: true }
    });
    const existingIdSet = new Set(existingFreeeIds.map(t => t.freeeId));

    // 取引データを変換して保存
    const transactions = [];
    let skippedCount = 0;
    let errorCount = 0;

    for (const deal of deals) {
      // 重複チェック
      if (existingIdSet.has(deal.id)) {
        console.log(`スキップ (既存): freee ID ${deal.id}`);
        skippedCount++;
        continue;
      }

      // 明細データから金額と勘定科目を取得
      let amount = 0;
      let accountItemId = null;
      let accountItemName = '不明';
      let description = '';

      if (deal.details && deal.details.length > 0) {
        const detail = deal.details[0];
        amount = Math.abs(detail.amount || 0);
        accountItemId = detail.account_item_id || null;
        accountItemName = detail.account_item_name || '不明';
        description = detail.description || '';
      } else if (deal.amount) {
        amount = Math.abs(deal.amount);
      }

      // 取引タイプの判定
      const transactionType = deal.type === 'income' ? 'income' : 'expense';

      // データ作成
      try {
        const transactionData = {
          date: new Date(deal.issue_date),
          amount: new Decimal(amount),
          description: deal.ref_number || deal.memo || description || '',
          type: transactionType,
          accountName: accountItemName,
          freeeId: deal.id,
          freeeAccountItemId: accountItemId,
          freeeCompanyId: companyId || null,
          freeePartnerId: deal.partner_id || null,
          freeePartnerName: deal.partner_name || null,
          freeeDealType: deal.type || null,
          freeeDealStatus: deal.status || null,
          freeeRefNumber: deal.ref_number || null,
          freeeMemo: deal.memo || null,
          freeeCreatedAt: deal.created_at ? new Date(deal.created_at) : null,
          freeeLastUpdatedAt: deal.renew_updated_at ? new Date(deal.renew_updated_at) : null,
          rawData: deal
        };

        transactions.push(transactionData);
        console.log(`準備完了: ${deal.issue_date} - ${accountItemName} - ¥${amount.toLocaleString()}`);
      } catch (error) {
        console.error(`エラー (データ変換): freee ID ${deal.id}`, error);
        errorCount++;
      }
    }

    // データベースに保存
    let savedCount = 0;
    const errors = [];

    for (const transaction of transactions) {
      try {
        await prisma.transaction.create({
          data: transaction
        });
        savedCount++;
      } catch (error) {
        console.error('保存エラー:', error);
        errors.push({
          freeeId: transaction.freeeId,
          error: error.message
        });
      }
    }

    const resultMessage = `
同期完了:
- 選択: ${deals.length}件
- 新規保存: ${savedCount}件
- スキップ（既存）: ${skippedCount}件
- エラー: ${errors.length}件
    `.trim();

    console.log('=== 同期完了 ===');
    console.log(resultMessage);

    return json({
      success: true,
      message: resultMessage,
      stats: {
        selected: deals.length,
        saved: savedCount,
        skipped: skippedCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('選択同期エラー:', error);
    return json({ 
      success: false, 
      error: `同期処理でエラーが発生しました: ${error.message}` 
    }, { status: 500 });
  }
};