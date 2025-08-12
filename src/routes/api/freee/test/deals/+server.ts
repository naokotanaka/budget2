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

export const GET: RequestHandler = async () => {
  try {
    console.log('=== freee Deals Raw Data Test ===');
    
    const tokenRecord = await prisma.freeeToken.findFirst({
      where: { id: 1 }
    });
    
    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'Invalid or expired token'
      }, { status: 401 });
    }
    
    const client = new FreeeAPIClient({
      clientId: FREEE_CLIENT_ID,
      clientSecret: FREEE_CLIENT_SECRET,
      redirectUri: FREEE_REDIRECT_URI,
      baseUrl: FREEE_BASE_URL
    });
    
    // 会社IDを取得
    const companies = await client.getCompanies(tokenRecord.accessToken);
    if (companies.length === 0) {
      return json({
        success: false,
        error: 'No companies found'
      }, { status: 404 });
    }
    
    const companyId = companies[0].id;
    
    // 明細が複数ある取引を探して取得
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      limit: '10',  // 複数明細の取引を見つけるため10件取得
      accruals: 'with',
      sort: 'issue_date:desc,id:desc'
    });
    
    console.log('Fetching raw deal data...');
    const response = await fetch(`${FREEE_BASE_URL}/api/1/deals?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${tokenRecord.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Raw API response:', JSON.stringify(data, null, 2));
    
    // 明細が複数ある取引を探す
    if (data.deals && data.deals.length > 0) {
      // 複数明細の取引を探す
      let multiDetailDeal = null;
      for (const deal of data.deals) {
        if (deal.details && deal.details.length > 1) {
          multiDetailDeal = deal;
          break;
        }
      }
      
      const sampleDeal = multiDetailDeal || data.deals[0];
      
      // 明細の順序と番号を確認
      console.log('=== Deal Details Analysis ===');
      console.log(`Deal ID: ${sampleDeal.id}`);
      console.log(`Details count: ${sampleDeal.details?.length || 0}`);
      
      if (sampleDeal.details) {
        sampleDeal.details.forEach((detail: any, index: number) => {
          console.log(`Detail ${index}:`, {
            array_index: index,
            detail_id: detail.id,
            account_item_id: detail.account_item_id,
            amount: detail.amount,
            entry_side: detail.entry_side,
            // すべてのフィールドを確認
            all_fields: Object.keys(detail).sort()
          });
        });
      }
      
      return json({
        success: true,
        message: 'Check console for details analysis',
        deal_id: sampleDeal.id,
        details_count: sampleDeal.details?.length || 0,
        // 明細の順序情報
        details_order: sampleDeal.details?.map((d: any, i: number) => ({
          array_index: i,
          detail_id: d.id,
          account_item_id: d.account_item_id,
          amount: d.amount,
          entry_side: d.entry_side
        })) || [],
        // 最初の明細の全フィールド
        first_detail_fields: sampleDeal.details?.[0] ? Object.keys(sampleDeal.details[0]).sort() : []
      });
    }
    
    return json({
      success: false,
      error: 'No deals found'
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};