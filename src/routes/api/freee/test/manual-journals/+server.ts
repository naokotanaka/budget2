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
    console.log('=== freee Manual Journals API Test ===');
    
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
    
    // 振替伝票を取得（仕訳番号があるかもしれない）
    const response = await fetch(`https://api.freee.co.jp/api/1/manual_journals?company_id=${companyId}&limit=5`, {
      headers: {
        'Authorization': `Bearer ${tokenRecord.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Manual Journals API Error:', errorText);
      throw new Error(`Get manual journals failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Manual Journals retrieved:', data.manual_journals?.length || 0);
    
    return json({
      success: true,
      count: data.manual_journals?.length || 0,
      journals: data.manual_journals || [],
      // 最初のデータのフィールド確認
      firstJournal: data.manual_journals?.[0] || null,
      allFields: data.manual_journals?.[0] ? Object.keys(data.manual_journals[0]) : []
    });
    
  } catch (error) {
    console.error('Manual Journals API test error:', error);
    
    return json({
      success: false,
      error: error.message,
      count: 0
    }, { status: 500 });
  }
};