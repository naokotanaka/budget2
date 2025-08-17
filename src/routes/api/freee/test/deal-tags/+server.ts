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

export const GET: RequestHandler = async ({ url }) => {
  try {
    const dealId = url.searchParams.get('dealId') || '7944699565';
    console.log('=== Deal Tags Test ===');
    console.log('Deal ID:', dealId);
    
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
    const tagMap = new Map(tags.map(tag => [tag.id, tag.name]));
    console.log('Total tags:', tags.length);
    
    // 特定の取引を取得
    const response = await fetch(`${FREEE_BASE_URL}/api/1/deals/${dealId}?company_id=${companyId}`, {
      headers: {
        'Authorization': `Bearer ${tokenRecord.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deal API Error:', errorText);
      return json({
        success: false,
        error: `Deal not found: ${response.status}`,
        dealId: dealId
      }, { status: 404 });
    }
    
    const data = await response.json();
    const deal = data.deal;
    
    // タグ情報を抽出
    const dealTags = deal.tag_ids || [];
    const dealTagNames = dealTags.map(id => tagMap.get(id)).filter(name => name);
    
    // 明細レベルのタグも確認
    const detailTags = [];
    if (deal.details && Array.isArray(deal.details)) {
      deal.details.forEach((detail, index) => {
        if (detail.tag_ids && detail.tag_ids.length > 0) {
          const tagNames = detail.tag_ids.map(id => tagMap.get(id)).filter(name => name);
          detailTags.push({
            detailIndex: index,
            detailId: detail.id,
            tagIds: detail.tag_ids,
            tagNames: tagNames
          });
        }
      });
    }
    
    return json({
      success: true,
      dealId: deal.id,
      issueDate: deal.issue_date,
      amount: deal.amount,
      refNumber: deal.ref_number,
      memo: deal.memo,
      dealLevelTags: {
        tagIds: dealTags,
        tagNames: dealTagNames
      },
      detailLevelTags: detailTags,
      rawDeal: deal // デバッグ用
    });
    
  } catch (error) {
    console.error('Deal tags test error:', error);
    
    return json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};