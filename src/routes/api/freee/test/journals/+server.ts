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
    console.log('=== freee Journals API Test ===');
    
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
    
    // 直近30日の仕訳データを取得
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const journals = await client.getJournals(
      tokenRecord.accessToken,
      companyId,
      startDate,
      endDate,
      10 // テスト用に10件まで
    );
    
    console.log('Journals retrieved:', journals.length);
    if (journals.length > 0) {
      console.log('Sample journal:', JSON.stringify(journals[0], null, 2));
    }
    
    return json({
      success: true,
      count: journals.length,
      sample: journals.length > 0 ? {
        id: journals[0].id,
        date: journals[0].date,
        txn_number: journals[0].txn_number,
        description: journals[0].description,
        details: journals[0].details?.length || 0
      } : null,
      // 詳細構造の確認
      rawData: journals.length > 0 ? journals[0] : null,
      allFields: journals.length > 0 ? Object.keys(journals[0]) : [],
      // 最初の数件のデータも確認
      firstThree: journals.slice(0, 3)
    });
    
  } catch (error) {
    console.error('Journals API test error:', error);
    
    return json({
      success: false,
      error: error.message,
      count: 0
    }, { status: 500 });
  }
};