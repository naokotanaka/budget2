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
    // Prismaクライアントの初期化を確認
    if (!prisma) {
      console.error('Prismaクライアントが初期化されていません');
      return {
        authenticated: false,
        message: 'データベース接続エラーが発生しました'
      };
    }

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

    // 会社情報を取得してデフォルトの会社を表示用に取得
    let companyName = '特定非営利活動法人ながいく';
    try {
      const client = new FreeeAPIClient({
        clientId: FREEE_CLIENT_ID,
        clientSecret: FREEE_CLIENT_SECRET,
        redirectUri: FREEE_REDIRECT_URI,
        baseUrl: FREEE_BASE_URL
      });

      const companies = await client.getCompanies(token.accessToken);
      if (companies.length > 0) {
        // 「特定非営利活動法人ながいく」を検索、なければ最初の会社
        const nagaikuCompany = companies.find(c => 
          c.name.includes('ながいく') || c.name.includes('nagaiku')
        );
        companyName = nagaikuCompany ? nagaikuCompany.name : companies[0].name;
      }
    } catch (error: any) {
      console.warn('会社情報取得に失敗しましたがデフォルト名を使用します:', error);
    }

    // 最後の同期日時を取得 (transactionsテーブルを使用)
    const lastSync = await prisma.transaction.findFirst({
      where: {
        freeDealId: { not: null }
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    });

    return {
      authenticated: true,
      lastSyncAt: lastSync?.updatedAt,
      companyName,
      message: '同期準備完了'
    };
  } catch (error: any) {
    console.error('同期ページ読み込みエラー:', error);
    return {
      authenticated: false,
      error: error.message,
      message: 'エラーが発生しました'
    };
  }
};

export const actions: Actions = {
  default: async ({ request }) => {
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

      let accessToken = token.accessToken;

      // トークンの有効期限をチェック
      if (new Date() >= token.expiresAt) {
        try {
          console.log('トークン期限切れ - リフレッシュを実行します');
          const newToken = await client.refreshToken(token.refreshToken);
          
          // 新しいトークンを保存
          await prisma.freeeToken.update({
            where: { id: token.id },
            data: {
              accessToken: newToken.accessToken,
              refreshToken: newToken.refreshToken,
              expiresAt: newToken.expiresAt,
              tokenType: newToken.tokenType,
              scope: newToken.scope
            }
          });

          accessToken = newToken.accessToken;
          console.log('トークンリフレッシュ完了');
        } catch (error: any) {
          console.error('トークンリフレッシュエラー:', error);
          return fail(401, {
            success: false,
            message: 'トークンの更新に失敗しました。再認証が必要です。'
          });
        }
      }

      // 会社情報を取得して「特定非営利活動法人ながいく」を固定選択
      const companies = await client.getCompanies(accessToken);
      if (companies.length === 0) {
        return fail(400, {
          success: false,
          message: 'アクセス可能な会社が見つかりません'
        });
      }

      // 「特定非営利活動法人ながいく」を検索、なければ最初の会社を使用
      const nagaikuCompany = companies.find(c => 
        c.name.includes('ながいく') || c.name.includes('nagaiku')
      );
      const targetCompany = nagaikuCompany || companies[0];
      const companyId = targetCompany.id;
      
      console.log(`同期対象会社: ${targetCompany.name} (ID: ${companyId})`);

      // 取引データを全件取得（ページネーション実装）
      let allDeals = [];
      let offset = 0;
      const limit = 100;
      let hasMoreData = true;

      console.log('=== 取引データ全件取得開始 ===');
      
      while (hasMoreData) {
        console.log(`ページ取得中: offset=${offset}, limit=${limit}`);
        
        const deals = await client.getDeals(
          accessToken,
          companyId,
          startDate,
          endDate,
          limit,
          offset
        );

        allDeals = allDeals.concat(deals);
        console.log(`このページで取得: ${deals.length}件, 累計: ${allDeals.length}件`);
        
        // 取得件数がlimit未満の場合、これ以上データがないと判断
        if (deals.length < limit) {
          hasMoreData = false;
          console.log('全データ取得完了');
        } else {
          offset += limit;
          // APIレート制限を考慮して少し待機
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const deals = allDeals;
      console.log(`=== 最終取得件数: ${deals.length}件 ===`);

      // 既存の取引IDを取得
      const existingTransactions = await prisma.transaction.findMany({
        where: {
          freeDealId: { not: null }
        },
        select: { freeDealId: true, id: true }
      });
      const existingDealIds = new Set(existingTransactions.map(t => t.freeDealId));

      // 新規・更新する取引を分離
      const newDeals = deals.filter(deal => !existingDealIds.has(BigInt(deal.id)));
      const updateDeals = deals.filter(deal => existingDealIds.has(BigInt(deal.id)));

      let syncedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // 同期開始ログを記録
      const syncRecord = await prisma.freeeSync.create({
        data: {
          lastSyncAt: new Date(),
          syncStatus: 'running',
          syncMessage: `同期開始: ${deals.length}件の取引を処理中`,
          recordCount: 0
        }
      });

      // 新規取引を作成
      for (const deal of newDeals) {
        try {
          console.log(`=== 新規取引作成 Deal ID ${deal.id} ===`);

          // 明細情報の取得
          const firstDetail = deal.details && deal.details.length > 0 ? deal.details[0] : null;
          
          // 備考とメモタグを分離
          const remark = deal.memo || null;
          const tags = null; // メモタグの処理は後で実装
          
          // レシートIDをJSON文字列として保存
          const receiptIdsJson = deal.receipt_ids && deal.receipt_ids.length > 0 
            ? JSON.stringify(deal.receipt_ids) 
            : null;

          await prisma.transaction.create({
            data: {
              id: `freee_${deal.id}`,
              journalNumber: BigInt(deal.id),
              journalLineNumber: 1,
              date: new Date(deal.issue_date),
              description: deal.description || firstDetail?.description || '',
              amount: Math.abs(deal.amount),
              account: firstDetail?.account_item_name || '不明',
              supplier: deal.partner_name,
              department: firstDetail?.section_name,
              item: firstDetail?.item_name || null,
              memo: deal.memo || null,
              remark: remark,
              managementNumber: deal.ref_number || null,
              freeDealId: BigInt(deal.id),
              tags: tags,
              detailDescription: firstDetail?.description || null,
              detailId: firstDetail ? BigInt(firstDetail.id) : null,
              receiptIds: receiptIdsJson
            }
          });

          syncedCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`取引ID ${deal.id}: ${error.message}`);
          console.error(`新規取引作成エラー (ID: ${deal.id}):`, error);
        }
      }

      // 既存取引を更新
      for (const deal of updateDeals) {
        try {
          console.log(`=== 既存取引更新 Deal ID ${deal.id} ===`);

          const firstDetail = deal.details && deal.details.length > 0 ? deal.details[0] : null;
          const remark = deal.memo || null;
          const tags = null;
          const receiptIdsJson = deal.receipt_ids && deal.receipt_ids.length > 0 
            ? JSON.stringify(deal.receipt_ids) 
            : null;

          await prisma.transaction.update({
            where: { freeDealId: BigInt(deal.id) },
            data: {
              journalNumber: BigInt(deal.id),
              journalLineNumber: 1,
              date: new Date(deal.issue_date),
              description: deal.description || firstDetail?.description || '',
              amount: Math.abs(deal.amount),
              account: firstDetail?.account_item_name || '不明',
              supplier: deal.partner_name,
              department: firstDetail?.section_name,
              item: firstDetail?.item_name || null,
              memo: deal.memo || null,
              remark: remark,
              managementNumber: deal.ref_number || null,
              tags: tags,
              detailDescription: firstDetail?.description || null,
              detailId: firstDetail ? BigInt(firstDetail.id) : null,
              receiptIds: receiptIdsJson,
              updatedAt: new Date()
            }
          });

          syncedCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`取引ID ${deal.id}: ${error.message}`);
          console.error(`既存取引更新エラー (ID: ${deal.id}):`, error);
        }
      }

      // 同期完了ログを更新
      await prisma.freeeSync.update({
        where: { id: syncRecord.id },
        data: {
          syncStatus: errorCount > 0 ? 'warning' : 'success',
          syncMessage: errorCount > 0 
            ? `同期完了（警告あり）: ${newDeals.length}件新規, ${updateDeals.length}件更新, ${errorCount}件エラー`
            : `同期完了: ${newDeals.length}件新規, ${updateDeals.length}件更新`,
          recordCount: syncedCount
        }
      });

      return {
        success: true,
        message: `同期完了: ${newDeals.length}件新規, ${updateDeals.length}件更新${errorCount > 0 ? `, ${errorCount}件エラー` : ''}`,
        newCount: newDeals.length,
        updateCount: updateDeals.length,
        errorCount,
        errors: errors.slice(0, 5) // 最初の5件のエラーのみ返す
      };

    } catch (error: any) {
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

      return fail(500, {
        success: false,
        message: `同期処理でエラーが発生しました: ${error.message}`
      });
    }
  }
};