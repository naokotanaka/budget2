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
  console.log('=== freee/+page.server.ts load 関数開始 ===');
  
  try {
    // freee接続状態チェック
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    console.log('Token record found:', !!tokenRecord);
    if (tokenRecord) {
      console.log('Token expires at:', tokenRecord.expiresAt);
      console.log('Current time:', new Date());
    }
    
    let isConnected = tokenRecord && new Date() < tokenRecord.expiresAt;
    console.log('Initial connection status:', isConnected);
    
    let companies = [];
    let connectionError = null;
    
    // トークンの有効期限が切れている場合、リフレッシュを試行
    if (tokenRecord && !isConnected && tokenRecord.refreshToken) {
      console.log('Attempting token refresh...');
      try {
        const client = new FreeeAPIClient(getFreeeConfig());
        
        // タイムアウトを設定してリフレッシュ
        const refreshPromise = client.refreshToken(tokenRecord.refreshToken);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Token refresh timeout')), 10000)
        );
        
        const refreshedToken = await Promise.race([refreshPromise, timeoutPromise]);
        
        // データベースのトークンを更新
        await prisma.freeeToken.update({
          where: { id: tokenRecord.id },
          data: {
            accessToken: refreshedToken.accessToken,
            refreshToken: refreshedToken.refreshToken,
            expiresAt: refreshedToken.expiresAt,
            tokenType: refreshedToken.tokenType,
            scope: refreshedToken.scope,
            updatedAt: new Date()
          }
        });
        
        console.log('Token refreshed successfully, new expiry:', refreshedToken.expiresAt);
        isConnected = true;
        
        // 更新されたトークンで会社情報を取得（タイムアウト付き）
        const companiesPromise = client.getCompanies(refreshedToken.accessToken);
        const companiesTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Get companies timeout')), 5000)
        );
        
        try {
          companies = await Promise.race([companiesPromise, companiesTimeoutPromise]);
          console.log(`${companies.length}個の会社を取得:`, companies.map(c => c.display_name || c.name));
        } catch (err) {
          console.warn('会社情報取得タイムアウト:', err);
          companies = [];
        }
        
      } catch (error: any) {
        console.error('Token refresh failed:', error);
        connectionError = 'freee認証の有効期限が切れています。再認証が必要です。';
        isConnected = false;
      }
    } else if (isConnected) {
      // 接続済みの場合、会社情報を取得（タイムアウト付き）
      try {
        const client = new FreeeAPIClient(getFreeeConfig());
        
        const companiesPromise = client.getCompanies(tokenRecord.accessToken);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Get companies timeout')), 5000)
        );
        
        companies = await Promise.race([companiesPromise, timeoutPromise]);
        console.log(`${companies.length}個の会社を取得:`, companies.map(c => c.display_name || c.name));
      } catch (error: any) {
        console.warn('会社情報取得失敗:', error);
        connectionError = 'freee接続に問題があります';
        companies = [];
      }
    }
    
    const result = {
      isConnected,
      companies,
      lastSyncAt: tokenRecord?.updatedAt || null,
      connectionError
    };
    
    console.log('=== freee/+page.server.ts 正常終了 ===');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error: any) {
    console.error('=== freee/+page.server.ts エラー発生 ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
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