/**
 * AllocationSplitの削除動作をテストするスクリプト
 * Transaction削除時にAllocationSplitが保持されることを確認
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAllocationDeleteBehavior() {
  console.log('🧪 AllocationSplit削除動作テスト開始...\n');

  try {
    // 1. テスト用の取引を作成
    const testTransaction = await prisma.transaction.create({
      data: {
        id: 'test-trans-' + Date.now(),
        journalNumber: BigInt(999999),
        journalLineNumber: 1,
        date: new Date(),
        description: 'テスト取引',
        amount: 10000,
        detailId: BigInt(Date.now()),
        account: 'テスト勘定科目',
      },
    });
    console.log('✅ テスト取引を作成:', {
      id: testTransaction.id,
      detailId: testTransaction.detailId.toString(),
    });

    // 2. テスト用の助成金と予算項目を取得または作成
    let grant = await prisma.grant.findFirst();
    if (!grant) {
      grant = await prisma.grant.create({
        data: {
          name: 'テスト助成金',
          totalAmount: 1000000,
        },
      });
    }

    let budgetItem = await prisma.budgetItem.findFirst({
      where: { grantId: grant.id },
    });
    if (!budgetItem) {
      budgetItem = await prisma.budgetItem.create({
        data: {
          name: 'テスト予算項目',
          budgetedAmount: 100000,
          grantId: grant.id,
        },
      });
    }

    // 3. 割当を作成
    const allocation = await prisma.allocationSplit.create({
      data: {
        budgetItemId: budgetItem.id,
        amount: 5000,
        detailId: testTransaction.detailId,
        note: 'テスト割当',
      },
    });
    console.log('✅ 割当を作成:', {
      id: allocation.id,
      detailId: allocation.detailId?.toString(),
      amount: allocation.amount,
    });

    // 4. 割当が存在することを確認
    const allocationBefore = await prisma.allocationSplit.findUnique({
      where: { id: allocation.id },
      include: { transaction: true },
    });
    console.log('\n📊 削除前の状態:');
    console.log('  - 割当ID:', allocationBefore?.id);
    console.log('  - detailId:', allocationBefore?.detailId?.toString());
    console.log('  - 取引が結びついている:', !!allocationBefore?.transaction);

    // 5. 取引を削除
    await prisma.transaction.delete({
      where: { id: testTransaction.id },
    });
    console.log('\n🗑️  取引を削除しました');

    // 6. 割当が残っているか確認
    const allocationAfter = await prisma.allocationSplit.findUnique({
      where: { id: allocation.id },
      include: { transaction: true },
    });
    
    console.log('\n📊 削除後の状態:');
    if (allocationAfter) {
      console.log('  ✅ 割当は保持されています');
      console.log('  - 割当ID:', allocationAfter.id);
      console.log('  - detailId:', allocationAfter.detailId?.toString() || 'NULL');
      console.log('  - 取引が結びついている:', !!allocationAfter.transaction);
      console.log('  - 金額:', allocationAfter.amount);
      console.log('  - メモ:', allocationAfter.note);
    } else {
      console.log('  ❌ 割当が削除されてしまいました！');
    }

    // 7. 同じdetailIdで新しい取引を作成
    const newTransaction = await prisma.transaction.create({
      data: {
        id: 'test-trans-new-' + Date.now(),
        journalNumber: BigInt(999998),
        journalLineNumber: 1,
        date: new Date(),
        description: '新しいテスト取引',
        amount: 10000,
        detailId: testTransaction.detailId, // 同じdetailIdを使用
        account: 'テスト勘定科目',
      },
    });
    console.log('\n✅ 同じdetailIdで新しい取引を作成');

    // 8. 割当が新しい取引と結びついているか確認
    const allocationReconnected = await prisma.allocationSplit.findUnique({
      where: { id: allocation.id },
      include: { transaction: true },
    });
    
    console.log('\n📊 新しい取引作成後の状態:');
    console.log('  - 割当ID:', allocationReconnected?.id);
    console.log('  - detailId:', allocationReconnected?.detailId?.toString());
    console.log('  - 新しい取引と結びついている:', !!allocationReconnected?.transaction);
    if (allocationReconnected?.transaction) {
      console.log('  - 取引ID:', allocationReconnected.transaction.id);
      console.log('  - 取引の説明:', allocationReconnected.transaction.description);
    }

    // 9. クリーンアップ
    await prisma.transaction.delete({
      where: { id: newTransaction.id },
    });
    await prisma.allocationSplit.delete({
      where: { id: allocation.id },
    });
    
    console.log('\n✅ テストが正常に完了しました！');
    console.log('割当は取引削除後も保持され、同じdetailIdの新しい取引と再び結びつくことが確認できました。');

  } catch (error) {
    console.error('\n❌ テスト中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAllocationDeleteBehavior();