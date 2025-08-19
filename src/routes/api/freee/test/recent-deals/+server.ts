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
    console.log('=== Recent Deals with Tags Test ===');
    
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'Invalid or expired token'
      }, { status: 401 });
    }
    
    const client = new FreeeAPIClient(getFreeeConfig());
    
    // 会社IDを取得
    const companies = await client.getCompanies(tokenRecord.accessToken);
    if (companies.length === 0) {
      return json({
        success: false,
        error: 'No companies found'
      }, { status: 404 });
    }
    
    const companyId = companies[0].id;
    console.log('Company ID:', companyId);
    
    // タグマスタを取得
    const tags = await client.getTags(tokenRecord.accessToken, companyId);
    // タグIDを数値と文字列の両方でマップに登録
    const tagMap = new Map();
    tags.forEach(tag => {
      tagMap.set(tag.id, tag.name);           // 数値キー
      tagMap.set(String(tag.id), tag.name);   // 文字列キー
    });
    console.log('Total tags:', tags.length);
    
    // デバッグ：特定のタグIDを確認
    console.log('Tag 27163372 exists?', tagMap.has(27163372), tagMap.has('27163372'));
    console.log('Sample tag IDs:', tags.slice(0, 3).map(t => ({ id: t.id, type: typeof t.id })));
    
    // 最近の取引を取得（2024年11月）
    const startDate = '2024-11-01';
    const endDate = '2024-11-30';
    
    const response = await fetch(
      `${FREEE_BASE_URL}/api/1/deals?company_id=${companyId}&start_issue_date=${startDate}&end_issue_date=${endDate}&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${tokenRecord.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deals API Error:', errorText);
      throw new Error(`Get deals failed: ${response.status}`);
    }
    
    const data = await response.json();
    const deals = data.deals || [];
    
    // タグがある取引を探す
    const dealsWithTags = [];
    
    for (const deal of deals) {
      let hasTag = false;
      const tagInfo = {
        dealId: deal.id,
        issueDate: deal.issue_date,
        amount: deal.amount,
        refNumber: deal.ref_number,
        dealTags: [],
        detailTags: []
      };
      
      // 取引レベルのタグ
      if (deal.tag_ids && deal.tag_ids.length > 0) {
        hasTag = true;
        tagInfo.dealTags = deal.tag_ids.map(id => ({
          id: id,
          name: tagMap.get(String(id)) || tagMap.get(Number(id)) || `Unknown tag ${id}`
        }));
      }
      
      // 明細レベルのタグ
      if (deal.details && Array.isArray(deal.details)) {
        deal.details.forEach((detail, index) => {
          if (detail.tag_ids && detail.tag_ids.length > 0) {
            hasTag = true;
            tagInfo.detailTags.push({
              detailIndex: index,
              tags: detail.tag_ids.map(id => ({
                id: id,
                name: tagMap.get(String(id)) || tagMap.get(Number(id)) || `Unknown tag ${id}`
              }))
            });
          }
        });
      }
      
      if (hasTag) {
        dealsWithTags.push(tagInfo);
      }
    }
    
    return json({
      success: true,
      totalDeals: deals.length,
      dealsWithTags: dealsWithTags,
      tagsSummary: {
        totalTags: tags.length,
        sampleTags: tags.slice(0, 10).map(t => ({ id: t.id, name: t.name }))
      }
    });
    
  } catch (error: any) {
    console.error('Recent deals test error:', error);
    
    return json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};