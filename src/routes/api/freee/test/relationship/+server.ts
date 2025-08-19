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
    console.log('=== Deals vs Walletables 関連性テスト ===');
    
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
    
    // 直近30日のデータを取得
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 両方のデータを取得
    const [deals, walletables] = await Promise.all([
      client.getDeals(tokenRecord.accessToken, companyId, startDate, endDate, 5),
      client.getWalletables(tokenRecord.accessToken, companyId, startDate, endDate, 5)
    ]);
    
    console.log('Deals count:', deals.length);
    console.log('Walletables count:', walletables.length);
    
    // ID の関連性を調査
    const dealIds = deals.map(d => d.id);
    const walletableIds = walletables.map(w => w.id);
    
    // deals の details.id と walletables.id の関連性をチェック
    const detailIds = deals.flatMap(d => d.details?.map(detail => detail.id) || []);
    const walletableMatchedWithDetails = walletables.filter(w => detailIds.includes(w.id));
    
    // walletables に deal_id などの関連フィールドがあるかチェック
    const walletableFields = walletables.length > 0 ? Object.keys(walletables[0]) : [];
    const dealRelatedFields = walletableFields.filter(field => 
      field.includes('deal') || field.includes('transaction')
    );
    
    const analysis = {
      deals: {
        count: deals.length,
        sampleIds: dealIds.slice(0, 3),
        fields: deals.length > 0 ? Object.keys(deals[0]) : [],
        detailIds: detailIds.slice(0, 5)
      },
      walletables: {
        count: walletables.length,
        sampleIds: walletableIds.slice(0, 3),
        fields: walletableFields,
        dealRelatedFields
      },
      relationship: {
        walletableMatchedWithDetails: walletableMatchedWithDetails.length,
        matchedIds: walletableMatchedWithDetails.map(w => w.id),
        commonIds: dealIds.filter(id => walletableIds.includes(id))
      }
    };
    
    console.log('Relationship analysis:', JSON.stringify(analysis, null, 2));
    
    return json({
      success: true,
      analysis,
      // 具体的なサンプルデータ
      dealSample: deals[0] || null,
      walletableSample: walletables[0] || null,
      // マッチしたデータがあれば表示
      matchedSample: walletableMatchedWithDetails[0] || null
    });
    
  } catch (error: any) {
    console.error('Relationship test error:', error);
    
    return json({
      success: false,
      error: error.message,
      count: 0
    }, { status: 500 });
  }
};