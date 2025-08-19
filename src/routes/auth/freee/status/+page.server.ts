import { prisma } from '$lib/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  try {
    // トークンの存在確認
    const token = await prisma.freeeToken.findFirst({
      where: { id: 1 }
    });

    if (!token) {
      return {
        authenticated: false,
        message: 'freee連携が設定されていません'
      };
    }

    // トークンの有効期限確認
    const isExpired = new Date() > new Date(token.expiresAt);
    
    return {
      authenticated: true,
      tokenExists: true,
      isExpired,
      expiresAt: token.expiresAt,
      message: isExpired ? 'トークンの有効期限が切れています' : 'freee連携が有効です'
    };
  } catch (error: any) {
    console.error('freee認証状態確認エラー:', error);
    return {
      authenticated: false,
      error: error.message,
      message: 'エラーが発生しました'
    };
  }
};