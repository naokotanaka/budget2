#!/usr/bin/env node

/**
 * 旧システムのデータを使って、allocation_splitsテーブルのdetailIdを更新するスクリプト
 * 
 * 処理の流れ：
 * 1. 旧DBから割当データとトランザクションのfreee_deal_idを取得
 * 2. freee APIでdeal詳細を取得してdetailIdを取得
 * 3. 本番DBのallocation_splitsを更新
 */

import { PrismaClient } from '@prisma/client';
import pg from 'pg';
const { Client } = pg;

const prisma = new PrismaClient();

// 旧データベース接続
const oldDb = new Client({
  host: 'localhost',
  user: 'nagaiku_user',
  password: 'nagaiku_password2024',
  database: 'nagaiku_budget_dev',
  port: 5432
});

// freee API設定
const FREEE_BASE_URL = 'https://api.freee.co.jp';

async function getFreeeToken() {
  const token = await prisma.freeeToken.findFirst({
    orderBy: { updatedAt: 'desc' }
  });
  
  if (!token || new Date() >= token.expiresAt) {
    throw new Error('有効なfreeeトークンが見つかりません');
  }
  
  return token.accessToken;
}

async function getCompanyId(accessToken) {
  const response = await fetch(`${FREEE_BASE_URL}/api/1/companies`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('会社情報の取得に失敗しました');
  }
  
  const data = await response.json();
  if (data.companies && data.companies.length > 0) {
    return data.companies[0].id;
  }
  
  throw new Error('会社が見つかりません');
}

async function getDealDetail(dealId, accessToken, companyId) {
  try {
    const response = await fetch(
      `${FREEE_BASE_URL}/api/1/deals/${dealId}?company_id=${companyId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.error(`Deal ${dealId} の取得に失敗: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data.deal && data.deal.details && data.deal.details.length > 0) {
      return data.deal.details[0].id; // 最初の明細のIDを返す
    }
    
    return null;
  } catch (error) {
    console.error(`Deal ${dealId} の取得エラー:`, error);
    return null;
  }
}

async function main() {
  try {
    console.log('🚀 割当データのdetailId更新処理を開始します...');
    
    // DB接続
    await oldDb.connect();
    console.log('✅ 旧データベースに接続しました');
    
    // freeeトークン取得
    const accessToken = await getFreeeToken();
    const companyId = await getCompanyId(accessToken);
    console.log(`✅ freee API準備完了 (会社ID: ${companyId})`);
    
    // 旧DBから割当データを取得
    const result = await oldDb.query(`
      SELECT 
        a.id as allocation_id,
        a.budget_item_id,
        a.amount,
        t.freee_deal_id,
        t.journal_number,
        t.journal_line_number
      FROM allocations a
      JOIN transactions t ON a.transaction_id = t.id
      WHERE a.amount > 0
      ORDER BY a.id
    `);
    
    console.log(`📊 ${result.rows.length}件の割当データを処理します`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // バッチ処理（API制限を考慮）
    const batchSize = 5;
    for (let i = 0; i < result.rows.length; i += batchSize) {
      const batch = result.rows.slice(i, Math.min(i + batchSize, result.rows.length));
      
      await Promise.all(batch.map(async (row) => {
        try {
          // freee_deal_idがない場合はスキップ
          if (!row.freee_deal_id) {
            console.log(`⚠️ 割当 ${row.allocation_id}: freee_deal_idがありません`);
            skippedCount++;
            return;
          }
          
          // freee APIから明細IDを取得
          const detailId = await getDealDetail(row.freee_deal_id, accessToken, companyId);
          
          if (!detailId) {
            console.log(`⚠️ 割当 ${row.allocation_id}: Deal ${row.freee_deal_id} の明細IDが取得できません`);
            errorCount++;
            return;
          }
          
          // 本番DBのallocation_splitsを検索して更新
          // 金額と予算項目IDでマッチング
          const updated = await prisma.allocationSplit.updateMany({
            where: {
              budgetItemId: row.budget_item_id,
              amount: row.amount,
              detailId: null // まだdetailIdが設定されていないもの
            },
            data: {
              detailId: BigInt(detailId)
            }
          });
          
          if (updated.count > 0) {
            console.log(`✅ 割当更新: 予算項目${row.budget_item_id}, 金額${row.amount}, detailId=${detailId}`);
            updatedCount++;
          } else {
            console.log(`⚠️ 割当 ${row.allocation_id}: マッチする割当が見つかりません`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ 割当 ${row.allocation_id} の処理エラー:`, error);
          errorCount++;
        }
      }));
      
      // API制限対策のため少し待機
      if (i + batchSize < result.rows.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('');
    console.log('🎉 処理完了');
    console.log(`✅ 更新: ${updatedCount}件`);
    console.log(`⚠️ スキップ: ${skippedCount}件`);
    console.log(`❌ エラー: ${errorCount}件`);
    
  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
  }
}

main().catch(console.error);