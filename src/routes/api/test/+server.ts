import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return json({ message: 'APIが正常に動作しています', timestamp: new Date().toISOString() });
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    return json({ 
      message: 'POSTリクエストを受信しました', 
      received: data,
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    return json({ 
      error: 'リクエスト解析エラー',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 400 });
  }
};