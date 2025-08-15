/**
 * エラーハンドリング用の型定義
 * アプリケーション全体で使用されるエラー型を定義
 */

// 基本エラー型
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: Date | string;
  path?: string;
  method?: string;
  stack?: string;
}

// エラーレベル
export enum ErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// エラーカテゴリ
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  NETWORK = 'network',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_API = 'external_api',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

// 詳細なエラー情報
export interface DetailedError extends AppError {
  level: ErrorLevel;
  category: ErrorCategory;
  userId?: number | string;
  sessionId?: string;
  requestId?: string;
  context?: ErrorContext;
  metadata?: Record<string, unknown>;
}

// エラーコンテキスト
export interface ErrorContext {
  component?: string;
  action?: string;
  input?: Record<string, unknown>;
  environment?: 'development' | 'staging' | 'production';
  version?: string;
}

// バリデーションエラー
export interface ValidationError extends AppError {
  code: 'VALIDATION_ERROR';
  fields?: ValidationFieldError[];
}

export interface ValidationFieldError {
  field: string;
  value?: unknown;
  message: string;
  rule?: string;
}

// APIエラー
export interface APIError extends AppError {
  status: number;
  statusText?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  response?: unknown;
}

// データベースエラー
export interface DatabaseError extends AppError {
  code: string;
  query?: string;
  params?: unknown[];
  table?: string;
  constraint?: string;
  detail?: string;
}

// Prismaエラー
export interface PrismaError extends DatabaseError {
  clientVersion?: string;
  meta?: {
    target?: string[];
    modelName?: string;
    cause?: string;
  };
}

// freee APIエラー
export interface FreeeAPIError extends APIError {
  code: 'FREEE_API_ERROR';
  freeeStatusCode?: number;
  freeeErrors?: FreeeErrorDetail[];
  companyId?: number;
  endpoint?: string;
}

export interface FreeeErrorDetail {
  type?: string;
  message: string;
  messages?: string[];
  field?: string;
}

// ネットワークエラー
export interface NetworkError extends AppError {
  code: 'NETWORK_ERROR';
  type?: 'timeout' | 'connection_refused' | 'dns_failure' | 'ssl_error';
  hostname?: string;
  port?: number;
  protocol?: string;
  timeout?: number;
}

// 認証エラー
export interface AuthenticationError extends AppError {
  code: 'AUTHENTICATION_ERROR';
  type?: 'invalid_credentials' | 'token_expired' | 'token_invalid' | 'session_expired';
  realm?: string;
  scheme?: string;
}

// 認可エラー
export interface AuthorizationError extends AppError {
  code: 'AUTHORIZATION_ERROR';
  resource?: string;
  action?: string;
  requiredPermissions?: string[];
  userPermissions?: string[];
}

// ビジネスロジックエラー
export interface BusinessLogicError extends AppError {
  code: 'BUSINESS_LOGIC_ERROR';
  rule?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
}

// システムエラー
export interface SystemError extends AppError {
  code: 'SYSTEM_ERROR';
  type?: 'out_of_memory' | 'disk_full' | 'cpu_overload' | 'configuration';
  resource?: string;
  limit?: number;
  current?: number;
}

// エラーレスポンス
export interface ErrorResponse {
  success: false;
  error: AppError;
  timestamp: string;
  requestId?: string;
}

// エラーハンドラー型
export type ErrorHandler<T extends AppError = AppError> = (error: T) => void | Promise<void>;

// エラー変換関数型
export type ErrorTransformer<T = unknown, R extends AppError = AppError> = (error: T) => R;

// エラーフィルター関数型
export type ErrorFilter<T extends AppError = AppError> = (error: T) => boolean;

// エラーリカバリー関数型
export type ErrorRecovery<T extends AppError = AppError, R = void> = (error: T) => R | Promise<R>;

// エラーロギング設定
export interface ErrorLoggingConfig {
  level: ErrorLevel;
  includeStack: boolean;
  includeContext: boolean;
  includeMetadata: boolean;
  sanitizeFields?: string[];
  maxMessageLength?: number;
  destination?: 'console' | 'file' | 'remote' | 'all';
}

// エラー通知設定
export interface ErrorNotificationConfig {
  enabled: boolean;
  levels: ErrorLevel[];
  categories: ErrorCategory[];
  channels?: ('email' | 'slack' | 'webhook')[];
  throttle?: {
    maxPerMinute?: number;
    maxPerHour?: number;
  };
}

// エラー集計データ
export interface ErrorMetrics {
  totalErrors: number;
  errorsByLevel: Record<ErrorLevel, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByCode: Record<string, number>;
  topErrors: Array<{
    code: string;
    count: number;
    lastOccurred: Date;
  }>;
  errorRate: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
}

// エラー履歴
export interface ErrorHistory {
  id: string;
  error: DetailedError;
  occurredAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  affectedUsers?: number;
  impact?: 'low' | 'medium' | 'high' | 'critical';
}

// エラー型ガード関数
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as AppError).code === 'string' &&
    typeof (error as AppError).message === 'string'
  );
}

export function isValidationError(error: unknown): error is ValidationError {
  return isAppError(error) && error.code === 'VALIDATION_ERROR';
}

export function isAPIError(error: unknown): error is APIError {
  return (
    isAppError(error) &&
    'status' in error &&
    typeof (error as APIError).status === 'number'
  );
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    isAppError(error) &&
    'query' in error
  );
}

export function isPrismaError(error: unknown): error is PrismaError {
  return (
    isDatabaseError(error) &&
    'clientVersion' in error
  );
}

export function isFreeeAPIError(error: unknown): error is FreeeAPIError {
  return (
    isAPIError(error) &&
    error.code === 'FREEE_API_ERROR'
  );
}

export function isNetworkError(error: unknown): error is NetworkError {
  return isAppError(error) && error.code === 'NETWORK_ERROR';
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return isAppError(error) && error.code === 'AUTHENTICATION_ERROR';
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return isAppError(error) && error.code === 'AUTHORIZATION_ERROR';
}

export function isBusinessLogicError(error: unknown): error is BusinessLogicError {
  return isAppError(error) && error.code === 'BUSINESS_LOGIC_ERROR';
}

export function isSystemError(error: unknown): error is SystemError {
  return isAppError(error) && error.code === 'SYSTEM_ERROR';
}

// エラー生成ヘルパー関数
export function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

export function createValidationError(
  message: string,
  fields?: ValidationFieldError[]
): ValidationError {
  return {
    code: 'VALIDATION_ERROR',
    message,
    fields,
    timestamp: new Date().toISOString()
  };
}

export function createAPIError(
  status: number,
  message: string,
  url?: string,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
): APIError {
  return {
    code: 'API_ERROR',
    message,
    status,
    url,
    method,
    timestamp: new Date().toISOString()
  };
}

export function createDatabaseError(
  code: string,
  message: string,
  query?: string,
  params?: unknown[]
): DatabaseError {
  return {
    code,
    message,
    query,
    params,
    timestamp: new Date().toISOString()
  };
}

// エラー変換関数
export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
  }
  
  if (typeof error === 'string') {
    return {
      code: 'STRING_ERROR',
      message: error,
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    details: { originalError: error },
    timestamp: new Date().toISOString()
  };
}

// エラーサニタイズ関数
export function sanitizeError(error: AppError, fields: string[] = []): AppError {
  const sanitized = { ...error };
  
  // スタックトレースを削除
  delete sanitized.stack;
  
  // 指定されたフィールドを削除
  fields.forEach(field => {
    delete (sanitized as any)[field];
  });
  
  // 詳細情報をサニタイズ
  if (sanitized.details) {
    const sanitizedDetails = { ...sanitized.details };
    fields.forEach(field => {
      delete sanitizedDetails[field];
    });
    sanitized.details = sanitizedDetails;
  }
  
  return sanitized;
}