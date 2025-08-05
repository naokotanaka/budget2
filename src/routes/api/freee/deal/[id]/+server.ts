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

// 特定の取引詳細を取得（deals API）
export const GET: RequestHandler = async ({ params }) => {
  try {
    const dealId = params.id;
    console.log('=== Deal詳細取得 ===');
    console.log('Deal ID:', dealId);
    
    if (!dealId || isNaN(Number(dealId))) {
      return json({ 
        success: false, 
        error: '無効な取引IDです' 
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
    
    // 会社IDを取得
    const companies = await client.getCompanies(tokenRecord.accessToken);
    if (companies.length === 0) {
      return json({
        success: false,
        error: '会社情報が見つかりません'
      }, { status: 404 });
    }
    
    const companyId = companies[0].id;
    
    // freee API: GET /api/1/deals/{id}
    const response = await fetch(`${FREEE_BASE_URL}/api/1/deals/${dealId}?company_id=${companyId}`, {
      headers: {
        'Authorization': `Bearer ${tokenRecord.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Deal API Response Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deal API Error:', errorText);
      
      if (response.status === 404) {
        return json({
          success: false,
          error: '指定された取引が見つかりません'
        }, { status: 404 });
      }
      
      throw new Error(`Deal API failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const deal = data.deal;
    
    console.log('Deal詳細取得成功:', deal.id);
    
    // 詳細情報の整形
    const detailedDeal = {
      id: deal.id,
      company_id: deal.company_id,
      issue_date: deal.issue_date,
      due_date: deal.due_date,
      amount: deal.amount,
      due_amount: deal.due_amount,
      type: deal.type,
      partner_id: deal.partner_id,
      partner_code: deal.partner_code,
      ref_number: deal.ref_number,
      status: deal.status,
      deal_origin_name: deal.deal_origin_name,
      
      // 明細情報（勘定科目など）
      details: deal.details?.map((detail: any) => ({
        id: detail.id,
        account_item_id: detail.account_item_id,
        tax_code: detail.tax_code,
        item_id: detail.item_id,
        section_id: detail.section_id,
        tag_ids: detail.tag_ids,
        amount: detail.amount,
        vat: detail.vat,
        description: detail.description,
        entry_side: detail.entry_side
      })) || [],
      
      // 支払情報
      payments: deal.payments || [],
      
      // 領収書情報
      receipts: deal.receipts || [],
      
      // 追加情報
      created_at: deal.created_at,
      updated_at: deal.updated_at
    };
    
    return json({
      success: true,
      data: detailedDeal,
      message: '取引詳細を取得しました'
    });
    
  } catch (error) {
    console.error('Deal詳細取得エラー:', error);
    
    return json({
      success: false,
      error: 'データ取得中にエラーが発生しました',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

// 取引データの更新（PUT）
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const dealId = params.id;
    const updateData = await request.json();
    
    console.log('=== Deal更新 ===');
    console.log('Deal ID:', dealId);
    console.log('Update Data:', updateData);
    
    // TODO: freee API での取引更新を実装
    // PUT /api/1/deals/{id}
    
    return json({
      success: false,
      error: '取引更新機能は実装予定です',
      todo: 'freee API PUT /api/1/deals/{id} の実装'
    }, { status: 501 });
    
  } catch (error) {
    console.error('Deal更新エラー:', error);
    
    return json({
      success: false,
      error: '更新中にエラーが発生しました'
    }, { status: 500 });
  }
};