import type { PageServerLoad } from './$types';
import { prisma } from '$lib/database';
import { FreeeAPIClient } from '$lib/freee/client';

// 環境変数から設定を取得
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

export const load: PageServerLoad = async () => {
  console.log('=== +page.server.ts load 関数開始 ===');
  
  try {
    // freee接続状態チェック
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    console.log('Token record found:', !!tokenRecord);
    
    const isConnected = tokenRecord && new Date() < tokenRecord.expiresAt;
    
    let companies = [];
    let connectionError = null;
    
    if (isConnected) {
      // 接続済みの場合、会社情報も取得（Phase 2で実装）
      try {
        const client = new FreeeAPIClient(getFreeeConfig());
        companies = await client.getCompanies(tokenRecord.accessToken);
        console.log(`${companies.length}個の会社を取得:`, companies.map(c => c.name));
      } catch (error: any) {
        console.warn('会社情報取得失敗:', error);
        connectionError = 'freee接続に問題があります';
      }
    }
    
    const result = {
      isConnected,
      companies,
      lastSyncAt: tokenRecord?.updatedAt || null,
      connectionError
    };
    
    console.log('=== +page.server.ts 正常終了 ===');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error: any) {
    console.error('=== +page.server.ts エラー発生 ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('freee接続状態チェックエラー:', error);
    
    const errorResult = {
      isConnected: false,
      companies: [],
      lastSyncAt: null,
      connectionError: 'データベース接続エラー'
    };
    
    console.log('Error Result:', JSON.stringify(errorResult, null, 2));
    
    return errorResult;
  }
};