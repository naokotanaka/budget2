import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { prisma } from '$lib/database';
// 環境変数を直接読み込み
const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID || '';
const FREEE_CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET || '';
const FREEE_REDIRECT_URI = process.env.FREEE_REDIRECT_URI || 'https://nagaiku.top/budget2/auth/freee/callback';
const FREEE_BASE_URL = process.env.FREEE_BASE_URL || 'https://api.freee.co.jp';

export const load: PageServerLoad = async ({ url }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return {
      error: `認証エラー: ${error}`,
      success: false
    };
  }

  if (!code) {
    return {
      error: '認証コードが取得できませんでした',
      success: false
    };
  }

  try {
    const client = new FreeeAPIClient({
      clientId: FREEE_CLIENT_ID,
      clientSecret: FREEE_CLIENT_SECRET,
      redirectUri: FREEE_REDIRECT_URI,
      baseUrl: FREEE_BASE_URL
    });

    // 認証コードをアクセストークンに交換
    const token = await client.exchangeCodeForToken(code);
    
    // 会社情報を取得
    const companies = await client.getCompanies(token.accessToken);
    
    if (companies.length === 0) {
      return {
        error: 'アクセス可能な会社が見つかりませんでした',
        success: false
      };
    }

    // トークンをデータベースに保存
    await prisma.freeeToken.upsert({
      where: { id: 1 }, // 単一テナント想定
      update: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        tokenType: token.tokenType,
        scope: token.scope
      },
      create: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        tokenType: token.tokenType,
        scope: token.scope
      }
    });

    return {
      success: true,
      companies,
      tokenExpiresAt: token.expiresAt
    };

  } catch (error: any) {
    console.error('freee認証エラー:', error);
    return {
      error: `認証処理でエラーが発生しました: ${error.message}`,
      success: false
    };
  }
};