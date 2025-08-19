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
    console.log('=== freee Walletables API Test ===');
    
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
    
    const walletables = await client.getWalletables(
      tokenRecord.accessToken,
      companyId,
      startDate,
      endDate,
      10 // テスト用に10件まで
    );
    
    console.log('Walletables retrieved:', walletables.length);
    if (walletables.length > 0) {
      console.log('Sample walletable:', JSON.stringify(walletables[0], null, 2));
    }
    
    return json({
      success: true,
      count: walletables.length,
      sample: walletables.length > 0 ? {
        id: walletables[0].id,
        date: walletables[0].date,
        partner_name: walletables[0].partner_name,
        description: walletables[0].description,
        amount: walletables[0].amount
      } : null,
      // 詳細構造の確認
      rawData: walletables.length > 0 ? walletables[0] : null,
      allFields: walletables.length > 0 ? Object.keys(walletables[0]) : [],
      // 最初の数件のデータも確認
      firstThree: walletables.slice(0, 3)
    });
    
  } catch (error: any) {
    console.error('Walletables API test error:', error);
    
    return json({
      success: false,
      error: error.message,
      count: 0
    }, { status: 500 });
  }
};