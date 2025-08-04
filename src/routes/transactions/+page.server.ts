import { prisma } from '$lib/database'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  try {
    // 全取引を取得（割当情報含む）
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

    // 予算項目一覧（割当用）
    const budgetItems = await prisma.budgetItem.findMany({
      include: {
        grant: true
      },
      orderBy: [
        { grant: { name: 'asc' } },
        { name: 'asc' }
      ]
    })

    return {
      transactions,
      budgetItems
    }
  } catch (error) {
    console.error('Transactions loading error:', error)
    return {
      transactions: [],
      budgetItems: []
    }
  }
}