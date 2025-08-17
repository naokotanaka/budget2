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

// GET: Receipt画像を取得してプロキシする
export const GET: RequestHandler = async ({ params }) => {
  try {
    const receiptId = params.receiptId;
    
    if (!receiptId) {
      return new Response('Receipt ID is required', { status: 400 });
    }

    console.log('=== Freee Receipt Image Proxy ===');
    console.log('Receipt ID:', receiptId);
    
    // 保存されたトークンを取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return new Response('freee authentication required', { status: 401 });
    }

    const client = new FreeeAPIClient(getFreeeConfig());
    const companyId = 1583780;  // NPO法人ながいくの会社ID

    // Receipt画像を取得
    const imageResponse = await client.downloadReceiptImage(
      tokenRecord.accessToken,
      companyId,
      Number(receiptId)
    );

    if (!imageResponse) {
      return new Response('Receipt image not found', { status: 404 });
    }

    // 画像データとコンテンツタイプを返す
    return new Response(imageResponse.buffer, {
      status: 200,
      headers: {
        'Content-Type': imageResponse.contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600', // 1時間キャッシュ
      }
    });

  } catch (error) {
    console.error('Receipt image proxy error:', error);
    return new Response('Failed to fetch receipt image', { status: 500 });
  }
};