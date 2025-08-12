#!/usr/bin/env tsx
/**
 * シンプルな割当データ移行スクリプト
 * 
 * 前提条件：
 * - すべての割当が_1（最初の明細）のみ
 * - 明細IDは最初の明細のものを使用
 */

import { PrismaClient as V2Prisma } from '@prisma/client';
import pkg from 'pg';
const { Client } = pkg;

const v2Prisma = new V2Prisma();
const v1Client = new Client({
  host: 'localhost',
  database: 'nagaiku_budget',
  user: 'nagaiku_user',
  password: 'nagaiku_password2024',
  port: 5432,
});

interface V1Allocation {
  id: number;
  transaction_id: string; // "内部ID_1" 形式
  budget_item_id: number;
  amount: number;
}

async function migrateGrants() {
  console.log('🏛️ 助成金データの移行開始');
  
  // V1の助成金を取得
  const v1Grants = await v1Client.query(
    'SELECT * FROM grants ORDER BY id'
  );
  
  // 既存のV2助成金を削除
  await v2Prisma.grant.deleteMany({});
  console.log('🗑️ 既存のV2助成金を削除');
  
  // V1の助成金をV2に移行（IDを保持）
  for (const grant of v1Grants.rows) {
    await v2Prisma.grant.create({
      data: {
        id: grant.id,
        name: grant.name,
        grantCode: grant.grant_code || null,
        totalAmount: grant.total_amount || null,
        startDate: grant.start_date ? new Date(grant.start_date) : null,
        endDate: grant.end_date ? new Date(grant.end_date) : null,
        status: grant.status || 'active'
      }
    });
  }
  
  console.log(`✅ 助成金を移行: ${v1Grants.rows.length}件`);
}

async function migrateBudgetItems() {
  console.log('📦 予算項目の移行開始');
  
  // V1の予算項目を取得
  const v1BudgetItems = await v1Client.query(
    'SELECT * FROM budget_items ORDER BY id'
  );
  
  // 既存のV2予算項目を削除
  await v2Prisma.budgetItem.deleteMany({});
  console.log('🗑️ 既存のV2予算項目を削除');
  
  // V1の予算項目をV2に移行（IDを保持）
  for (const item of v1BudgetItems.rows) {
    await v2Prisma.budgetItem.create({
      data: {
        id: item.id,
        name: item.name,
        grantId: item.grant_id,
        budgetedAmount: item.budgeted_amount || 0,
        category: item.category || '',
        sortOrder: item.id  // IDを並び順として使用
      }
    });
  }
  
  console.log(`✅ 予算項目を移行: ${v1BudgetItems.rows.length}件`);
}

async function migrateAllocations() {
  console.log('🚀 割当データ移行開始（_1のみ対応版）');
  
  try {
    await v1Client.connect();
    console.log('✅ V1データベース接続成功');
    
    // まず助成金を移行
    await migrateGrants();
    
    // 次に予算項目を移行
    await migrateBudgetItems();
    
    // V1の割当データを取得
    const allocResult = await v1Client.query<V1Allocation>(
      'SELECT * FROM allocations ORDER BY id'
    );
    const allocations = allocResult.rows;
    console.log(`📊 V1割当データ: ${allocations.length}件`);
    
    // 既存のV2割当を削除（クリーンスタート）
    const deleteResult = await v2Prisma.allocationSplit.deleteMany({});
    console.log(`🗑️ 既存のV2割当を削除: ${deleteResult.count}件`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // V1の取引情報を取得してfreeDealIdとのマッピングを作成
    const v1TxResult = await v1Client.query(
      'SELECT id, freee_deal_id FROM transactions WHERE freee_deal_id IS NOT NULL'
    );
    const v1TxMap = new Map<string, bigint>();
    for (const tx of v1TxResult.rows) {
      v1TxMap.set(tx.id, BigInt(tx.freee_deal_id));
    }
    console.log(`📊 V1取引マッピング: ${v1TxMap.size}件`);
    
    for (const allocation of allocations) {
      // V1のtransaction_idからfreeDealIdを取得
      const freeDealId = v1TxMap.get(allocation.transaction_id);
      if (!freeDealId) {
        console.warn(`❌ V1取引のfreeDealIdが見つかりません: ${allocation.transaction_id}`);
        skipCount++;
        continue;
      }
      
      // V2の取引を検索（freeDealIdで検索）
      const v2Transaction = await v2Prisma.transaction.findFirst({
        where: {
          freeDealId: freeDealId
        },
        orderBy: {
          detailId: 'asc'  // 最初の明細を確実に取得
        }
      });
      
      if (!v2Transaction) {
        console.warn(`❌ V2取引が見つかりません: freeDealId=${freeDealId}, V1 ID=${allocation.transaction_id}`);
        skipCount++;
        continue;
      }
      
      // V2の予算項目IDを確認
      const v2BudgetItem = await v2Prisma.budgetItem.findUnique({
        where: { id: allocation.budget_item_id }
      });
      
      if (!v2BudgetItem) {
        console.warn(`❌ V2予算項目が見つかりません: ID=${allocation.budget_item_id}`);
        skipCount++;
        continue;
      }
      
      // V2に割当を作成
      await v2Prisma.allocationSplit.create({
        data: {
          transactionId: v2Transaction.id,
          budgetItemId: allocation.budget_item_id,
          amount: allocation.amount,
          note: `V1から移行 (元ID: ${allocation.id}, 元取引: ${allocation.transaction_id})`
        }
      });
      
      successCount++;
      
      // 進捗表示
      if (successCount % 10 === 0) {
        console.log(`  ✅ ${successCount}件処理完了`);
      }
    }
    
    console.log('\n📊 移行結果サマリー:');
    console.log(`  ✅ 成功: ${successCount}件`);
    console.log(`  ⚠️ スキップ: ${skipCount}件`);
    console.log(`  ❌ エラー: ${errorCount}件`);
    console.log(`  合計: ${allocations.length}件`);
    
    // 移行後の確認
    const v2AllocationCount = await v2Prisma.allocationSplit.count();
    console.log(`\n📈 V2割当データ総数: ${v2AllocationCount}件`);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await v1Client.end();
    await v2Prisma.$disconnect();
    console.log('\n✅ 移行処理完了');
  }
}

// 実行
migrateAllocations().catch(console.error);