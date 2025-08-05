import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { prisma } from '$lib/database';

const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID || '';
const FREEE_CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET || '';
const FREEE_REDIRECT_URI = process.env.FREEE_REDIRECT_URI || 'https://nagaiku.top/budget2/auth/freee/callback';
const FREEE_BASE_URL = process.env.FREEE_BASE_URL || 'https://api.freee.co.jp';

function getFreeeConfig() {
  return {
    clientId: FREEE_CLIENT_ID,
    clientSecret: FREEE_CLIENT_SECRET,
    redirectUri: FREEE_REDIRECT_URI,
    baseUrl: FREEE_BASE_URL
  };
}

export const GET: RequestHandler = async () => {
  try {
    console.log('=== freee Deals API Test ===');
    
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'Invalid or expired token',
        count: 0
      }, { status: 401 });
    }
    
    const client = new FreeeAPIClient(getFreeeConfig());
    
    // 会社IDを取得
    const companies = await client.getCompanies(tokenRecord.accessToken);
    if (companies.length === 0) {
      return json({
        success: false,
        error: 'No companies found',
        count: 0
      }, { status: 404 });
    }
    
    const companyId = companies[0].id;
    console.log('Using company ID:', companyId);
    
    // 直近30日の取引データを取得
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log('API呼び出しパラメータ:', {
      companyId,
      startDate,
      endDate,
      tokenLength: tokenRecord.accessToken.length,
      tokenScope: tokenRecord.scope
    });
    
    console.log('freee API URL:', `${FREEE_BASE_URL}/api/1/deals?company_id=${companyId}&limit=10&type=all&start_issue_date=${startDate}&end_issue_date=${endDate}`);
    
    const deals = await client.getDeals(
      tokenRecord.accessToken,
      companyId,
      startDate,
      endDate,
      10 // テスト用に10件まで
    );
    
    console.log('Deals retrieved:', deals.length);
    if (deals.length > 0) {
      console.log('Sample deal:', JSON.stringify(deals[0], null, 2));
    }
    
    return json({
      success: true,
      count: deals.length,
      sample: deals.length > 0 ? {
        id: deals[0].id,
        partner_name: deals[0].partner_name,
        description: deals[0].description,
        amount: deals[0].amount,
        details_count: deals[0].details?.length || 0
      } : null,
      // freeeからの完全なデータ構造を確認用に追加
      rawData: deals.length > 0 ? deals[0] : null,
      // 全データの構造確認
      allFields: deals.length > 0 ? Object.keys(deals[0]) : [],
      // detailsの中身も確認
      detailsSample: deals.length > 0 && deals[0].details?.length > 0 ? deals[0].details[0] : null
    });
    
  } catch (error) {
    console.error('=== Deals API Test Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // より詳細なエラー情報を返す
    let errorMessage = error.message;
    let errorDetails = null;
    
    if (error.message?.includes('401')) {
      errorMessage = '認証エラー - トークンが無効または権限不足';
    } else if (error.message?.includes('403')) {
      errorMessage = 'アクセス権限エラー - スコープ不足の可能性';
    } else if (error.message?.includes('404')) {
      errorMessage = 'APIエンドポイントが見つかりません';
    } else if (error.message?.includes('Get deals failed')) {
      errorMessage = 'freee Deals API呼び出し失敗';
      errorDetails = {
        suggestion: 'freee開発者コンソールでAPIアクセス権限を確認してください',
        requiredScope: 'deals:read'
      };
    }
    
    const errorResponse = {
      success: false,
      error: errorMessage,
      originalError: error.message,
      errorDetails,
      count: 0,
      timestamp: new Date().toISOString(),
      debug: {
        stack: error.stack,
        type: error.constructor.name
      }
    };
    
    console.log('=== Returning Error Response ===');
    console.log(JSON.stringify(errorResponse, null, 2));
    
    return json(errorResponse, { status: 500 });
  }
};