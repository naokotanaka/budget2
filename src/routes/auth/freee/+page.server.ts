import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
// 環境変数を直接読み込み
const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID || '';
const FREEE_CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET || '';
const FREEE_REDIRECT_URI = process.env.FREEE_REDIRECT_URI || 'https://nagaiku.top/budget2/auth/freee/callback';
const FREEE_BASE_URL = process.env.FREEE_BASE_URL || 'https://api.freee.co.jp';

export const load: PageServerLoad = async ({ url }) => {
  // freee API設定チェック
  if (!FREEE_CLIENT_ID || !FREEE_CLIENT_SECRET || 
      FREEE_CLIENT_ID === 'your_freee_client_id_here') {
    return {
      error: 'freee API設定が不完全です。環境変数を設定してください。',
      needsConfig: true
    };
  }

  const client = new FreeeAPIClient({
    clientId: FREEE_CLIENT_ID,
    clientSecret: FREEE_CLIENT_SECRET,
    redirectUri: FREEE_REDIRECT_URI,
    baseUrl: FREEE_BASE_URL
  });

  // 認証状態をランダムに生成
  const state = crypto.randomUUID();
  
  // 認証URLを生成
  const authUrl = client.generateAuthUrl(state);

  return {
    authUrl,
    state,
    needsConfig: false
  };
};