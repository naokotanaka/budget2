/**
 * デバッグログ制御ユーティリティ
 * 環境変数 DEBUG=true でデバッグログを有効化
 */

const isDebugMode = import.meta.env.VITE_DEBUG === 'true' || false;

export const debug = {
  log: (...args: any[]) => {
    if (isDebugMode) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDebugMode) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // エラーは常に表示
    console.error(...args);
  },
  table: (...args: any[]) => {
    if (isDebugMode) {
      console.table(...args);
    }
  },
  time: (label: string) => {
    if (isDebugMode) {
      console.time(label);
    }
  },
  timeEnd: (label: string) => {
    if (isDebugMode) {
      console.timeEnd(label);
    }
  }
};