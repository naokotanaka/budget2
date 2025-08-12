#!/usr/bin/env tsx
/**
 * 割当データを一時保存するスクリプト
 * detailIdベースでの再構築用
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

interface SavedAllocation {
  detailId: bigint;
  budgetItemId: number;
  amount: number;
  note: string | null;
  freeDealId: bigint;
  transactionData: {
    journalNumber: bigint;
    journalLineNumber: number;
    date: Date;
    description: string | null;
    amount: number;
    account: string | null;
    supplier: string | null;
  };
}

async function saveAllocations() {
  console.log('📦 割当データの保存開始');
  
  try {
    // 割当データを取引情報と共に取得
    const allocations = await prisma.allocationSplit.findMany({
      include: {
        transaction: true,
        budgetItem: true
      }
    });
    
    console.log(`📊 対象割当データ: ${allocations.length}件`);
    
    // detailIdを持つ割当のみ保存
    const savedAllocations: SavedAllocation[] = [];
    let skipCount = 0;
    
    for (const alloc of allocations) {
      if (!alloc.transaction.detailId) {
        console.warn(`⚠️ detailIdがない取引: ${alloc.transactionId}`);
        skipCount++;
        continue;
      }
      
      savedAllocations.push({
        detailId: alloc.transaction.detailId,
        budgetItemId: alloc.budgetItemId,
        amount: alloc.amount,
        note: alloc.note,
        freeDealId: alloc.transaction.freeDealId!,
        transactionData: {
          journalNumber: alloc.transaction.journalNumber,
          journalLineNumber: alloc.transaction.journalLineNumber,
          date: alloc.transaction.date,
          description: alloc.transaction.description,
          amount: alloc.transaction.amount,
          account: alloc.transaction.account,
          supplier: alloc.transaction.supplier
        }
      });
    }
    
    // JSONファイルとして保存
    const backupDir = path.join(process.cwd(), 'backup', 'allocations');
    await fs.mkdir(backupDir, { recursive: true });
    
    const filename = `allocations_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(backupDir, filename);
    
    await fs.writeFile(
      filepath,
      JSON.stringify(savedAllocations, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2)
    );
    
    console.log(`✅ 保存完了: ${savedAllocations.length}件`);
    console.log(`⚠️ スキップ: ${skipCount}件`);
    console.log(`📁 保存先: ${filepath}`);
    
    // サマリー表示
    console.log('\n📊 保存データサマリー:');
    const byGrant = new Map<number, number>();
    for (const alloc of allocations) {
      const grantId = alloc.budgetItem.grantId;
      byGrant.set(grantId, (byGrant.get(grantId) || 0) + 1);
    }
    
    for (const [grantId, count] of byGrant) {
      const grant = await prisma.grant.findUnique({ where: { id: grantId } });
      console.log(`  ${grant?.name}: ${count}件`);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
saveAllocations().catch(console.error);