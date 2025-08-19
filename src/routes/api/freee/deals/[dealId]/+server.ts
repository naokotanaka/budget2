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

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const { dealId } = params;
    const companyId = url.searchParams.get('company_id');

    if (!dealId) {
      return json({ 
        success: false, 
        error: 'dealIdが必要です' 
      }, { status: 400 });
    }

    // 保存されたトークンを取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      where: { id: 1 }
    });

    if (!tokenRecord) {
      return json({ 
        success: false, 
        error: 'freeeの認証が必要です' 
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
      } catch (error: any) {
        return json({ 
          success: false, 
          error: 'トークンの更新に失敗しました' 
        }, { status: 401 });
      }
    }

    // 会社IDを取得
    let selectedCompanyId = companyId ? parseInt(companyId) : null;
    if (!selectedCompanyId) {
      const companies = await client.getCompanies(accessToken);
      if (companies.length === 0) {
        return json({ 
          success: false, 
          error: 'アクセス可能な会社が見つかりません' 
        }, { status: 400 });
      }
      selectedCompanyId = companies[0].id;
    }

    // 取引詳細を取得（レシート情報含む）
    const dealDetail = await client.getDealDetail(
      accessToken,
      selectedCompanyId,
      parseInt(dealId)
    );

    if (!dealDetail) {
      return json({ 
        success: false, 
        error: '取引詳細が見つかりません' 
      }, { status: 404 });
    }

    return json({
      success: true,
      deal: dealDetail
    });

  } catch (error: any) {
    console.error('取引詳細取得エラー:', error);
    
    return json({ 
      success: false, 
      error: `取引詳細の取得でエラーが発生しました: ${error.message}` 
    }, { status: 500 });
  }
};