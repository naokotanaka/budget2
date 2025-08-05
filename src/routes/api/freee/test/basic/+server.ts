import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/database';

export const GET: RequestHandler = async () => {
  try {
    console.log('=== Basic freee Test ===');
    console.log('Time:', new Date().toISOString());
    
    // 環境変数チェック
    const envCheck = {
      FREEE_CLIENT_ID: !!process.env.FREEE_CLIENT_ID && process.env.FREEE_CLIENT_ID !== 'your_freee_client_id_here',
      FREEE_CLIENT_SECRET: !!process.env.FREEE_CLIENT_SECRET,
      FREEE_REDIRECT_URI: !!process.env.FREEE_REDIRECT_URI,
      FREEE_BASE_URL: process.env.FREEE_BASE_URL || 'https://api.freee.co.jp'
    };
    
    console.log('Environment check:', envCheck);
    
    // データベース接続チェック
    let dbStatus = 'unknown';
    let tokenInfo = null;
    
    try {
      const tokenRecord = await prisma.freeeToken.findFirst({
        orderBy: { updatedAt: 'desc' }
      });
      
      dbStatus = 'connected';
      tokenInfo = tokenRecord ? {
        exists: true,
        expired: new Date() >= tokenRecord.expiresAt,
        scope: tokenRecord.scope,
        expiresAt: tokenRecord.expiresAt.toISOString(),
        tokenLength: tokenRecord.accessToken.length
      } : { exists: false };
      
    } catch (dbError) {
      console.error('Database error:', dbError);
      dbStatus = 'error: ' + dbError.message;
    }
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: dbStatus,
      token: tokenInfo
    };
    
    console.log('Basic test result:', JSON.stringify(result, null, 2));
    
    return json(result);
    
  } catch (error) {
    console.error('=== Basic Test Error ===');
    console.error('Error:', error);
    
    return json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};