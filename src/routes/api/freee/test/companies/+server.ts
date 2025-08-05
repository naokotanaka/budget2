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
    console.log('=== freee Companies API Test ===');
    
    // トークン取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!tokenRecord) {
      return json({ 
        success: false, 
        error: 'No token found',
        count: 0
      }, { status: 401 });
    }
    
    if (new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'Token expired',
        count: 0
      }, { status: 401 });
    }
    
    console.log('Token info:', {
      scope: tokenRecord.scope,
      expires: tokenRecord.expiresAt
    });
    
    // API呼び出し
    const client = new FreeeAPIClient(getFreeeConfig());
    const companies = await client.getCompanies(tokenRecord.accessToken);
    
    console.log('Companies retrieved:', companies.length);
    
    return json({
      success: true,
      count: companies.length,
      data: companies.map(c => ({
        id: c.id,
        name: c.name,
        role: c.role
      }))
    });
    
  } catch (error) {
    console.error('Companies API test error:', error);
    
    return json({
      success: false,
      error: error.message,
      count: 0
    }, { status: 500 });
  }
};