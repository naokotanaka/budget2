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
    console.log('=== freee Transaction Number Test ===');
    
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
    
    // 取引を詳細情報付きで取得してtxn_numberを探す
    const deals = await client.getDeals(
      tokenRecord.accessToken,
      companyId,
      undefined,
      undefined,
      3
    );
    
    if (deals.length === 0) {
      return json({
        success: false,
        error: 'No deals found',
        count: 0
      }, { status: 404 });
    }
    
    // 最初の取引の詳細を複数パラメータで取得
    const dealId = deals[0].id;
    const detailResponse = await fetch(`${FREEE_BASE_URL}/api/1/deals/${dealId}?company_id=${companyId}&accruals=true&txn_number=true`, {
      headers: {
        'Authorization': `Bearer ${tokenRecord.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!detailResponse.ok) {
      throw new Error(`Deal detail failed: ${detailResponse.status}`);
    }
    
    const detailData = await detailResponse.json();
    const deal = detailData.deal;
    
    return json({
      success: true,
      dealId: dealId,
      allFields: Object.keys(deal),
      // txn_numberがあるかチェック
      txn_number: deal.txn_number || null,
      // 他の番号系フィールド
      ref_number: deal.ref_number || null,
      // 詳細情報も確認
      details_sample: deal.details?.[0] ? Object.keys(deal.details[0]) : [],
      raw_deal: deal
    });
    
  } catch (error: any) {
    console.error('Transaction number test error:', error);
    
    return json({
      success: false,
      error: error.message,
      count: 0
    }, { status: 500 });
  }
};