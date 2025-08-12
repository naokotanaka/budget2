#!/usr/bin/env tsx
/**
 * 少数の取引だけ同期してログを確認
 */

async function testSmallSync() {
  try {
    console.log('=== テスト同期開始 ===');
    
    const response = await fetch('https://nagaiku.top/budget2/api/freee/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: '2025-08-10',
        endDate: '2025-08-10',
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
testSmallSync();