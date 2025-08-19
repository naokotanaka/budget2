/**
 * ログレベル設定
 */
const LOG_LEVEL = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
} as const;

/**
 * 環境変数による設定
 * 開発環境では詳細ログ、本番環境では必要最小限のログ
 */
const currentLogLevel = process.env.NODE_ENV === 'production' 
  ? LOG_LEVEL.INFO 
  : LOG_LEVEL.DEBUG;

/**
 * デバッグフラグ - 特定の機能のデバッグログを制御
 */
const DEBUG_FLAGS = {
  SYNC_DETAILS: process.env.DEBUG_SYNC === 'true',
  TRANSACTION_COMPARISON: process.env.DEBUG_COMPARISON === 'true',
  DATA_TRANSFORMATION: process.env.DEBUG_TRANSFORM === 'true'
};

/**
 * ログ出力関数
 */
export const logger = {
  error: (message: string, data?: any) => {
    if (currentLogLevel >= LOG_LEVEL.ERROR) {
      console.error(`[ERROR] ${message}`, data ? data : '');
    }
  },

  warn: (message: string, data?: any) => {
    if (currentLogLevel >= LOG_LEVEL.WARN) {
      console.warn(`[WARN] ${message}`, data ? data : '');
    }
  },

  info: (message: string, data?: any) => {
    if (currentLogLevel >= LOG_LEVEL.INFO) {
      console.log(`[INFO] ${message}`, data ? data : '');
    }
  },

  debug: (message: string, data?: any) => {
    if (currentLogLevel >= LOG_LEVEL.DEBUG) {
      console.log(`[DEBUG] ${message}`, data ? data : '');
    }
  },

  // 特定機能のデバッグログ
  syncDetail: (message: string, data?: any) => {
    if (DEBUG_FLAGS.SYNC_DETAILS) {
      console.log(`[SYNC] ${message}`, data ? data : '');
    }
  },

  comparison: (message: string, data?: any) => {
    if (DEBUG_FLAGS.TRANSACTION_COMPARISON) {
      console.log(`[COMPARE] ${message}`, data ? data : '');
    }
  },

  transform: (message: string, data?: any) => {
    if (DEBUG_FLAGS.DATA_TRANSFORMATION) {
      console.log(`[TRANSFORM] ${message}`, data ? data : '');
    }
  }
};

/**
 * エラー情報を安全に文字列化
 */
export function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error: any) {
    return `[Stringify Error: ${String(obj)}]`;
  }
}

/**
 * パフォーマンス計測
 */
export class PerformanceTimer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
    logger.debug(`⏱️ ${label} 開始`);
  }

  end(): number {
    const duration = Date.now() - this.startTime;
    logger.debug(`⏱️ ${this.label} 完了: ${duration}ms`);
    return duration;
  }
}