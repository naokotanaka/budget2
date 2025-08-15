/**
 * デバッグログ制御ユーティリティ
 * 環境変数 DEBUG=true でデバッグログを有効化
 */

const isDebugMode = import.meta.env.VITE_DEBUG === 'true' || false;

// Console method parameter types
type ConsoleArgs = Parameters<typeof console.log>;
type ConsoleTableArg = Parameters<typeof console.table>[0];

export const debug = {
  log: (...args: ConsoleArgs): void => {
    if (isDebugMode) {
      console.log(...args);
    }
  },
  warn: (...args: ConsoleArgs): void => {
    if (isDebugMode) {
      console.warn(...args);
    }
  },
  error: (...args: ConsoleArgs): void => {
    // エラーは常に表示
    console.error(...args);
  },
  table: (data: ConsoleTableArg, columns?: string[]): void => {
    if (isDebugMode) {
      console.table(data, columns);
    }
  },
  time: (label: string): void => {
    if (isDebugMode) {
      console.time(label);
    }
  },
  timeEnd: (label: string): void => {
    if (isDebugMode) {
      console.timeEnd(label);
    }
  }
};