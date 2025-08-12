#!/usr/bin/env tsx
/**
 * 割当データを復元するスクリプト
 * detailIdベースで復元
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function restoreAllocations() {
  console.log('📦 割当データの復元開始');
  
  try {
    // バックアップファイルを読み込み
    const backupFile = '/home/tanaka/projects/nagaiku-budget-v2/backup/allocations/allocations_backup_2025-08-12T17-07-25-695Z.json';
    const content = await fs.readFile(backupFile, 'utf-8');
    const savedAllocations = JSON.parse(content);
    
    console.log(`📊 復元対象データ: ${savedAllocations.length}件`);
    
    // 取引データの存在確認
    const transactionCount = await prisma.transaction.count();
    console.log(`📊 現在の取引データ: ${transactionCount}件`);
    
    if (transactionCount === 0) {
      console.error('❌ 取引データがありません。先に取引データを同期してください。');
      return;
    }
    
    let successCount = 0;
    let skipCount = 0;
    const errors: string[] = [];
    
    for (const saved of savedAllocations) {
      const detailId = BigInt(saved.detailId);
      
      // 取引の存在確認
      const transaction = await prisma.transaction.findUnique({
        where: { detailId }
      });
      
      if (!transaction) {
        errors.push(`DetailID ${detailId} の取引が見つかりません`);
        skipCount++;
        continue;
      }
      
      // 予算項目の存在確認
      const budgetItem = await prisma.budgetItem.findUnique({
        where: { id: saved.budgetItemId }
      });
      
      if (!budgetItem) {
        errors.push(`予算項目ID ${saved.budgetItemId} が見つかりません`);
        skipCount++;
        continue;
      }
      
      // 割当を作成
      await prisma.allocationSplit.create({
        data: {
          detailId: detailId,
          budgetItemId: saved.budgetItemId,
          amount: saved.amount,
          note: saved.note
        }
      });
      
      successCount++;
      
      // 進捗表示
      if (successCount % 20 === 0) {
        console.log(`  ✅ ${successCount}件処理完了`);
      }
    }
    
    console.log('\n📊 復元結果サマリー:');
    console.log(`  ✅ 成功: ${successCount}件`);
    console.log(`  ⚠️ スキップ: ${skipCount}件`);
    
    if (errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (errors.length > 10) {
        console.log(`  ... 他 ${errors.length - 10} 件`);
      }
    }
    
    // 復元後の確認
    const allocationCount = await prisma.allocationSplit.count();
    console.log(`\n📈 割当データ総数: ${allocationCount}件`);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
restoreAllocations().catch(console.error);