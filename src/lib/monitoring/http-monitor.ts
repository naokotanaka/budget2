/**
 * HTTPエラー自動検出・通知システム
 * 500/404などのエラーを即座に検出して対応を支援
 */

interface ErrorEvent {
  timestamp: Date;
  method: string;
  url: string;
  status: number;
  error: string;
  userAgent?: string;
  referer?: string;
}

class HTTPErrorMonitor {
  private errors: ErrorEvent[] = [];
  private readonly maxErrors = 100;
  
  // エラー通知設定
  private readonly criticalStatuses = [500, 502, 503, 504];
  private readonly warningStatuses = [404, 403, 401];

  logError(req: any, status: number, error: string) {
    const errorEvent: ErrorEvent = {
      timestamp: new Date(),
      method: req.method || 'Unknown',
      url: req.url || 'Unknown',
      status,
      error,
      userAgent: req.headers?.['user-agent'],
      referer: req.headers?.referer
    };

    this.errors.unshift(errorEvent);
    if (this.errors.length > this.maxErrors) {
      this.errors.pop();
    }

    // 即座に通知
    this.notifyError(errorEvent);
  }

  private notifyError(errorEvent: ErrorEvent) {
    const severity = this.getSeverity(errorEvent.status);
    const prefix = severity === 'critical' ? '🚨' : '⚠️';
    
    console.group(`${prefix} HTTP ${errorEvent.status} Error - ${severity.toUpperCase()}`);
    console.error(`${errorEvent.method} ${errorEvent.url}`);
    console.error(`Error: ${errorEvent.error}`);
    console.log(`Time: ${errorEvent.timestamp.toISOString()}`);
    if (errorEvent.referer) console.log(`Referer: ${errorEvent.referer}`);
    
    // 自動対応提案
    const suggestions = this.getSuggestions(errorEvent);
    if (suggestions.length > 0) {
      console.log('💡 Suggested fixes:');
      suggestions.forEach(s => console.log(`  - ${s}`));
    }
    console.groupEnd();
  }

  private getSeverity(status: number): 'critical' | 'warning' | 'info' {
    if (this.criticalStatuses.includes(status)) return 'critical';
    if (this.warningStatuses.includes(status)) return 'warning';
    return 'info';
  }

  private getSuggestions(errorEvent: ErrorEvent): string[] {
    const suggestions: string[] = [];
    const { status, url, method } = errorEvent;

    switch (status) {
      case 404:
        suggestions.push(`Check if route exists: ${url}`);
        suggestions.push('Verify routing configuration in src/routes/');
        if (url.includes('/api/')) {
          suggestions.push('Check API endpoint file: src/routes/api/.../+server.ts');
        }
        break;
      
      case 500:
        suggestions.push('Check server logs for detailed error');
        suggestions.push('Verify database connection');
        suggestions.push('Check environment variables');
        break;
      
      case 502:
      case 503:
      case 504:
        suggestions.push('Check if application server is running');
        suggestions.push('Verify Nginx proxy configuration');
        suggestions.push('Check port availability (3002)');
        break;
      
      case 403:
        suggestions.push('Check authentication/authorization');
        suggestions.push('Verify API permissions');
        break;
      
      case 401:
        suggestions.push('Check authentication token');
        suggestions.push('Verify login status');
        break;
    }

    return suggestions;
  }

  // エラー統計の取得
  getErrorStats() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp > lastHour);

    const stats = {
      total: this.errors.length,
      lastHour: recentErrors.length,
      byStatus: {} as Record<number, number>,
      byUrl: {} as Record<string, number>,
      mostRecent: this.errors.slice(0, 5)
    };

    recentErrors.forEach(error => {
      stats.byStatus[error.status] = (stats.byStatus[error.status] || 0) + 1;
      stats.byUrl[error.url] = (stats.byUrl[error.url] || 0) + 1;
    });

    return stats;
  }

  // 診断レポート生成
  generateDiagnosticReport() {
    const stats = this.getErrorStats();
    
    console.group('📊 HTTP Error Diagnostic Report');
    console.log(`Total errors: ${stats.total}`);
    console.log(`Errors in last hour: ${stats.lastHour}`);
    
    if (Object.keys(stats.byStatus).length > 0) {
      console.log('Errors by status:');
      console.table(stats.byStatus);
    }
    
    if (Object.keys(stats.byUrl).length > 0) {
      console.log('Errors by URL:');
      console.table(stats.byUrl);
    }
    
    if (stats.mostRecent.length > 0) {
      console.log('Most recent errors:');
      console.table(stats.mostRecent.map(e => ({
        time: e.timestamp.toLocaleTimeString(),
        status: e.status,
        method: e.method,
        url: e.url,
        error: e.error.substring(0, 50) + '...'
      })));
    }
    
    console.groupEnd();
  }
}

export const httpMonitor = new HTTPErrorMonitor();

// SvelteKit用のエラーハンドラー
export function handleHttpError(event: any, status: number, error: string) {
  httpMonitor.logError(event.request, status, error);
}

// 定期診断レポート（開発時のみ）
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  setInterval(() => {
    const stats = httpMonitor.getErrorStats();
    if (stats.lastHour > 0) {
      httpMonitor.generateDiagnosticReport();
    }
  }, 5 * 60 * 1000); // 5分ごと
}