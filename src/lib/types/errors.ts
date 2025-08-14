// エラーハンドリング関連の型定義

export interface ApiError extends Error {
  code?: string;
  status?: number;
  details?: Record<string, any>;
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'code' in error;
}

export function formatError(error: unknown): { message: string; code?: string; details?: any } {
  if (isApiError(error)) {
    return {
      message: error.message,
      code: error.code,
      details: error.details
    };
  }
  
  if (isError(error)) {
    return {
      message: error.message
    };
  }
  
  return {
    message: String(error)
  };
}

export function createApiError(message: string, code?: string, status?: number): ApiError {
  const error = new Error(message) as ApiError;
  error.code = code;
  error.status = status;
  return error;
}