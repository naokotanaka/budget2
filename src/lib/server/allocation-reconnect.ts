/**
 * 取引と割当の再結合ユーティリティ
 * 新しい取引が作成された時、同じdetailIdを持っていた過去の割当を再結合する
 */

import type { PrismaClient } from '@prisma/client';

/**
 * 取引作成時に、過去に同じdetailIdを持っていた割当を再結合する
 * @param prisma - Prismaクライアント
 * @param detailId - 取引の明細ID
 * @returns 再結合された割当の数
 */
export async function reconnectAllocationsToTransaction(
  prisma: PrismaClient,
  detailId: bigint
): Promise<number> {
  // detailIdがNULLの割当を探す（過去にこのdetailIdを持っていた可能性がある）
  // 注：現時点では履歴を保持していないため、手動で再結合する必要がある
  // 将来的には、allocation_historyテーブルなどで履歴を管理することを検討
  
  // 現在の実装では、手動で再結合する必要がある
  // これは意図的な設計：自動再結合は予期しない動作を引き起こす可能性があるため
  
  return 0;
}

/**
 * 特定の割当を取引に手動で再結合する
 * @param prisma - Prismaクライアント
 * @param allocationId - 割当ID
 * @param detailId - 取引の明細ID
 * @returns 更新された割当
 */
export async function manuallyReconnectAllocation(
  prisma: PrismaClient,
  allocationId: string,
  detailId: bigint
) {
  // まず、指定されたdetailIdを持つ取引が存在するか確認
  const transaction = await prisma.transaction.findUnique({
    where: { detailId },
  });

  if (!transaction) {
    throw new Error(`detailId ${detailId} を持つ取引が見つかりません`);
  }

  // 割当を更新してdetailIdを設定
  return await prisma.allocationSplit.update({
    where: { id: allocationId },
    data: { detailId },
    include: {
      transaction: true,
      budgetItem: {
        include: {
          grant: true,
        },
      },
    },
  });
}

/**
 * detailIdがNULLの割当（孤立した割当）を取得する
 * @param prisma - Prismaクライアント
 * @returns 孤立した割当のリスト
 */
export async function getOrphanedAllocations(prisma: PrismaClient) {
  return await prisma.allocationSplit.findMany({
    where: {
      detailId: null,
    },
    include: {
      budgetItem: {
        include: {
          grant: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * 取引削除前に割当情報を履歴として保存する（将来の拡張用）
 * @param prisma - Prismaクライアント
 * @param transactionId - 削除される取引のID
 */
export async function saveAllocationHistoryBeforeDelete(
  prisma: PrismaClient,
  transactionId: string
) {
  // 将来的には、allocation_historyテーブルに保存する
  // 現在は実装なし
  
  const allocations = await prisma.allocationSplit.findMany({
    where: {
      transaction: {
        id: transactionId,
      },
    },
    include: {
      transaction: true,
      budgetItem: true,
    },
  });

  // ログに記録（将来的にはテーブルに保存）
  console.log(`取引 ${transactionId} の削除により、${allocations.length}件の割当がdetailId NULLになります`);
  allocations.forEach(allocation => {
    console.log(`  - 割当ID: ${allocation.id}, detailId: ${allocation.detailId}, 金額: ${allocation.amount}`);
  });

  return allocations;
}