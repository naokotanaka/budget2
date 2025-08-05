import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { prisma } from '$lib/database';

const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID || '';
const FREEE_CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET || '';
const FREEE_REDIRECT_URI = process.env.FREEE_REDIRECT_URI || 'https://nagaiku.top/budget2/auth/freee/callback';
const FREEE_BASE_URL = process.env.FREEE_BASE_URL || 'https://api.freee.co.jp';

function getFreeeConfig() {
  return {
    clientId: FREEE_CLIENT_ID,
    clientSecret: FREEE_CLIENT_SECRET,
    redirectUri: FREEE_REDIRECT_URI,
    baseUrl: FREEE_BASE_URL
  };
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    console.log('=== freee Journal-Deal Mapping 開始 ===');
    
    const startDate = url.searchParams.get('start_date') || '2025-01-01';
    const endDate = url.searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    
    console.log('取得期間:', { startDate, endDate });
    
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'Invalid or expired token',
        count: 0
      }, { status: 401 });
    }
    
    const client = new FreeeAPIClient(getFreeeConfig());
    
    // 会社IDを取得
    const companies = await client.getCompanies(tokenRecord.accessToken);
    if (companies.length === 0) {
      return json({
        success: false,
        error: 'No companies found',
        count: 0
      }, { status: 404 });
    }
    
    const companyId = companies[0].id;
    console.log('使用する会社ID:', companyId);
    
    // 1. deals APIから取引データを取得
    console.log('=== Deals API データ取得 ===');
    const deals = await client.getDeals(
      tokenRecord.accessToken,
      companyId,
      startDate,
      endDate,
      200
    );
    
    console.log('取引データ取得完了:', deals.length, '件');
    
    // 2. journals APIから仕訳データを取得（CSV形式）
    console.log('=== Journals API データ取得開始 ===');
    let journalData = [];
    try {
      journalData = await client.getJournalsComplete(
        tokenRecord.accessToken,
        companyId,
        startDate,
        endDate,
        600000 // 10分タイムアウト
      );
      console.log('仕訳データ取得完了:', journalData.length, '件');
    } catch (journalError) {
      console.warn('Journals API取得失敗:', journalError.message);
      // deals APIデータのみで処理を継続
    }
    
    // 3. マッピング情報を作成
    const mapping = [];
    const dealIdToJournalMap = new Map();
    
    // journalデータから取引IDと仕訳番号の対応を作成
    if (journalData.length > 0) {
      console.log('=== Journals データ解析 ===');
      console.log('最初の仕訳データサンプル:', journalData[0]);
      
      // CSVヘッダーから仕訳番号と取引IDのフィールドを特定
      const journalNumberField = Object.keys(journalData[0]).find(key => 
        key.includes('仕訳番号') || key.includes('journal_number') || key.includes('txn_number')
      );
      const dealIdField = Object.keys(journalData[0]).find(key => 
        key.includes('取引ID') || key.includes('deal_id') || key.includes('transaction_id')
      );
      
      console.log('検出されたフィールド:', { journalNumberField, dealIdField });
      
      journalData.forEach(journal => {
        const journalNumber = journal[journalNumberField];
        const dealId = journal[dealIdField];
        
        if (journalNumber && dealId) {
          if (!dealIdToJournalMap.has(dealId)) {
            dealIdToJournalMap.set(dealId, []);
          }
          dealIdToJournalMap.get(dealId).push(journalNumber);
        }
      });
    }
    
    // 4. deals データと組み合わせてマッピング情報を生成
    deals.forEach(deal => {
      const journalNumbers = dealIdToJournalMap.get(deal.id.toString()) || [];
      
      if (deal.details && Array.isArray(deal.details)) {
        deal.details.forEach((detail, lineIndex) => {
          const mappingEntry = {
            // 新システム形式 (取引ID_行番号)
            new_id: `${deal.id}_${lineIndex + 1}`,
            deal_id: deal.id,
            line_number: lineIndex + 1,
            
            // 旧システム形式 (仕訳番号_行番号) - 推定
            old_id: journalNumbers.length > 0 ? 
              `${journalNumbers[0]}_${lineIndex + 1}` : null,
            journal_number: journalNumbers.length > 0 ? journalNumbers[0] : null,
            
            // メタデータ
            issue_date: deal.issue_date,
            amount: detail.amount,
            account_item_id: detail.account_item_id,
            partner_id: deal.partner_id,
            description: detail.description || deal.ref_number,
            
            // マッピング情報
            has_journal_number: journalNumbers.length > 0,
            multiple_journals: journalNumbers.length > 1,
            all_journal_numbers: journalNumbers
          };
          
          mapping.push(mappingEntry);
        });
      }
    });
    
    // 統計情報
    const stats = {
      total_entries: mapping.length,
      with_journal_number: mapping.filter(m => m.has_journal_number).length,
      without_journal_number: mapping.filter(m => !m.has_journal_number).length,
      unique_deals: new Set(mapping.map(m => m.deal_id)).size,
      unique_journals: new Set(mapping.filter(m => m.journal_number).map(m => m.journal_number)).size
    };
    
    console.log('=== マッピング統計 ===');
    console.log(stats);
    
    return json({
      success: true,
      mapping: mapping,
      stats: stats,
      sample_mappings: mapping.slice(0, 10), // 最初の10件をサンプルとして
      journal_data_available: journalData.length > 0,
      deals_count: deals.length,
      journals_count: journalData.length
    });
    
  } catch (error) {
    console.error('Journal-Deal mapping error:', error);
    
    return json({
      success: false,
      error: error.message,
      count: 0
    }, { status: 500 });
  }
};