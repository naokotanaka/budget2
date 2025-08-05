import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { FreeeNameResolver } from '$lib/freee/name-resolver';
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

// デバッグ用GETエンドポイント
export const GET: RequestHandler = async () => {
  console.log('=== GET Debug Request ===');
  
  // 固定パラメータでテスト
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return await processFreeeDataRequest(startDate, endDate, null);
};

export const POST: RequestHandler = async ({ request }) => {
  console.log('=== API /api/freee/data POST 開始 ===');
  console.log('Request Headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const requestBody = await request.json();
    const { startDate, endDate, companyId } = requestBody;
    
    console.log('リクエストボディ:', requestBody);
    return await processFreeeDataRequest(startDate, endDate, companyId);
  } catch (error) {
    console.error('POST request error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

// 共通のデータ処理関数
async function processFreeeDataRequest(startDate: string, endDate: string, companyId: number | null) {
  console.log('=== freee データ処理開始 ===');
  console.log('パラメータ:', { startDate, endDate, companyId });
    
  try {
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
    
    console.log('=== freee Token Info ===');
    console.log('Token scope:', tokenRecord.scope);
    console.log('Token expires at:', tokenRecord.expiresAt);
    console.log('Token type:', tokenRecord.tokenType);
    
    const client = new FreeeAPIClient(getFreeeConfig());
    const nameResolver = new FreeeNameResolver(client);
    let accessToken = tokenRecord.accessToken;
    
    // トークンの有効期限をチェック（近い場合はリフレッシュ）
    const expiryTime = new Date(tokenRecord.expiresAt).getTime();
    const currentTime = new Date().getTime();
    const timeUntilExpiry = expiryTime - currentTime;
    
    // 30分以内に期限切れの場合はリフレッシュ
    if (timeUntilExpiry < 30 * 60 * 1000) {
      try {
        console.log('トークンをリフレッシュ中...');
        const newToken = await client.refreshToken(tokenRecord.refreshToken);
        
        // 新しいトークンを保存
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
      } catch (error) {
        console.error('トークンリフレッシュ失敗:', error);
        return json({ 
          success: false, 
          error: 'freee接続の更新に失敗しました。管理者にお問い合わせください。',
          needsSetup: true
        }, { status: 503 });
      }
    }
    
    // 会社情報を取得（companyIdが指定されていない場合）
    let selectedCompanyId = companyId;
    if (!selectedCompanyId) {
      try {
        const companies = await client.getCompanies(accessToken);
        if (companies.length === 0) {
          return json({ 
            success: false, 
            error: 'アクセス可能な会社が見つかりません' 
          }, { status: 400 });
        }
        selectedCompanyId = companies[0].id; // 最初の会社を使用
        console.log('使用する会社ID:', selectedCompanyId, companies[0].name);
      } catch (error) {
        console.error('会社情報取得エラー:', error);
        return json({ 
          success: false, 
          error: '会社情報の取得に失敗しました' 
        }, { status: 500 });
      }
    }
    
    // 取引データ（deals）をメインで使用 - 仕訳ID + 行番号で管理
    console.log('取引データ取得開始:', { companyId: selectedCompanyId, startDate, endDate });
    
    let deals;
    try {
      deals = await client.getDeals(
        accessToken,
        selectedCompanyId,
        startDate,
        endDate,
        100 // Phase 2では100件まで
      );
      console.log('Deals取得成功:', deals.length, '件');
      
    } catch (dealsError) {
      console.error('Deals取得失敗:', dealsError);
      throw dealsError;
    }
    
    console.log(`${deals.length}件の取引データを取得`);
    
    // データ変換前のサンプルをログ出力
    if (deals.length > 0) {
      console.log('=== 変換前のfreee取引データサンプル ===');
      console.log('最初のdeal:', JSON.stringify(deals[0], null, 2));
    }
    
    // dealsデータを仕訳明細レベルに展開（一覧表示用）
    const transformedData = [];
    
    deals.forEach((deal, dealIndex) => {
      // 各取引の詳細（details）を個別の仕訳行として展開
      if (deal.details && Array.isArray(deal.details)) {
        deal.details.forEach((detail, detailIndex) => {
          const transformed = {
            // 基本識別情報
            id: detail.id, // 仕訳明細ID（既存システムとの整合性）
            deal_id: deal.id, // 元の取引ID
            line_number: detailIndex + 1, // 行番号（1から開始）
            company_id: deal.company_id,
            
            // 日付・金額情報
            issue_date: deal.issue_date,
            date: deal.issue_date,
            amount: detail.amount,
            amount_abs: Math.abs(detail.amount || 0),
            vat: detail.vat,
            
            // 取引内容
            description: detail.description || deal.ref_number || `取引 ${deal.id}`,
            entry_side: detail.entry_side,
            type: detail.entry_side === 'credit' ? 'income' : 'expense',
            
            // 取引先情報（後で名前解決）
            partner_id: deal.partner_id,
            partner_name: deal.partner_id ? `取引先ID: ${deal.partner_id}` : '取引先情報なし',
            partner_code: deal.partner_code,
            
            // 勘定科目情報（後で名前解決）
            account_item_id: detail.account_item_id,
            account_item_name: detail.account_item_id ? 
              `勘定科目ID: ${detail.account_item_id}` : '勘定科目情報なし',
            
            // 部門・タグ情報
            section_id: detail.section_id,
            item_id: detail.item_id,
            tag_ids: detail.tag_ids,
            tax_code: detail.tax_code,
            
            // 取引情報
            deal_type: deal.type,
            status: deal.status,
            due_date: deal.due_date,
            due_amount: deal.due_amount,
            ref_number: deal.ref_number,
            deal_origin_name: deal.deal_origin_name,
            
            // 振替情報
            transfer_id: deal.transfer_id || null,
            
            // 支払・領収書情報
            payments: deal.payments,
            receipts: deal.receipts,
            
            // 追加情報（存在する場合のみ）
            ...Object.keys(detail)
              .filter(key => !['id', 'account_item_id', 'tax_code', 'item_id', 'section_id', 'tag_ids', 'amount', 'vat', 'description', 'entry_side'].includes(key))
              .reduce((acc, key) => {
                acc[`detail_${key}`] = detail[key];
                return acc;
              }, {})
          };
          
          // 最初の数件の変換結果をログ出力
          if (dealIndex < 2 && detailIndex < 2) {
            console.log(`=== 変換後仕訳データ[${dealIndex}-${detailIndex}] ===`);
            console.log('Original deal keys:', Object.keys(deal));
            console.log('Original detail keys:', Object.keys(detail));
            console.log('Transformed keys:', Object.keys(transformed));
          }
          
          transformedData.push(transformed);
        });
      }
    });
    
    // 名前解決の実行（取引先名・勘定科目名を実際の名前に変換）
    console.log('=== 名前解決開始 ===');
    try {
      // 勘定科目の事前ロード
      await nameResolver.preloadAccountItems(accessToken, selectedCompanyId);
      
      // 各仕訳データの名前解決
      for (let i = 0; i < transformedData.length; i++) {
        const item = transformedData[i];
        
        // 取引先名の解決
        if (item.partner_id) {
          try {
            const partnerName = await nameResolver.getPartnerName(accessToken, selectedCompanyId, item.partner_id);
            transformedData[i].partner_name = partnerName;
          } catch (error) {
            console.warn(`取引先名解決失敗 (ID: ${item.partner_id}):`, error.message);
          }
        }
        
        // 勘定科目名の解決
        if (item.account_item_id) {
          try {
            const accountItemName = await nameResolver.getAccountItemName(accessToken, selectedCompanyId, item.account_item_id);
            transformedData[i].account_item_name = accountItemName;
          } catch (error) {
            console.warn(`勘定科目名解決失敗 (ID: ${item.account_item_id}):`, error.message);
          }
        }
        
        // 進捗表示（10件ごと）
        if ((i + 1) % 10 === 0) {
          console.log(`名前解決進捗: ${i + 1}/${transformedData.length}`);
        }
      }
      
      console.log('名前解決完了');
    } catch (nameResolverError) {
      console.error('名前解決エラー:', nameResolverError);
      // 名前解決に失敗してもデータは返す
    }
    
    const responseData = {
      success: true,
      data: transformedData,
      count: transformedData.length,
      message: `${transformedData.length}件のデータを取得しました`
    };
    
    console.log('=== API レスポンス送信 ===');
    console.log('Response Status: 200');
    console.log('Response Data Count:', transformedData.length);
    console.log('Response Success:', responseData.success);
    
    return json(responseData);
    
  } catch (error) {
    console.error('=== API エラー発生 ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('freeeデータ取得エラー:', error);
    
    // エラーの詳細をログに記録
    let errorMessage = 'データ取得中にエラーが発生しました';
    if (error.message?.includes('401')) {
      errorMessage = 'freee認証エラーです。管理者にお問い合わせください。';
    } else if (error.message?.includes('429')) {
      errorMessage = 'freee APIの利用制限に達しました。しばらく待ってから再試行してください。';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'freee APIとの通信に失敗しました。ネットワーク接続を確認してください。';
    }
    
    const errorResponse = { 
      success: false, 
      error: errorMessage,
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
    
    console.log('=== API エラーレスポンス送信 ===');
    console.log('Response Status: 500');
    console.log('Error Response:', errorResponse);
    
    return json(errorResponse, { status: 500 });
  }
}