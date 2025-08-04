import { prisma } from '$lib/database';
import { FreeeAPIClient } from '$lib/freee/client';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID || '';
const FREEE_CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET || '';
const FREEE_REDIRECT_URI = process.env.FREEE_REDIRECT_URI || 'https://nagaiku.top/budget2/auth/freee/callback';
const FREEE_BASE_URL = process.env.FREEE_BASE_URL || 'https://api.freee.co.jp';

export const load: PageServerLoad = async () => {
  try {
    // トークンの取得
    const token = await prisma.freeeToken.findFirst({
      where: { id: 1 }
    });

    if (!token) {
      return {
        authenticated: false,
        message: 'freee連携が設定されていません'
      };
    }

    // トークンの有効期限確認
    const isExpired = new Date() > new Date(token.expiresAt);
    if (isExpired) {
      return {
        authenticated: false,
        isExpired: true,
        message: 'トークンの有効期限が切れています'
      };
    }

    // 最後の同期日時を取得
    const lastSync = await prisma.freeeTransaction.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true }
    });

    return {
      authenticated: true,
      lastSyncAt: lastSync?.syncedAt,
      message: '同期準備完了'
    };
  } catch (error) {
    console.error('同期ページ読み込みエラー:', error);
    return {
      authenticated: false,
      error: error.message,
      message: 'エラーが発生しました'
    };
  }
};

export const actions: Actions = {
  sync: async ({ request }) => {
    try {
      const formData = await request.formData();
      const startDate = formData.get('startDate') as string;
      const endDate = formData.get('endDate') as string;

      // トークンの取得
      const token = await prisma.freeeToken.findFirst({
        where: { id: 1 }
      });

      if (!token) {
        return fail(400, {
          success: false,
          message: 'freee連携が設定されていません'
        });
      }

      const client = new FreeeAPIClient({
        clientId: FREEE_CLIENT_ID,
        clientSecret: FREEE_CLIENT_SECRET,
        redirectUri: FREEE_REDIRECT_URI,
        baseUrl: FREEE_BASE_URL
      });

      // 会社情報を取得
      const companies = await client.getCompanies(token.accessToken);
      if (companies.length === 0) {
        return fail(400, {
          success: false,
          message: 'アクセス可能な会社が見つかりませんでした'
        });
      }

      const companyId = companies[0].id;

      // 取引データを取得
      const deals = await client.getDeals(
        token.accessToken,
        companyId,
        startDate,
        endDate,
        100
      );

      // 既存の取引IDを取得
      const existingTransactionIds = await prisma.freeeTransaction.findMany({
        select: { freeeId: true }
      });
      const existingIds = new Set(existingTransactionIds.map(t => t.freeeId));

      // 新規・更新する取引を分離
      const newDeals = deals.filter(deal => !existingIds.has(deal.id));
      const updateDeals = deals.filter(deal => existingIds.has(deal.id));

      // トランザクション内で処理
      await prisma.$transaction(async (tx) => {
        // 新規取引を作成
        if (newDeals.length > 0) {
          await tx.freeeTransaction.createMany({
            data: newDeals.map(deal => ({
              freeeId: deal.id,
              companyId: deal.company_id,
              issueDate: new Date(deal.issue_date),
              dueDate: deal.due_date ? new Date(deal.due_date) : null,
              amount: deal.amount,
              dueAmount: deal.due_amount || deal.amount,
              type: deal.type,
              partnerName: deal.partner_name,
              refNumber: deal.ref_number,
              description: deal.description,
              syncedAt: new Date()
            }))
          });
        }

        // 既存取引を更新
        for (const deal of updateDeals) {
          await tx.freeeTransaction.update({
            where: { freeeId: deal.id },
            data: {
              issueDate: new Date(deal.issue_date),
              dueDate: deal.due_date ? new Date(deal.due_date) : null,
              amount: deal.amount,
              dueAmount: deal.due_amount || deal.amount,
              type: deal.type,
              partnerName: deal.partner_name,
              refNumber: deal.ref_number,
              description: deal.description,
              syncedAt: new Date()
            }
          });
        }
      });

      return {
        success: true,
        message: `同期完了: ${newDeals.length}件の新規取引、${updateDeals.length}件の更新`,
        newCount: newDeals.length,
        updateCount: updateDeals.length
      };

    } catch (error) {
      console.error('同期エラー:', error);
      return fail(500, {
        success: false,
        message: `同期中にエラーが発生しました: ${error.message}`
      });
    }
  }
};