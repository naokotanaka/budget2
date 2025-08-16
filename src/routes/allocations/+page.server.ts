import { prisma } from '$lib/database'
import type { PageServerLoad, Actions } from './$types'
import { fail, redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async () => {
  try {
    console.log('Loading allocations page...');
    // 未割当または部分割当の取引を取得
    console.log('Fetching transactions...');
    const transactions = await prisma.transaction.findMany({
      include: {
        allocations: {
          include: {
            budgetItem: {
              include: {
                grant: true
              }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    })

    // 未割当または部分割当の取引をフィルタ
    const unallocatedOrPartial = transactions.filter(tx => {
      const totalAllocated = tx.allocations.reduce((sum, a) => sum + a.amount, 0)
      return totalAllocated < tx.amount // 完全割当でない取引
    })

    console.log('Fetched transactions:', transactions.length);

    // 予算項目一覧（割当用）
    console.log('Fetching budget items...');
    const budgetItems = await prisma.budgetItem.findMany({
      include: {
        grant: true,
        schedules: {
          where: {
            isActive: true
          }
        }
      },
      orderBy: [
        { grant: { name: 'asc' } },
        { name: 'asc' }
      ]
    })

    console.log('Fetched budget items:', budgetItems.length);

    // 全ての分割割当を取得
    console.log('Fetching all allocations...');
    const allAllocations = await prisma.allocationSplit.findMany({
      include: {
        transaction: true,
        budgetItem: {
          include: {
            grant: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('Fetched all allocations:', allAllocations.length);

    // bigintフィールドを文字列に変換してシリアライゼーション対応
    console.log('Serializing transactions...');
    const serializedTransactions = unallocatedOrPartial.map(tx => ({
      ...tx,
      journalNumber: tx.journalNumber.toString(),
      detailId: tx.detailId.toString(),
      freeDealId: tx.freeDealId ? tx.freeDealId.toString() : null,
      allocations: tx.allocations.map(allocation => ({
        ...allocation,
        detailId: allocation.detailId ? allocation.detailId.toString() : null
      }))
    }))

    const serializedAllocations = allAllocations.map(allocation => ({
      ...allocation,
      detailId: allocation.detailId ? allocation.detailId.toString() : null,
      transaction: allocation.transaction ? {
        ...allocation.transaction,
        journalNumber: allocation.transaction.journalNumber.toString(),
        detailId: allocation.transaction.detailId.toString(),
        freeDealId: allocation.transaction.freeDealId ? allocation.transaction.freeDealId.toString() : null
      } : null
    }))

    console.log('Serialization complete. Returning data...');
    
    return {
      transactions: serializedTransactions,
      budgetItems,
      allAllocations: serializedAllocations
    }
  } catch (error) {
    console.error('Allocations loading error:', error)
    return {
      transactions: [],
      budgetItems: [],
      allAllocations: []
    }
  }
}

export const actions: Actions = {
  saveAllocation: async ({ request }) => {
    try {
      const data = await request.formData()
      const transactionId = data.get('transactionId') as string
      const allocationsJson = data.get('allocations') as string

      if (!transactionId || !allocationsJson) {
        return fail(400, { error: 'Missing required data' })
      }

      const allocations = JSON.parse(allocationsJson)

      // 取引IDから detailId を取得
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId }
      })

      if (!transaction) {
        return fail(404, { error: 'Transaction not found' })
      }

      // トランザクション内で分割割当を更新
      await prisma.$transaction(async (tx) => {
        // 既存の分割割当を削除
        await tx.allocationSplit.deleteMany({
          where: { detailId: transaction.detailId }
        })

        // 新しい分割割当を作成
        for (const allocation of allocations) {
          await tx.allocationSplit.create({
            data: {
              detailId: transaction.detailId,
              budgetItemId: allocation.budgetItemId,
              amount: allocation.amount,
              note: allocation.note || null
            }
          })
        }
      })

      return { success: true }
    } catch (error) {
      console.error('Save allocation error:', error)
      return fail(500, { error: 'Failed to save allocation' })
    }
  },

  deleteAllocation: async ({ request }) => {
    try {
      const data = await request.formData()
      const allocationId = data.get('allocationId') as string

      if (!allocationId) {
        return fail(400, { error: 'Missing allocation ID' })
      }

      await prisma.allocationSplit.delete({
        where: { id: allocationId }
      })

      return { success: true }
    } catch (error) {
      console.error('Delete allocation error:', error)
      return fail(500, { error: 'Failed to delete allocation' })
    }
  }
}