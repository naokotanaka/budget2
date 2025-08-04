import { prisma } from '$lib/database'
import type { PageServerLoad, Actions } from './$types'
import { fail, redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async () => {
  try {
    // 未割当または部分割当の取引を取得
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

    // 予算項目一覧（割当用）
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

    // 全ての分割割当を取得
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

    return {
      transactions: unallocatedOrPartial,
      budgetItems,
      allAllocations
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

      // トランザクション内で分割割当を更新
      await prisma.$transaction(async (tx) => {
        // 既存の分割割当を削除
        await tx.allocationSplit.deleteMany({
          where: { transactionId }
        })

        // 新しい分割割当を作成
        for (const allocation of allocations) {
          await tx.allocationSplit.create({
            data: {
              transactionId,
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