/**
 * エラー監視・自動検出システム
 * 開発時のデバッグを効率化するためのツール
 */

import { dev } from '$app/environment';

interface ErrorInfo {
  timestamp: string;
  type: 'client' | 'server' | 'network';
  error: any;
  context?: Record<string, any>;
  stackTrace?: string;
}

class ErrorMonitor {
  private errors: ErrorInfo[] = [];
  private isEnabled = dev; // 開発時のみ有効

  constructor() {
    if (this.isEnabled) {
      this.setupGlobalErrorHandlers();
    }
  }

  private setupGlobalErrorHandlers() {
    // 未キャッチエラーの監視
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureError('client', event.error, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      // Promise rejection の監視
      window.addEventListener('unhandledrejection', (event) => {
        this.captureError('client', event.reason, {
          promise: event.promise
        });
      });
    }
  }

  captureError(type: 'client' | 'server' | 'network', error: any, context?: Record<string, any>) {
    if (!this.isEnabled) return;

    const errorInfo: ErrorInfo = {
      timestamp: new Date().toISOString(),
      type,
      error: this.serializeError(error),
      context,
      stackTrace: error?.stack
    };

    this.errors.push(errorInfo);
    
    // 開発環境では即座にコンソール出力
    console.group(`🚨 [${type.toUpperCase()}] Error Detected`);
    console.error('Error:', error);
    console.log('Context:', context);
    console.log('Stack:', error?.stack);
    console.groupEnd();

    // エラーが蓄積したら自動で分析結果を出力
    if (this.errors.length > 0 && this.errors.length % 5 === 0) {
      this.analyzeErrors();
    }
  }

  private serializeError(error: any) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }

  analyzeErrors() {
    if (!this.isEnabled || this.errors.length === 0) return;

    console.group('📊 Error Analysis Report');
    
    const errorsByType = this.errors.reduce((acc, err) => {
      acc[err.type] = (acc[err.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.table(errorsByType);
    
    const recentErrors = this.errors.slice(-10);
    console.log('Recent errors:', recentErrors);
    
    // 共通パターンの分析
    const commonErrors = this.findCommonErrorPatterns();
    if (commonErrors.length > 0) {
      console.warn('Common error patterns detected:', commonErrors);
    }

    console.groupEnd();
  }

  private findCommonErrorPatterns() {
    const patterns = new Map<string, number>();
    
    this.errors.forEach(err => {
      const pattern = err.error?.message || err.error?.name || 'Unknown';
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });

    return Array.from(patterns.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  getErrors() {
    return this.errors;
  }

  clearErrors() {
    this.errors = [];
  }
}

export const errorMonitor = new ErrorMonitor();

// Svelte用のエラーキャッチャー
export function catchSvelteErrors(component: string) {
  return (error: any, context?: Record<string, any>) => {
    errorMonitor.captureError('client', error, {
      component,
      ...context
    });
  };
}

// fetch用のエラーキャッチャー
export async function safeFetch(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      errorMonitor.captureError('network', error, {
        url,
        status: response.status,
        statusText: response.statusText
      });
      throw error;
    }
    
    return response;
  } catch (error: any) {
    errorMonitor.captureError('network', error, {
      url,
      options
    });
    throw error;
  }
}