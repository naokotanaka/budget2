import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { startDate, endDate } = await request.json();
    
    console.log('=== Data Structure Test ===');
    console.log('Requesting data from /api/freee/data');
    
    // 実際のdata APIを呼び出し
    const response = await fetch('https://nagaiku.top/budget2/api/freee/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ startDate, endDate })
    });
    
    if (!response.ok) {
      return json({
        success: false,
        error: `Data API returned ${response.status}`
      }, { status: response.status });
    }
    
    const data = await response.json();
    
    // 最初の3つの取引のタグ関連フィールドを抽出
    const tagData = data.transactions?.slice(0, 3).map(tx => ({
      deal_id: tx.deal_id,
      amount: tx.amount,
      
      // 明細レベルのタグフィールド
      tag_ids: tx.tag_ids,
      tag_names: tx.tag_names,
      
      // 取引レベルのタグフィールド
      deal_tag_ids: tx.deal_tag_ids,
      deal_tag_names: tx.deal_tag_names,
      
      // detailsが存在する場合
      details: tx.details ? tx.details.map(d => ({
        tag_ids: d.tag_ids,
        tag_names: d.tag_names
      })) : undefined,
      
      // すべてのフィールド名を確認
      all_fields: Object.keys(tx)
    }));
    
    return json({
      success: true,
      totalTransactions: data.transactions?.length || 0,
      tagData: tagData,
      sampleTransaction: data.transactions?.[0]
    });
    
  } catch (error: any) {
    console.error('Data structure test error:', error);
    
    return json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};