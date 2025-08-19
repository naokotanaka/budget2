import type { PageServerLoad } from './$types';
import { prisma } from '$lib/database';

export const load: PageServerLoad = async () => {
  try {
    // freeeトークン情報を取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!tokenRecord) {
      return {
        tokenInfo: null,
        error: 'freee接続トークンが見つかりません'
      };
    }
    
    return {
      tokenInfo: {
        scope: tokenRecord.scope,
        expiresAt: tokenRecord.expiresAt.toISOString(),
        tokenType: tokenRecord.tokenType,
        updatedAt: tokenRecord.updatedAt.toISOString()
      }
    };
  } catch (error: any) {
    console.error('診断情報取得エラー:', error);
    
    return {
      tokenInfo: null,
      error: 'データベース接続エラー'
    };
  }
};