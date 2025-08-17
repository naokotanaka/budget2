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

// GET: dealIdから取引詳細とreceipts配列を取得
export const GET: RequestHandler = async ({ url }) => {
  try {
    const dealId = url.searchParams.get('dealId');
    
    if (!dealId) {
      return json({ 
        success: false, 
        error: '取引IDが必要です' 
      }, { status: 400 });
    }

    console.log('=== Freee Deal Detail API Request ===');
    console.log('Deal ID:', dealId);
    
    // まずデータベースからreceiptIdsを取得
    const transaction = await prisma.transaction.findFirst({
      where: { freeDealId: BigInt(dealId) },
      select: { receiptIds: true }
    });
    
    console.log('Transaction receiptIds from DB:', transaction?.receiptIds);

    // 保存されたトークンを取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'freeeの認証が必要です' 
      }, { status: 401 });
    }

    const client = new FreeeAPIClient(getFreeeConfig());
    
    // 会社IDは固定
    const companyId = 1583780;  // NPO法人ながいくの会社ID
    console.log('Company ID:', companyId);

    // receiptIdsがデータベースにある場合は、個別にレシート詳細を取得
    let receipts = [];
    
    if (transaction?.receiptIds) {
      let receiptIdArray = [];
      try {
        // JSON文字列の場合はパース
        if (typeof transaction.receiptIds === 'string') {
          receiptIdArray = JSON.parse(transaction.receiptIds);
        } else {
          receiptIdArray = transaction.receiptIds;
        }
      } catch (e) {
        console.error('Failed to parse receiptIds:', e);
      }
      
      console.log('Receipt IDs to fetch:', receiptIdArray);
      
      // 各レシートの詳細を取得
      for (const receiptId of receiptIdArray) {
        try {
          console.log(`Fetching receipt ${receiptId}...`);
          const receipt = await client.getReceiptDetail(
            tokenRecord.accessToken,
            companyId,
            Number(receiptId)
          );
          
          if (receipt) {
            console.log(`Receipt ${receiptId} details:`, {
              id: receipt.id,
              mime_type: receipt.mime_type,
              file_src: receipt.file_src,
              status: receipt.status
            });
            receipts.push(receipt);
          }
        } catch (error) {
          console.error(`Failed to get receipt ${receiptId}:`, error);
        }
      }
    } else {
      // DBにreceiptIdsがない場合は、Deal APIから取得を試みる
      const dealDetail = await client.getDealDetail(
        tokenRecord.accessToken,
        companyId,
        Number(dealId)
      );
      
      if (dealDetail) {
        receipts = dealDetail.receipts || [];
      }
    }
    
    console.log(`Total receipts fetched: ${receipts.length}`);

    return json({
      success: true,
      receipts: receipts
    });

  } catch (error) {
    console.error('取引詳細取得エラー:', error);
    return json({ 
      success: false, 
      error: '取引詳細の取得に失敗しました' 
    }, { status: 500 });
  }
};

// 既存のPOSTエンドポイントは残しておく（互換性のため）
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { receiptIds } = await request.json();
    
    if (!receiptIds || !Array.isArray(receiptIds)) {
      return json({ 
        success: false, 
        error: '領収書IDリストが必要です' 
      }, { status: 400 });
    }

    // 保存されたトークンを取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'freeeの認証が必要です' 
      }, { status: 401 });
    }

    const client = new FreeeAPIClient(getFreeeConfig());
    const companyId = 1583780;

    // 各領収書の詳細を取得
    const receipts = [];
    for (const receiptId of receiptIds) {
      try {
        const receipt = await client.getReceiptDetail(
          tokenRecord.accessToken,
          companyId,
          receiptId
        );
        
        if (receipt) {
          receipts.push(receipt);
        }
      } catch (error) {
        console.error(`領収書 ${receiptId} の取得に失敗:`, error);
      }
    }

    return json({
      success: true,
      receipts
    });

  } catch (error) {
    console.error('領収書取得エラー:', error);
    return json({ 
      success: false, 
      error: '領収書の取得に失敗しました' 
    }, { status: 500 });
  }
};