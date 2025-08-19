import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { prisma } from '$lib/database';

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

export const POST: RequestHandler = async ({ request }) => {
  console.log('=== freee Debug API 開始 ===');
  
  try {
    const requestBody = await request.json();
    const { startDate, endDate, companyId } = requestBody;
    
    console.log('Debug request parameters:', { startDate, endDate, companyId });
    
    // バリデーション
    if (!startDate || !endDate) {
      return json({ 
        success: false, 
        error: '開始日と終了日は必須です' 
      }, { status: 400 });
    }
    
    // freee接続トークン取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'freee接続が必要です。管理者にお問い合わせください。',
        needsSetup: true
      }, { status: 503 });
    }
    
    const client = new FreeeAPIClient(getFreeeConfig());
    let accessToken = tokenRecord.accessToken;
    
    // トークンリフレッシュ処理（必要に応じて）
    const expiryTime = new Date(tokenRecord.expiresAt).getTime();
    const currentTime = new Date().getTime();
    const timeUntilExpiry = expiryTime - currentTime;
    
    if (timeUntilExpiry < 30 * 60 * 1000) { // 30分以内に期限切れ
      try {
        console.log('トークンをリフレッシュ中...');
        const newToken = await client.refreshToken(tokenRecord.refreshToken);
        
        await prisma.freeeToken.update({
          where: { id: tokenRecord.id },
          data: {
            accessToken: newToken.accessToken,
            refreshToken: newToken.refreshToken,
            expiresAt: newToken.expiresAt,
            tokenType: newToken.tokenType,
            scope: newToken.scope,
            updatedAt: new Date()
          }
        });

        accessToken = newToken.accessToken;
        console.log('トークンリフレッシュ完了');
      } catch (error: any) {
        console.error('トークンリフレッシュ失敗:', error);
        return json({ 
          success: false, 
          error: 'freee接続の更新に失敗しました。管理者にお問い合わせください。',
          needsSetup: true
        }, { status: 503 });
      }
    }
    
    // 会社情報を取得
    let selectedCompanyId = companyId;
    let companies = [];
    
    try {
      companies = await client.getCompanies(accessToken);
      if (companies.length === 0) {
        return json({ 
          success: false, 
          error: 'アクセス可能な会社が見つかりません' 
        }, { status: 400 });
      }
      
      if (!selectedCompanyId) {
        selectedCompanyId = companies[0].id;
      }
      
      console.log('使用する会社ID:', selectedCompanyId);
    } catch (error: any) {
      console.error('会社情報取得エラー:', error);
      return json({ 
        success: false, 
        error: '会社情報の取得に失敗しました' 
      }, { status: 500 });
    }
    
    console.log('=== freee API生データ取得開始 ===');
    
    // 複数のAPIエンドポイントから詳細データを取得
    const debugData = {
      companies: companies,
      deals: [],
      walletTxns: [],
      walletables: [],
      journalsComplete: null,
      apiInfo: {
        baseUrl: FREEE_BASE_URL,
        companyId: selectedCompanyId,
        startDate,
        endDate,
        timestamp: new Date().toISOString()
      },
      errors: []
    };
    
    // 1. Deals API（取引データ）- 最も詳細な情報が含まれる
    console.log('1. Deals API データ取得中...');
    try {
      const deals = await client.getDeals(
        accessToken,
        selectedCompanyId,
        startDate,
        endDate,
        20 // デバッグ用に件数制限
      );
      
      debugData.deals = deals;
      console.log(`Deals API: ${deals.length}件取得`);
      
      // 最初のdealの詳細構造をログ出力
      if (deals.length > 0) {
        console.log('=== Sample Deal Structure ===');
        console.log('Deal keys:', Object.keys(deals[0]));
        console.log('Deal sample:', JSON.stringify(deals[0], null, 2));
        
        if (deals[0].details && deals[0].details.length > 0) {
          console.log('Detail keys:', Object.keys(deals[0].details[0]));
          console.log('Detail sample:', JSON.stringify(deals[0].details[0], null, 2));
        }
      }
      
    } catch (error: any) {
      console.error('Deals API エラー:', error);
      debugData.errors.push({
        api: 'deals',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // 2. Wallet Transactions API（入出金明細）
    console.log('2. Wallet Transactions API データ取得中...');
    try {
      const walletTxns = await client.getWalletTxns(
        accessToken,
        selectedCompanyId,
        startDate,
        endDate,
        20 // デバッグ用に件数制限
      );
      
      debugData.walletTxns = walletTxns;
      console.log(`Wallet Txns API: ${walletTxns.length}件取得`);
      
      // 最初のwallet txnの詳細構造をログ出力
      if (walletTxns.length > 0) {
        console.log('=== Sample Wallet Txn Structure ===');
        console.log('Wallet Txn keys:', Object.keys(walletTxns[0]));
        console.log('Wallet Txn sample:', JSON.stringify(walletTxns[0], null, 2));
      }
      
    } catch (error: any) {
      console.error('Wallet Txns API エラー:', error);
      debugData.errors.push({
        api: 'wallet_txns',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // 3. Walletables API（口座・現金残高）
    console.log('3. Walletables API データ取得中...');
    try {
      const walletables = await client.getWalletables(
        accessToken,
        selectedCompanyId,
        startDate,
        endDate,
        20
      );
      
      debugData.walletables = walletables;
      console.log(`Walletables API: ${walletables.length}件取得`);
      
      // 最初のwalletableの詳細構造をログ出力
      if (walletables.length > 0) {
        console.log('=== Sample Walletable Structure ===');
        console.log('Walletable keys:', Object.keys(walletables[0]));
        console.log('Walletable sample:', JSON.stringify(walletables[0], null, 2));
      }
      
    } catch (error: any) {
      console.error('Walletables API エラー:', error);
      debugData.errors.push({
        api: 'walletables',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // 4. Journals Complete API（仕訳データ完全版）- 現在利用不可
    console.log('4. Journals Complete API - スキップ（APIエンドポイントの問題のため）');
    debugData.journalsComplete = null;
    
    console.log('=== freee Debug API 完了 ===');
    console.log('Total deals:', debugData.deals.length);
    console.log('Total wallet txns:', debugData.walletTxns.length);
    console.log('Total walletables:', debugData.walletables.length);
    console.log('Total journals:', debugData.journalsComplete?.length || 'スキップ');
    console.log('Total errors:', debugData.errors.length);
    
    return json({
      success: true,
      data: debugData,
      message: `freee API生データを取得しました（Deals: ${debugData.deals.length}件, Wallet: ${debugData.walletTxns.length}件, エラー: ${debugData.errors.length}件）`
    });
    
  } catch (error: any) {
    console.error('=== Debug API エラー発生 ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    
    return json({
      success: false,
      error: `デバッグデータ取得中にエラーが発生しました: ${error.message}`,
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};