#!/usr/bin/env tsx
/**
 * 割当データの最終移行スクリプト
 * 
 * V1からV2への割当データ移行の問題点と解決策：
 * 
 * 【問題】
 * - V1: transaction_id = "freeDealId_lineNumber" (例: "2861187034_1")
 * - V2: freeDealId + detailId の組み合わせ (例: freeDealId=2861187034, detailId=7772542813)
 * - lineNumberは1から始まる連番だが、detailIdは実際のfreee API ID
 * 
 * 【解決策】
 * 1. V1の割当データを取得
 * 2. transaction_id から freeDealId と lineNumber を抽出
 * 3. V2で同じfreeDealIdを持つ取引を取得し、detailId順でソート
 * 4. lineNumber番目のdetailIdを特定
 * 5. 対応するV2取引IDで割当データを作成
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

interface V1Allocation {
  id: number;
  transaction_id: string;
  budget_item_id: number;
  amount: number;
}

interface V1BudgetItem {
  id: number;
  name: string;
  grant_id: number;
}

interface V2Transaction {
  id: string;
  freeDealId: bigint;
  detailId: bigint;
}

async function createBudgetItemMapping() {
  console.log('📋 予算項目IDマッピングを作成中...');
  
  // V1の予算項目取得
  const v1Result = await v1Client.query<V1BudgetItem>('SELECT id, name, grant_id FROM budget_items ORDER BY id');
  const v1Items = v1Result.rows;
  
  // V2の予算項目取得
  const v2Items = await v2Prisma.budgetItem.findMany({
    select: { id: true, name: true, grantId: true },
    orderBy: { id: 'asc' }
  });
  
  // 名前ベースでマッピング作成
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

async function createTransactionMapping() {
  console.log('🔄 取引IDマッピングを作成中...');
  
  // V2の全取引データ取得（freeDealId順、detailId順でソート）
  const v2Transactions = await v2Prisma.transaction.findMany({
    where: { freeDealId: { not: null } },
    select: { id: true, freeDealId: true, detailId: true },
    orderBy: [{ freeDealId: 'asc' }, { detailId: 'asc' }]
  });
  
  // freeDealId毎にグループ化し、行番号を付ける
  const dealMap = new Map<string, { transactionId: string; lineNumber: number }[]>();
  
  let currentDealId: bigint | null = null;
  let lineNumber = 0;
  
  for (const tx of v2Transactions) {
    if (tx.freeDealId !== currentDealId) {
      currentDealId = tx.freeDealId;
      lineNumber = 1;
    } else {
      lineNumber++;
    }
    
    const dealKey = tx.freeDealId!.toString();
    if (!dealMap.has(dealKey)) {
      dealMap.set(dealKey, []);
    }
    
    dealMap.get(dealKey)!.push({
      transactionId: tx.id,
      lineNumber: lineNumber
    });
  }
  
  console.log(`🔄 取引マッピング完了: ${dealMap.size}個のfreeDealId\n`);
  return dealMap;
}

async function migrateAllocations() {
  console.log('💰 割当データの移行開始...');
  
  // 準備
  const budgetItemMapping = await createBudgetItemMapping();
  const transactionMapping = await createTransactionMapping();
  
  // V1の割当データ取得
  const allocResult = await v1Client.query<V1Allocation>('SELECT * FROM allocations ORDER BY id');
  const allocations = allocResult.rows;
  
  console.log(`💰 V1割当データ: ${allocations.length}件を処理開始\n`);
  
  // 既存の割当データをクリア
  await v2Prisma.allocationSplit.deleteMany();
  console.log('✅ 既存割当データをクリア\n');
  
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
    
    // transaction_idを分解
    const parts = allocation.transaction_id.split('_');
    if (parts.length !== 2) {
      console.warn(`  ⚠️ 不正なtransaction_id形式: ${allocation.transaction_id}`);
      skipCount++;
      continue;
    }
    
    const freeDealId = parts[0];
    const lineNumber = parseInt(parts[1]);
    
    // 対応する取引を検索
    const dealTransactions = transactionMapping.get(freeDealId);
    if (!dealTransactions || dealTransactions.length < lineNumber) {
      console.warn(`  ⚠️ 対応するV2取引が見つかりません: deal_id=${freeDealId}, line=${lineNumber}`);
      skipCount++;
      continue;
    }
    
    const targetTransaction = dealTransactions[lineNumber - 1]; // 0ベースインデックス
    
    try {
      // AllocationSplitとして登録
      await v2Prisma.allocationSplit.create({
        data: {
          transactionId: targetTransaction.transactionId,
          budgetItemId: newBudgetItemId,
          amount: allocation.amount,
          note: `現行システムから移行 (V1:${allocation.id})`
        }
      });
      
      successCount++;
      
      if (successCount % 10 === 0) {
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
  
  // 基本統計
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
  
  // サンプル確認
  const samples = await v2Prisma.allocationSplit.findMany({
    take: 3,
    include: {
      budgetItem: { select: { name: true } },
      transaction: { select: { freeDealId: true, description: true } }
    }
  });
  
  console.log('\n🔍 移行データサンプル:');
  for (const sample of samples) {
    console.log(`  ${sample.budgetItem.name}: ${sample.amount}円 (取引ID: ${sample.transaction.freeDealId})`);
  }
}

async function main() {
  try {
    console.log('🚀 割当データ最終移行を開始します...\n');
    
    // DB接続
    await v1Client.connect();
    console.log('✅ データベース接続完了\n');
    
    // 移行実行
    await migrateAllocations();
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

// 実行
main();