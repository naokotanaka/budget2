#!/usr/bin/env node

/**
 * 旧DBから割当データを取得し、freee APIでdetailIdを取得して
 * 本番DBに正しい形で移行するスクリプト
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

// IDジェネレーター（CUIDの代わりにシンプルなID生成）
function generateId() {
  return 'alloc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

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
      return {
        detailId: data.deal.details[0].id,
        dealData: data.deal
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Deal ${dealId} の取得エラー:`, error);
    return null;
  }
}

async function main() {
  try {
    console.log('🚀 旧DBから割当データを移行開始...');
    
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
        a.id as old_allocation_id,
        a.budget_item_id,
        a.amount,
        a.created_at,
        t.id as transaction_id,
        t.freee_deal_id,
        t.journal_number,
        t.journal_line_number,
        t.date as transaction_date,
        t.description,
        t.supplier
      FROM allocations a
      JOIN transactions t ON a.transaction_id = t.id
      WHERE a.amount > 0
      ORDER BY a.created_at, a.id
    `);
    
    console.log(`📊 ${result.rows.length}件の割当データを処理します`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // detailId取得用のキャッシュ（同じdealを何度も取得しないため）
    const dealCache = new Map();
    
    // バッチ処理
    const batchSize = 5;
    const allocationsToCreate = [];
    
    for (let i = 0; i < result.rows.length; i += batchSize) {
      const batch = result.rows.slice(i, Math.min(i + batchSize, result.rows.length));
      
      await Promise.all(batch.map(async (row) => {
        try {
          let detailId = null;
          
          // freee_deal_idがある場合はdetailIdを取得
          if (row.freee_deal_id) {
            // キャッシュから取得
            if (dealCache.has(row.freee_deal_id)) {
              detailId = dealCache.get(row.freee_deal_id);
            } else {
              // freee APIから取得
              const dealInfo = await getDealDetail(row.freee_deal_id, accessToken, companyId);
              if (dealInfo) {
                detailId = dealInfo.detailId;
                dealCache.set(row.freee_deal_id, detailId);
              }
            }
          }
          
          // 割当データを作成
          const allocationData = {
            id: generateId(),
            budgetItemId: row.budget_item_id,
            amount: row.amount,
            note: `旧システムから移行 (取引: ${row.transaction_id})`,
            detailId: detailId ? BigInt(detailId) : null,
            createdAt: row.created_at || new Date(),
            updatedAt: new Date()
          };
          
          allocationsToCreate.push(allocationData);
          
          if (detailId) {
            console.log(`✅ 割当 ${row.old_allocation_id}: detailId=${detailId} を設定`);
          } else {
            console.log(`⚠️ 割当 ${row.old_allocation_id}: detailIdなし (freee_deal_id: ${row.freee_deal_id})`);
          }
          
          successCount++;
        } catch (error) {
          console.error(`❌ 割当 ${row.old_allocation_id} の処理エラー:`, error);
          errorCount++;
        }
      }));
      
      // API制限対策のため少し待機
      if (i + batchSize < result.rows.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 本番DBに割当データを一括作成
    console.log('\n📝 本番DBに割当データを作成中...');
    
    if (allocationsToCreate.length > 0) {
      // PrismaのcreateMany は BigInt をサポートしていない場合があるので、個別に作成
      for (const allocation of allocationsToCreate) {
        try {
          await prisma.allocationSplit.create({
            data: allocation
          });
        } catch (error) {
          console.error(`割当作成エラー:`, error);
          errorCount++;
        }
      }
    }
    
    // 結果を確認
    const finalCount = await prisma.allocationSplit.count();
    const withDetailCount = await prisma.allocationSplit.count({
      where: {
        detailId: {
          not: null
        }
      }
    });
    
    console.log('\n');
    console.log('🎉 移行完了！');
    console.log(`✅ 成功: ${successCount}件`);
    console.log(`❌ エラー: ${errorCount}件`);
    console.log(`📊 本番DB割当総数: ${finalCount}件`);
    console.log(`🔗 detailId設定済み: ${withDetailCount}件`);
    
  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
  }
}

main().catch(console.error);