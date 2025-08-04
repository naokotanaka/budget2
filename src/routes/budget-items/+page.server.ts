import { prisma } from '$lib/database'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  try {
    // 助成金と予算項目を取得
    const grants = await prisma.grant.findMany({
      include: {
        budgetItems: {
          include: {
            schedules: {
              where: {
                isActive: true
              },
              orderBy: [
                { year: 'asc' },
                { month: 'asc' }
              ]
            },
            allocations: true,
            _count: {
              select: { allocations: true }
            }
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    // 予算項目を平坦化
    const budgetItems = grants.flatMap(grant => 
      grant.budgetItems.map(item => ({
        ...item,
        grant: {
          id: grant.id,
          name: grant.name,
          grantCode: grant.grantCode,
          status: grant.status
        },
        totalAllocated: item.allocations.reduce((sum, a) => sum + a.amount, 0),
        allocationCount: item._count.allocations,
        activeMonths: item.schedules.length
      }))
    )

    return {
      grants,
      budgetItems
    }
  } catch (error) {
    console.error('Budget items loading error:', error)
    return {
      grants: [],
      budgetItems: []
    }
  }
}