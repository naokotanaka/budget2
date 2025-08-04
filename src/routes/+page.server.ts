import { prisma } from '$lib/database'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  try {
    // 助成金情報を取得
    const grants = await prisma.grant.findMany({
      include: {
        budgetItems: {
          include: {
            allocations: true,
            _count: {
              select: { allocations: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 最近の取引を取得
    const recentTransactions = await prisma.transaction.findMany({
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
      orderBy: { date: 'desc' },
      take: 10
    })

    // 統計情報を計算
    const totalTransactions = await prisma.transaction.count()
    const totalAllocations = await prisma.allocationSplit.count()
    const unallocatedTransactions = await prisma.transaction.count({
      where: {
        allocations: {
          none: {}
        }
      }
    })

    return {
      grants,
      recentTransactions,
      stats: {
        totalTransactions,
        totalAllocations,
        unallocatedTransactions
      }
    }
  } catch (error) {
    console.error('Dashboard data loading error:', error)
    return {
      grants: [],
      recentTransactions: [],
      stats: {
        totalTransactions: 0,
        totalAllocations: 0,
        unallocatedTransactions: 0
      }
    }
  }
}