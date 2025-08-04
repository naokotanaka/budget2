import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { prisma } from '$lib/database';
import { 
  FREEE_CLIENT_ID, 
  FREEE_CLIENT_SECRET, 
  FREEE_REDIRECT_URI, 
  FREEE_BASE_URL 
} from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { startDate, endDate, companyId } = await request.json();

    // 保存されたトークンを取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      where: { id: 1 }
    });

    if (!tokenRecord) {
      return json({ 
        success: false, 
        error: 'freeeの認証が必要です。先に認証を完了してください。' 
      }, { status: 401 });
    }

    const client = new FreeeAPIClient({
      clientId: FREEE_CLIENT_ID,
      clientSecret: FREEE_CLIENT_SECRET,
      redirectUri: FREEE_REDIRECT_URI,
      baseUrl: FREEE_BASE_URL
    });

    let accessToken = tokenRecord.accessToken;

    // トークンの有効期限をチェック
    if (new Date() >= tokenRecord.expiresAt) {
      try {
        const newToken = await client.refreshToken(tokenRecord.refreshToken);
        
        // 新しいトークンを保存
        await prisma.freeeToken.update({
          where: { id: tokenRecord.id },
          data: {
            accessToken: newToken.accessToken,
            refreshToken: newToken.refreshToken,
            expiresAt: newToken.expiresAt,
            tokenType: newToken.tokenType,
            scope: newToken.scope
          }
        });

        accessToken = newToken.accessToken;
      } catch (error) {
        return json({ 
          success: false, 
          error: 'トークンの更新に失敗しました。再認証が必要です。' 
        }, { status: 401 });
      }
    }

    // 会社情報を取得（companyIdが指定されていない場合）
    let selectedCompanyId = companyId;
    if (!selectedCompanyId) {
      const companies = await client.getCompanies(accessToken);
      if (companies.length === 0) {
        return json({ 
          success: false, 
          error: 'アクセス可能な会社が見つかりません' 
        }, { status: 400 });
      }
      selectedCompanyId = companies[0].id; // 最初の会社を使用
    }

    // 取引データを取得
    const deals = await client.getDeals(
      accessToken, 
      selectedCompanyId, 
      startDate, 
      endDate,
      500 // 最大500件
    );

    // 同期開始ログを記録
    const syncRecord = await prisma.freeeSync.create({
      data: {
        lastSyncAt: new Date(),
        syncStatus: 'running',
        syncMessage: `同期開始: ${deals.length}件の取引を処理中`,
        recordCount: 0
      }
    });

    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 取引データをデータベースに保存
    for (const deal of deals) {
      try {
        // 既存の取引をチェック
        const existingTransaction = await prisma.transaction.findUnique({
          where: { id: `freee_${deal.id}` }
        });

        if (existingTransaction) {
          // 既存の取引を更新
          await prisma.transaction.update({
            where: { id: `freee_${deal.id}` },
            data: {
              journalNumber: deal.id,
              journalLineNumber: 1,
              date: new Date(deal.issue_date),
              description: deal.description || `${deal.partner_name || '不明'} - ${deal.type === 'income' ? '収入' : '支出'}`,
              amount: Math.abs(deal.amount),
              account: deal.details[0]?.account_item_name || '不明',
              supplier: deal.partner_name,
              department: deal.details[0]?.section_name,
              freeDealId: deal.id,
              updatedAt: new Date()
            }
          });
        } else {
          // 新しい取引を作成
          await prisma.transaction.create({
            data: {
              id: `freee_${deal.id}`,
              journalNumber: deal.id,
              journalLineNumber: 1,
              date: new Date(deal.issue_date),
              description: deal.description || `${deal.partner_name || '不明'} - ${deal.type === 'income' ? '収入' : '支出'}`,
              amount: Math.abs(deal.amount),
              account: deal.details[0]?.account_item_name || '不明',
              supplier: deal.partner_name,
              department: deal.details[0]?.section_name,
              freeDealId: deal.id
            }
          });
        }

        syncedCount++;
      } catch (error) {
        errorCount++;
        errors.push(`取引ID ${deal.id}: ${error.message}`);
        console.error(`取引同期エラー (ID: ${deal.id}):`, error);
      }
    }

    // 同期完了ログを更新
    await prisma.freeeSync.update({
      where: { id: syncRecord.id },
      data: {
        syncStatus: errorCount > 0 ? 'success' : 'success',
        syncMessage: errorCount > 0 
          ? `同期完了（警告あり）: ${syncedCount}件成功, ${errorCount}件エラー`
          : `同期完了: ${syncedCount}件の取引を同期`,
        recordCount: syncedCount
      }
    });

    return json({
      success: true,
      message: `${syncedCount}件の取引を同期しました`,
      syncedCount,
      errorCount,
      errors: errors.slice(0, 10) // 最初の10件のエラーのみ返す
    });

  } catch (error) {
    console.error('freee同期エラー:', error);
    
    // エラーログを記録
    try {
      await prisma.freeeSync.create({
        data: {
          lastSyncAt: new Date(),
          syncStatus: 'error',
          syncMessage: `同期エラー: ${error.message}`,
          recordCount: 0
        }
      });
    } catch (logError) {
      console.error('エラーログ記録失敗:', logError);
    }

    return json({ 
      success: false, 
      error: `同期処理でエラーが発生しました: ${error.message}` 
    }, { status: 500 });
  }
};