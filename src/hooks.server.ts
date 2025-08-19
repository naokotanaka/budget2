import type { Handle } from '@sveltejs/kit';
// import { handleHttpError } from '$lib/monitoring/http-monitor';

export const handle: Handle = async ({ event, resolve }) => {
  // Nginx経由のリクエストでOriginヘッダーが正しく転送されない問題を修正
  // X-Forwarded-* ヘッダーからOriginを復元
  const headers = event.request.headers;
  if (!headers.get('origin') && headers.get('x-forwarded-host')) {
    const protocol = headers.get('x-forwarded-proto') || 'https';
    const host = headers.get('x-forwarded-host');
    if (host) {
      // Originヘッダーを設定
      Object.defineProperty(event.request.headers, 'get', {
        value: function(name: string) {
          if (name.toLowerCase() === 'origin') {
            return `${protocol}://${host}`;
          }
          return Headers.prototype.get.call(this, name);
        },
        configurable: true
      });
    }
  }
  
  try {
    const response = await resolve(event);
    
    // エラーステータスを監視（一時的に無効化）
    // if (response.status >= 400) {
    //   handleHttpError(event, response.status, `HTTP ${response.status} Error`);
    // }
    
    return response;
  } catch (error: any) {
    // 500エラーを監視（一時的に無効化）
    // handleHttpError(event, 500, error?.message || 'Internal Server Error');
    console.error('Server error:', error);
    throw error;
  }
};