#!/usr/bin/env tsx
/**
 * 全期間の同期を実行
 */

async function syncAll() {
  try {
    console.log('=== 全期間同期開始 ===');
    
    const response = await fetch('https://nagaiku.top/budget2/api/freee/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: '2025-04-01',
        endDate: '2025-08-31',
        companyId: 1583780
      })
    });

    const result = await response.json();
    console.log('同期結果:', result);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// 実行
syncAll();