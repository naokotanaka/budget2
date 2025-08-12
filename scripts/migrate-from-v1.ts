#!/usr/bin/env tsx
/**
 * 現行システム（v1）から新システム（v2）へのデータ移行スクリプト
 * 
 * 移行対象:
 * 1. 助成金（grants）
 * 2. 予算項目（budget_items）
 * 3. 割当データ（allocations）
 * 
 * 注意点:
 * - 取引データはfreeeから再取得するため移行しない
 * - 割当は「取引ID（freee_deal_id）_行番号」でマッピング
 */

import { PrismaClient as V2Prisma } from '@prisma/client';
import pkg from 'pg';
const { Client } = pkg;

// V2のPrismaクライアント
const v2Prisma = new V2Prisma();

// V1のPostgreSQLクライアント
const v1Client = new Client({
  host: 'localhost',
  database: 'nagaiku_budget',
  user: 'nagaiku_user',
  password: 'nagaiku_password2024',
  port: 5432,
});

interface V1Grant {
  id: number;
  name: string;
  total_amount: number | null;
  start_date: Date | null;
  end_date: Date | null;
  status: string | null;
  grant_code: string | null;
}

interface V1BudgetItem {
  id: number;
  name: string;
  grant_id: number;
  budgeted_amount: number | null;
  category: string | null;
}

interface V1Allocation {
  id: number;
  transaction_id: string; // "仕訳ID_行番号" 形式
  budget_item_id: number;
  amount: number;
}

interface V1Transaction {
  id: string; // "仕訳ID_行番号" 形式
  freee_deal_id: bigint | null;
  journal_line_number: number | null;
}

async function migrateGrants() {
  console.log('📦 助成金データの移行開始...');
  
  const result = await v1Client.query<V1Grant>('SELECT * FROM grants ORDER BY id');
  const grants = result.rows;
  
  // 既存データクリア（開発環境なので）
  await v2Prisma.allocationSplit.deleteMany();
  await v2Prisma.budgetItem.deleteMany();
  await v2Prisma.grant.deleteMany();
  
  // IDマッピング用
  const grantIdMap = new Map<number, number>();
  
  for (const grant of grants) {
    const created = await v2Prisma.grant.create({
      data: {
        name: grant.name,
        grantCode: grant.grant_code,
        totalAmount: grant.total_amount,
        startDate: grant.start_date,
        endDate: grant.end_date,
        status: grant.status || 'active',
      },
    });
    
    grantIdMap.set(grant.id, created.id);
    console.log(`  ✅ 助成金移行: ${grant.name} (旧ID: ${grant.id} → 新ID: ${created.id})`);
  }
  
  console.log(`📦 助成金 ${grants.length}件を移行完了\n`);
  return grantIdMap;
}

async function migrateBudgetItems(grantIdMap: Map<number, number>) {
  console.log('📋 予算項目データの移行開始...');
  
  const result = await v1Client.query<V1BudgetItem>('SELECT * FROM budget_items ORDER BY id');
  const budgetItems = result.rows;
  
  // IDマッピング用
  const budgetItemIdMap = new Map<number, number>();
  
  for (const item of budgetItems) {
    const newGrantId = grantIdMap.get(item.grant_id);
    if (!newGrantId) {
      console.warn(`  ⚠️ 助成金ID ${item.grant_id} のマッピングが見つかりません`);
      continue;
    }
    
    const created = await v2Prisma.budgetItem.create({
      data: {
        name: item.name,
        category: item.category,
        budgetedAmount: item.budgeted_amount,
        grantId: newGrantId,
        sortOrder: 0,
      },
    });
    
    budgetItemIdMap.set(item.id, created.id);
    console.log(`  ✅ 予算項目移行: ${item.name} (旧ID: ${item.id} → 新ID: ${created.id})`);
  }
  
  console.log(`📋 予算項目 ${budgetItems.length}件を移行完了\n`);
  return budgetItemIdMap;
}

async function migrateAllocations(budgetItemIdMap: Map<number, number>) {
  console.log('🔄 割当データの移行開始...');
  console.log('  ⚠️ 注意: 取引データはfreeeから再取得する必要があります');
  
  // V1の割当データ取得
  const allocResult = await v1Client.query<V1Allocation>('SELECT * FROM allocations ORDER BY id');
  const allocations = allocResult.rows;
  
  // V1の取引データ取得（freee_deal_idとline_numberのマッピング用）
  const txResult = await v1Client.query<V1Transaction>(
    'SELECT id, freee_deal_id, journal_line_number FROM transactions WHERE freee_deal_id IS NOT NULL'
  );
  const v1Transactions = txResult.rows;
  
  // V1のtransaction_id → freee_deal_id + line_numberのマッピング作成
  const txMapping = new Map<string, { dealId: bigint; lineNumber: number }>();
  for (const tx of v1Transactions) {
    if (tx.freee_deal_id && tx.journal_line_number !== null) {
      txMapping.set(tx.id, {
        dealId: tx.freee_deal_id,
        lineNumber: tx.journal_line_number,
      });
    }
  }
  
  let successCount = 0;
  let skipCount = 0;
  
  for (const allocation of allocations) {
    const newBudgetItemId = budgetItemIdMap.get(allocation.budget_item_id);
    if (!newBudgetItemId) {
      console.warn(`  ⚠️ 予算項目ID ${allocation.budget_item_id} のマッピングが見つかりません`);
      skipCount++;
      continue;
    }
    
    // V1のtransaction_idからfreee_deal_idとline_numberを取得
    const txInfo = txMapping.get(allocation.transaction_id);
    if (!txInfo) {
      console.warn(`  ⚠️ 取引ID ${allocation.transaction_id} のfreee情報が見つかりません`);
      skipCount++;
      continue;
    }
    
    // V2の取引を検索（freeDealIdとdetailIdで）
    const v2Transaction = await v2Prisma.transaction.findFirst({
      where: {
        freeDealId: txInfo.dealId,
        detailId: BigInt(txInfo.lineNumber),
      },
    });
    
    if (!v2Transaction) {
      console.log(`  ⏭️ 取引 (deal_id: ${txInfo.dealId}, line: ${txInfo.lineNumber}) はまだV2に存在しません`);
      skipCount++;
      continue;
    }
    
    // AllocationSplitとして登録
    await v2Prisma.allocationSplit.create({
      data: {
        transactionId: v2Transaction.id,
        budgetItemId: newBudgetItemId,
        amount: allocation.amount,
        note: '現行システムから移行',
      },
    });
    
    successCount++;
    console.log(`  ✅ 割当移行: 取引 ${v2Transaction.id} → 予算項目 ${newBudgetItemId}`);
  }
  
  console.log(`\n🔄 割当データ移行結果:`);
  console.log(`  ✅ 成功: ${successCount}件`);
  console.log(`  ⏭️ スキップ: ${skipCount}件`);
  console.log(`  📝 注: freeeから取引データを同期後、再度実行してください`);
}

async function main() {
  try {
    console.log('🚀 データ移行を開始します...\n');
    
    // DB接続
    await v1Client.connect();
    console.log('✅ V1データベースに接続しました');
    console.log('✅ V2データベースに接続しました\n');
    
    // 移行実行
    const grantIdMap = await migrateGrants();
    const budgetItemIdMap = await migrateBudgetItems(grantIdMap);
    await migrateAllocations(budgetItemIdMap);
    
    console.log('\n✨ データ移行が完了しました！');
    console.log('\n📌 次のステップ:');
    console.log('1. freeeから取引データを同期');
    console.log('2. 割当データの再移行（必要に応じて）');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await v1Client.end();
    await v2Prisma.$disconnect();
  }
}

// 実行
main();