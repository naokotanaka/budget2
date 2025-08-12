#!/usr/bin/env tsx
/**
 * 割当データの正しい移行スクリプト
 * 
 * 正確なV1データ構造の理解：
 * - V1: allocations.transaction_id = "内部ID_行番号" (例: "5070202_1")
 * - V1: transactions.id = "内部ID_行番号", transactions.freee_deal_id = freee取引ID
 * - V2: transactions.freeDealId = freee取引ID, transactions.detailId = freee詳細ID
 * 
 * 移行ロジック：
 * 1. V1のallocationからtransaction_idを取得
 * 2. V1のtransactionsテーブルでfreee_deal_idを検索
 * 3. V2のtransactionsでfreeDealIdがマッチする取引を検索
 * 4. V2取引が複数ある場合は、journal_line_numberで特定
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
  transaction_id: string;
  budget_item_id: number;
  amount: number;
}

interface V1Transaction {
  id: string;
  freee_deal_id: bigint | null;
  journal_line_number: number | null;
}

interface V1BudgetItem {
  id: number;
  name: string;
}

async function createBudgetItemMapping() {
  console.log('📋 予算項目IDマッピングを作成中...');
  
  const v1Result = await v1Client.query<V1BudgetItem>('SELECT id, name FROM budget_items ORDER BY id');
  const v1Items = v1Result.rows;
  
  const v2Items = await v2Prisma.budgetItem.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' }
  });
  
  const mapping = new Map<number, number>();
  
  for (const v1Item of v1Items) {
    const v2Item = v2Items.find(v2 => v2.name === v1Item.name);
    if (v2Item) {
      mapping.set(v1Item.id, v2Item.id);
      console.log(`  ✅ 予算項目マッピング: ${v1Item.name} (V1:${v1Item.id} → V2:${v2Item.id})`);
    } else {
      console.warn(`  ⚠️ 対応する予算項目が見つかりません: ${v1Item.name} (V1:${v1Item.id})`);
    }
  }
  
  console.log(`📋 予算項目マッピング完了: ${mapping.size}/${v1Items.length}件\n`);
  return mapping;
}

async function migrateAllocationsCorrect() {
  console.log('💰 割当データの正しい移行開始...');
  
  const budgetItemMapping = await createBudgetItemMapping();
  
  // V1の割当データとその関連取引データを一緒に取得
  const allocQuery = `
    SELECT 
      a.id as allocation_id,
      a.transaction_id,
      a.budget_item_id,
      a.amount,
      t.freee_deal_id,
      t.journal_line_number
    FROM allocations a
    LEFT JOIN transactions t ON a.transaction_id = t.id
    WHERE t.freee_deal_id IS NOT NULL
    ORDER BY a.id
  `;
  
  const allocResult = await v1Client.query(allocQuery);
  const allocations = allocResult.rows;
  
  console.log(`💰 V1割当データ（freeDealIDあり）: ${allocations.length}件を処理開始\n`);
  
  // 既存の割当データをクリア
  await v2Prisma.allocationSplit.deleteMany();
  console.log('✅ 既存割当データをクリア\n');
  
  // V2の取引データをfreeDealId別にグループ化
  const v2Transactions = await v2Prisma.transaction.findMany({
    where: { freeDealId: { not: null } },
    select: { id: true, freeDealId: true, detailId: true },
    orderBy: [{ freeDealId: 'asc' }, { detailId: 'asc' }]
  });
  
  const v2DealMap = new Map<string, { transactionId: string; detailId: bigint }[]>();
  
  for (const tx of v2Transactions) {
    if (!tx.freeDealId) continue;
    
    const dealKey = tx.freeDealId.toString();
    if (!v2DealMap.has(dealKey)) {
      v2DealMap.set(dealKey, []);
    }
    
    v2DealMap.get(dealKey)!.push({
      transactionId: tx.id,
      detailId: tx.detailId
    });
  }
  
  console.log(`🔄 V2取引マッピング完了: ${v2DealMap.size}個のfreeDealId\n`);
  
  let successCount = 0;
  let skipCount = 0;
  
  for (const allocation of allocations) {
    // 予算項目IDマッピング確認
    const newBudgetItemId = budgetItemMapping.get(allocation.budget_item_id);
    if (!newBudgetItemId) {
      console.warn(`  ⚠️ 予算項目ID ${allocation.budget_item_id} のマッピングが見つかりません`);
      skipCount++;
      continue;
    }
    
    const freeDealId = allocation.freee_deal_id?.toString();
    if (!freeDealId) {
      console.warn(`  ⚠️ freeDealIdが見つかりません: ${allocation.transaction_id}`);
      skipCount++;
      continue;
    }
    
    // V2での対応取引を検索
    const v2TransactionList = v2DealMap.get(freeDealId);
    if (!v2TransactionList || v2TransactionList.length === 0) {
      console.warn(`  ⚠️ V2にfreeDealId ${freeDealId} の取引が見つかりません`);
      skipCount++;
      continue;
    }
    
    // 複数の取引がある場合、journal_line_numberに基づいて選択
    let targetTransaction = v2TransactionList[0]; // デフォルト：最初の取引
    
    if (v2TransactionList.length > 1 && allocation.journal_line_number !== null) {
      // journal_line_numberが1から始まる場合、配列インデックス（0から開始）に調整
      const lineIndex = allocation.journal_line_number - 1;
      if (lineIndex >= 0 && lineIndex < v2TransactionList.length) {
        targetTransaction = v2TransactionList[lineIndex];
      }
    }
    
    try {
      // AllocationSplitとして登録
      await v2Prisma.allocationSplit.create({
        data: {
          transactionId: targetTransaction.transactionId,
          budgetItemId: newBudgetItemId,
          amount: allocation.amount,
          note: `V1移行 (ID:${allocation.allocation_id}, freeDeal:${freeDealId})`
        }
      });
      
      successCount++;
      
      if (successCount % 50 === 0) {
        console.log(`  ✅ ${successCount}件処理完了...`);
      }
      
    } catch (error) {
      console.error(`  ❌ 割当作成エラー: transaction=${targetTransaction.transactionId}, budget=${newBudgetItemId}`, error);
      skipCount++;
    }
  }
  
  console.log(`\n💰 割当データ移行結果:`);
  console.log(`  ✅ 成功: ${successCount}件`);
  console.log(`  ⚠️ スキップ: ${skipCount}件`);
  console.log(`  📊 成功率: ${Math.round((successCount / allocations.length) * 100)}%`);
}

async function verifyMigration() {
  console.log('\n🔍 移行結果の検証中...');
  
  const [grantsCount, budgetItemsCount, allocationsCount, transactionsCount] = await Promise.all([
    v2Prisma.grant.count(),
    v2Prisma.budgetItem.count(),
    v2Prisma.allocationSplit.count(),
    v2Prisma.transaction.count()
  ]);
  
  console.log('📊 移行後のデータ統計:');
  console.log(`  助成金: ${grantsCount}件`);
  console.log(`  予算項目: ${budgetItemsCount}件`);
  console.log(`  取引: ${transactionsCount}件`);
  console.log(`  割当: ${allocationsCount}件`);
  
  // 金額統計
  const amountStats = await v2Prisma.allocationSplit.aggregate({
    _sum: { amount: true },
    _avg: { amount: true },
    _count: { amount: true }
  });
  
  console.log(`📊 割当金額統計:`);
  console.log(`  合計金額: ${amountStats._sum.amount?.toLocaleString() || 0}円`);
  console.log(`  平均金額: ${Math.round(amountStats._avg.amount || 0).toLocaleString()}円`);
  
  // サンプル確認
  const samples = await v2Prisma.allocationSplit.findMany({
    take: 5,
    include: {
      budgetItem: { select: { name: true } },
      transaction: { select: { freeDealId: true, description: true } }
    },
    orderBy: { amount: 'desc' }
  });
  
  console.log('\n🔍 移行データサンプル（金額大きい順）:');
  for (const sample of samples) {
    console.log(`  ${sample.budgetItem.name}: ${sample.amount.toLocaleString()}円 (deal:${sample.transaction.freeDealId})`);
  }
}

async function main() {
  try {
    console.log('🚀 割当データ正しい移行を開始します...\n');
    
    await v1Client.connect();
    console.log('✅ データベース接続完了\n');
    
    await migrateAllocationsCorrect();
    await verifyMigration();
    
    console.log('\n✨ 割当データ移行が完了しました！');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await v1Client.end();
    await v2Prisma.$disconnect();
  }
}

main();