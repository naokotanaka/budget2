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
    console.log('=== freee Tags API Test ===');
    
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
    
    // タグ一覧を取得
    const response = await fetch(`${FREEE_BASE_URL}/api/1/tags?company_id=${companyId}&limit=3000`, {
      headers: {
        'Authorization': `Bearer ${tokenRecord.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tags API Error:', errorText);
      throw new Error(`Get tags failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Tags retrieved:', data.tags?.length || 0);
    
    // サンプルデータを表示
    if (data.tags && data.tags.length > 0) {
      console.log('Sample tags:', data.tags.slice(0, 5).map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        shortcut: tag.shortcut,
        update_date: tag.update_date
      })));
    }
    
    return json({
      success: true,
      count: data.tags?.length || 0,
      tags: data.tags || [],
      sample: data.tags?.slice(0, 10) || [],
      // タグIDマッピング
      tagMap: (data.tags || []).reduce((acc: any, tag: any) => {
        acc[tag.id] = tag.name;
        return acc;
      }, {})
    });
    
  } catch (error) {
    console.error('Tags API test error:', error);
    
    return json({
      success: false,
      error: error.message,
      count: 0
    }, { status: 500 });
  }
};