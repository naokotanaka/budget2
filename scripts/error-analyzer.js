#!/usr/bin/env node
/**
 * エラーログ分析スクリプト
 * Nginxログ、アプリケーションログから500/404エラーを抽出・分析
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ErrorAnalyzer {
  constructor() {
    this.nginxAccessLog = '/var/log/nginx/access.log';
    this.nginxErrorLog = '/var/log/nginx/error.log';
  }

  // 最近のHTTPエラーを抽出
  extractRecentErrors(minutes = 60) {
    console.log(`🔍 Analyzing errors from the last ${minutes} minutes...\n`);

    try {
      // Nginxアクセスログから5xx, 4xxエラーを抽出
      const nginxErrors = this.extractNginxErrors(minutes);
      
      // アプリケーションログからエラーを抽出
      const appErrors = this.extractAppErrors(minutes);
      
      this.generateReport(nginxErrors, appErrors);
      
    } catch (error) {
      console.error('❌ Error analyzing logs:', error.message);
      this.suggestManualCheck();
    }
  }

  extractNginxErrors(minutes) {
    const errors = { '5xx': [], '4xx': [] };
    
    try {
      // 最近のログを取得（tailと時間フィルタリング）
      const logCmd = `sudo tail -n 1000 ${this.nginxAccessLog} | grep -E " (4[0-9]{2}|5[0-9]{2}) "`;
      const logs = execSync(logCmd, { encoding: 'utf8' }).split('\n').filter(Boolean);
      
      logs.forEach(line => {
        const match = line.match(/(\S+) - - \[(.*?)\] "(\S+) (\S+) (\S+)" (\d{3}) (\d+)/);
        if (match) {
          const [, ip, timestamp, method, url, protocol, status, size] = match;
          const statusCode = parseInt(status);
          
          const errorInfo = {
            timestamp,
            ip,
            method,
            url,
            status: statusCode,
            size: parseInt(size)
          };
          
          if (statusCode >= 500) {
            errors['5xx'].push(errorInfo);
          } else if (statusCode >= 400) {
            errors['4xx'].push(errorInfo);
          }
        }
      });
    } catch (error) {
      console.warn('⚠️ Could not read Nginx logs:', error.message);
    }
    
    return errors;
  }

  extractAppErrors(minutes) {
    // プロセスから直近のログを取得
    try {
      const logs = execSync('journalctl --user -u nagaiku-budget-v2 --since "60 minutes ago" --no-pager', 
        { encoding: 'utf8' }).split('\n');
      
      return logs.filter(line => 
        line.includes('Error') || 
        line.includes('Exception') || 
        line.includes('500') ||
        line.includes('404')
      );
    } catch (error) {
      // systemdサービスがない場合は他の方法を試す
      try {
        const pm2Logs = execSync('pm2 logs nagaiku-budget-v2 --lines 100 --nostream', 
          { encoding: 'utf8' });
        return pm2Logs.split('\n').filter(line => 
          line.includes('Error') || line.includes('Exception')
        );
      } catch (pm2Error) {
        console.warn('⚠️ Could not read application logs');
        return [];
      }
    }
  }

  generateReport(nginxErrors, appErrors) {
    console.log('📊 ERROR ANALYSIS REPORT');
    console.log('=' * 50);
    
    // 5xxエラー（サーバーエラー）
    if (nginxErrors['5xx'].length > 0) {
      console.log(`\n🚨 SERVER ERRORS (5xx): ${nginxErrors['5xx'].length} found`);
      const grouped5xx = this.groupErrorsByUrl(nginxErrors['5xx']);
      
      Object.entries(grouped5xx).forEach(([url, errors]) => {
        console.log(`  ${url}: ${errors.length} times`);
        console.log(`    Most recent: ${errors[0].timestamp}`);
        console.log(`    Status codes: ${[...new Set(errors.map(e => e.status))].join(', ')}`);
      });
      
      // 修正提案
      console.log('\n💡 IMMEDIATE ACTIONS for 5xx errors:');
      console.log('  1. Check application server status: ps aux | grep node');
      console.log('  2. Check port 3002: ss -tlnp | grep 3002');
      console.log('  3. Restart application: npm run dev');
      console.log('  4. Check recent code changes for bugs');
    }
    
    // 4xxエラー（クライアントエラー）
    if (nginxErrors['4xx'].length > 0) {
      console.log(`\n⚠️ CLIENT ERRORS (4xx): ${nginxErrors['4xx'].length} found`);
      const grouped4xx = this.groupErrorsByUrl(nginxErrors['4xx']);
      
      Object.entries(grouped4xx).slice(0, 5).forEach(([url, errors]) => {
        console.log(`  ${url}: ${errors.length} times (${errors[0].status})`);
      });
      
      // 404エラーの分析
      const notFoundErrors = nginxErrors['4xx'].filter(e => e.status === 404);
      if (notFoundErrors.length > 0) {
        console.log('\n💡 IMMEDIATE ACTIONS for 404 errors:');
        console.log('  1. Check if routes exist in src/routes/');
        console.log('  2. Verify routing configuration');
        console.log('  3. Check for typos in URLs');
      }
    }
    
    // アプリケーションエラー
    if (appErrors.length > 0) {
      console.log(`\n🔧 APPLICATION LOGS: ${appErrors.length} error entries`);
      appErrors.slice(0, 3).forEach(log => {
        console.log(`  ${log.substring(0, 100)}...`);
      });
    }
    
    // クイックフィックスコマンド
    console.log('\n⚡ QUICK FIX COMMANDS:');
    console.log('  Health check: curl -I https://nagaiku.top/budget2/');
    console.log('  Restart app:  npm run dev');
    console.log('  Check ports:  ss -tlnp | grep -E "(3002|80|443)"');
    console.log('  Nginx reload: sudo systemctl reload nginx');
    console.log('  View logs:    tail -f /var/log/nginx/access.log');
  }

  groupErrorsByUrl(errors) {
    return errors.reduce((acc, error) => {
      const url = error.url || 'unknown';
      if (!acc[url]) acc[url] = [];
      acc[url].push(error);
      return acc;
    }, {});
  }

  suggestManualCheck() {
    console.log('\n🔧 MANUAL CHECKS (if automatic analysis failed):');
    console.log('  1. sudo tail -n 50 /var/log/nginx/access.log | grep -E " (4[0-9]{2}|5[0-9]{2}) "');
    console.log('  2. sudo tail -n 50 /var/log/nginx/error.log');
    console.log('  3. ps aux | grep -E "(node|npm)"');
    console.log('  4. curl -I https://nagaiku.top/budget2/');
    console.log('  5. ss -tlnp | grep 3002');
  }

  // リアルタイム監視
  watchErrors() {
    console.log('👀 Starting real-time error monitoring...');
    console.log('Press Ctrl+C to stop\n');
    
    try {
      execSync(`sudo tail -f ${this.nginxAccessLog} | grep --line-buffered -E " (4[0-9]{2}|5[0-9]{2}) " | while read line; do
        echo "🚨 $(date): $line"
        echo "  💡 Quick check: curl -I \$(echo "$line" | cut -d' ' -f7)"
      done`, { stdio: 'inherit' });
    } catch (error) {
      console.log('Monitoring stopped.');
    }
  }
}

// コマンドライン実行
const analyzer = new ErrorAnalyzer();
const command = process.argv[2];

switch (command) {
  case 'analyze':
    const minutes = parseInt(process.argv[3]) || 60;
    analyzer.extractRecentErrors(minutes);
    break;
  case 'watch':
    analyzer.watchErrors();
    break;
  default:
    console.log('Usage:');
    console.log('  node error-analyzer.js analyze [minutes]  - Analyze recent errors');
    console.log('  node error-analyzer.js watch              - Real-time error monitoring');
    console.log('\nExamples:');
    console.log('  node error-analyzer.js analyze 30   # Last 30 minutes');
    console.log('  node error-analyzer.js watch        # Live monitoring');
}