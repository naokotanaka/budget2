#!/usr/bin/env tsx
/**
 * 割当データの再移行スクリプト（修正版）
 * 
 * 問題：
 * - V1は仕訳IDと行番号（1から始まる連番）でマッピング
 * - V2はfreeDealIdと実際のdetailIDでマッピング
 * 
 * 解決策：
 * - freeDealIdでマッチして、detailIdの順序から行番号を推測
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
  transaction_id: string; // "仕訳ID_行番号" 形式
  budget_item_id: number;
  amount: number;
}

interface V1Transaction {
  id: string; // "仕訳ID_行番号" 形式
  freee_deal_id: bigint | null;
  journal_line_number: number | null;
}

async function fixAllocationMigration() {
  console.log('🔧 割当データの再移行（修正版）を開始...');
  
  try {
    // V1の割当データ取得
    const allocResult = await v1Client.query<V1Allocation>('SELECT * FROM allocations ORDER BY id');
    const allocations = allocResult.rows;
    console.log(`📋 V1割当データ: ${allocations.length}件`);

    // V1の取引データ取得
    const txResult = await v1Client.query<V1Transaction>(
      'SELECT id, freee_deal_id, journal_line_number FROM transactions WHERE freee_deal_id IS NOT NULL ORDER BY freee_deal_id, journal_line_number'
    );
    const v1Transactions = txResult.rows;
    console.log(`📋 V1取引データ: ${v1Transactions.length}件`);

    // freeDealId毎に、V2のdetailIdを行番号順にソート
    const dealDetailMap = new Map<string, { detailId: bigint; lineOrder: number }[]>();
    
    const v2Transactions = await v2Prisma.transaction.findMany({
      where: { freeDealId: { not: null } },
      select: { freeDealId: true, detailId: true },
      orderBy: [{ freeDealId: 'asc' }, { detailId: 'asc' }]
    });

    // freeDealId毎にdetailIdをグループ化し、行番号を付ける
    for (const tx of v2Transactions) {
      if (!tx.freeDealId) continue;
      
      const dealKey = tx.freeDealId.toString();
      if (!dealDetailMap.has(dealKey)) {
        dealDetailMap.set(dealKey, []);
      }
      
      const details = dealDetailMap.get(dealKey)!;
      details.push({
        detailId: tx.detailId,
        lineOrder: details.length + 1  // 1から始まる行番号
      });
    }

    console.log(`📋 V2のfreeDealId種類数: ${dealDetailMap.size}件`);

    // V1のtransaction_id → V2のtransaction情報のマッピング作成
    let matchCount = 0;
    let skipCount = 0;
    const migrationMap = new Map<string, { v2TransactionId: number; budgetItemId: number; amount: number }>();

    for (const allocation of allocations) {
      // V1のbudget_item_idを新しいIDにマッピング（既存のbudget_itemから検索）
      const budgetItem = await v2Prisma.budgetItem.findFirst({
        where: { name: { contains: '' } }, // 後で詳細検索に変更
        select: { id: true, name: true }
      });

      // transaction_idを分解（"仕訳ID_行番号" → 仕訳ID と 行番号）
      const parts = allocation.transaction_id.split('_');
      if (parts.length !== 2) {
        console.warn(`  ⚠️ 不正なtransaction_id形式: ${allocation.transaction_id}`);
        skipCount++;
        continue;
      }

      const freeDealId = parts[0];
      const lineNumber = parseInt(parts[1]);

      // V2でのマッチング
      const dealDetails = dealDetailMap.get(freeDealId);
      if (!dealDetails || dealDetails.length < lineNumber) {
        console.warn(`  ⚠️ 対応するV2取引が見つかりません: freeDealId=${freeDealId}, line=${lineNumber}`);
        skipCount++;
        continue;
      }

      const targetDetail = dealDetails[lineNumber - 1]; // 0ベースインデックス
      
      // V2の実際のトランザクションを取得
      const v2Transaction = await v2Prisma.transaction.findFirst({
        where: {
          freeDealId: BigInt(freeDealId),
          detailId: targetDetail.detailId
        },
        select: { id: true }
      });

      if (!v2Transaction) {
        console.warn(`  ⚠️ V2トランザクションが見つかりません: freeDealId=${freeDealId}, detailId=${targetDetail.detailId}`);
        skipCount++;
        continue;
      }

      matchCount++;
      console.log(`  ✅ マッチング成功: ${allocation.transaction_id} → V2 transaction ${v2Transaction.id}`);
    }

    console.log(`\n🔧 割当データマッチング結果:`);
    console.log(`  ✅ マッチング成功: ${matchCount}件`);
    console.log(`  ⚠️ スキップ: ${skipCount}件`);
    
    // 実際の移行実行は確認後に行う
    console.log(`\n⚠️ 注意: 実際の移行実行前に、予算項目IDのマッピングを完成させる必要があります`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  }
}

async function main() {
  try {
    await v1Client.connect();
    console.log('✅ データベース接続完了\n');
    
    await fixAllocationMigration();
    
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