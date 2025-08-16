#!/usr/bin/env node
/**
 * 既存のトランザクションデータを全て削除するスクリプト
 * 実行後、freeeから正しいデータを再同期する必要があります
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetTransactions() {
  try {
    console.log('=== トランザクションデータのリセット開始 ===');
    
    // 1. AllocationSplitを全て削除（外部キー制約のため先に削除）
    const deletedAllocations = await prisma.allocationSplit.deleteMany({});
    console.log(`✅ 削除された割当データ: ${deletedAllocations.count}件`);
    
    // 2. Transactionを全て削除
    const deletedTransactions = await prisma.transaction.deleteMany({});
    console.log(`✅ 削除されたトランザクション: ${deletedTransactions.count}件`);
    
    // 3. 同期ログもリセット（オプション）
    const deletedSyncLogs = await prisma.freeeSync.deleteMany({});
    console.log(`✅ 削除された同期ログ: ${deletedSyncLogs.count}件`);
    
    console.log('\n=== リセット完了 ===');
    console.log('次のステップ:');
    console.log('1. ブラウザで https://nagaiku.top/budget2/freee にアクセス');
    console.log('2. 「freeeから同期」ボタンをクリック');
    console.log('3. 期間を指定して同期を実行');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 確認プロンプトを表示
console.log('⚠️  警告: このスクリプトは全てのトランザクションデータを削除します');
console.log('続行する場合は、環境変数 CONFIRM_RESET=yes を設定して実行してください');
console.log('例: CONFIRM_RESET=yes npm run reset-transactions');

if (process.env.CONFIRM_RESET === 'yes') {
  resetTransactions();
} else {
  console.log('キャンセルされました');
  process.exit(0);
}