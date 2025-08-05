import type { Handle } from '@sveltejs/kit';
import { handleHttpError } from '$lib/monitoring/http-monitor';

export const handle: Handle = async ({ event, resolve }) => {
  try {
    const response = await resolve(event);
    
    // エラーステータスを監視
    if (response.status >= 400) {
      handleHttpError(event, response.status, `HTTP ${response.status} Error`);
    }
    
    return response;
  } catch (error) {
    // 500エラーを監視
    handleHttpError(event, 500, error?.message || 'Internal Server Error');
    throw error;
  }
};