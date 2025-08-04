import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // ========== カテゴリの作成 ==========
  console.log('Creating categories...')
  
  const categories = await Promise.all([
    // 取引カテゴリ
    prisma.category.upsert({
      where: { name: '事業費' },
      update: {},
      create: {
        name: '事業費',
        type: 'transaction',
        color: '#10B981',
        sortOrder: 1
      }
    }),
    prisma.category.upsert({
      where: { name: '管理費' },
      update: {},
      create: {
        name: '管理費',
        type: 'transaction',
        color: '#3B82F6',
        sortOrder: 2
      }
    }),
    
    // 予算項目カテゴリ
    prisma.category.upsert({
      where: { name: '人件費' },
      update: {},
      create: {
        name: '人件費',
        type: 'budget_item',
        color: '#EF4444',
        sortOrder: 1
      }
    }),
    prisma.category.upsert({
      where: { name: '物件費' },
      update: {},
      create: {
        name: '物件費',
        type: 'budget_item',
        color: '#F59E0B',
        sortOrder: 2
      }
    }),
    prisma.category.upsert({
      where: { name: '事業活動費' },
      update: {},
      create: {
        name: '事業活動費',
        type: 'budget_item',
        color: '#8B5CF6',
        sortOrder: 3
      }
    })
  ])

  console.log(`Created ${categories.length} categories`)

  // ========== サンプル助成金の作成 ==========
  console.log('Creating sample grants...')
  
  const grant1 = await prisma.grant.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'サンプル助成金A',
      grantCode: 'GRANT-A-2024',
      totalAmount: 5000000, // 500万円
      startDate: new Date('2024-04-01'),
      endDate: new Date('2025-03-31'),
      status: 'active'
    }
  })

  const grant2 = await prisma.grant.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'サンプル助成金B',
      grantCode: 'GRANT-B-2024',
      totalAmount: 3000000, // 300万円
      startDate: new Date('2024-07-01'),
      endDate: new Date('2025-06-30'),
      status: 'active'
    }
  })

  console.log('Created sample grants')

  // ========== サンプル予算項目の作成 ==========
  console.log('Creating sample budget items...')
  
  const budgetItems = await Promise.all([
    // 助成金A の予算項目
    prisma.budgetItem.create({
      data: {
        name: '管理費（家賃・光熱費）',
        category: '物件費',
        budgetedAmount: 1200000, // 120万円
        note: '家賃・光熱費の按分用',
        grantId: grant1.id
      }
    }),
    prisma.budgetItem.create({
      data: {
        name: '事業費（活動経費）',
        category: '事業活動費',
        budgetedAmount: 2000000, // 200万円
        note: 'イベント・研修等の活動経費',
        grantId: grant1.id
      }
    }),
    prisma.budgetItem.create({
      data: {
        name: '人件費（スタッフ給与）',
        category: '人件費',
        budgetedAmount: 1800000, // 180万円
        note: '専従スタッフの給与',
        grantId: grant1.id
      }
    }),

    // 助成金B の予算項目
    prisma.budgetItem.create({
      data: {
        name: '管理費（施設維持）',
        category: '物件費',
        budgetedAmount: 800000, // 80万円
        note: '施設維持費の按分用',
        grantId: grant2.id
      }
    }),
    prisma.budgetItem.create({
      data: {
        name: '事業費（広報活動）',
        category: '事業活動費',
        budgetedAmount: 1200000, // 120万円
        note: 'チラシ作成・広報活動費',
        grantId: grant2.id
      }
    }),
    prisma.budgetItem.create({
      data: {
        name: '人件費（臨時職員）',
        category: '人件費',
        budgetedAmount: 1000000, // 100万円
        note: 'イベント時の臨時職員費',
        grantId: grant2.id
      }
    })
  ])

  console.log(`Created ${budgetItems.length} budget items`)

  // ========== 予算項目スケジュールの作成 ==========
  console.log('Creating budget schedules...')
  
  const schedules = []
  
  // 各予算項目に2024年度のスケジュールを作成
  for (const budgetItem of budgetItems) {
    // 通年で有効なスケジュール（4月-3月）
    const isGrantB = budgetItem.grantId === grant2.id
    const startMonth = isGrantB ? 7 : 4  // 助成金Bは7月開始
    const endMonth = isGrantB ? 6 : 3    // 助成金Bは6月終了
    
    for (let month = startMonth; month <= 12; month++) {
      schedules.push(
        prisma.budgetSchedule.create({
          data: {
            budgetItemId: budgetItem.id,
            year: 2024,
            month: month,
            isActive: true
          }
        })
      )
    }
    
    if (endMonth <= 6) {
      for (let month = 1; month <= endMonth; month++) {
        schedules.push(
          prisma.budgetSchedule.create({
            data: {
              budgetItemId: budgetItem.id,
              year: 2025,
              month: month,
              isActive: true
            }
          })
        )
      }
    }
  }

  await Promise.all(schedules)
  console.log(`Created ${schedules.length} budget schedules`)

  // ========== サンプル取引データの作成 ==========
  console.log('Creating sample transactions...')
  
  const transactions = await Promise.all([
    prisma.transaction.create({
      data: {
        id: 'tx_001',
        journalNumber: 1,
        journalLineNumber: 1,
        date: new Date('2024-08-01'),
        description: '事務用品購入',
        amount: 15000,
        account: '事業費',
        supplier: 'オフィス用品店',
        department: '管理部門'
      }
    }),
    prisma.transaction.create({
      data: {
        id: 'tx_002',
        journalNumber: 2,
        journalLineNumber: 1,
        date: new Date('2024-08-01'),
        description: '家賃',
        amount: 120000,
        account: '管理費',
        supplier: '不動産会社',
        department: '管理部門'
      }
    }),
    prisma.transaction.create({
      data: {
        id: 'tx_003',
        journalNumber: 3,
        journalLineNumber: 1,
        date: new Date('2024-08-02'),
        description: '水道光熱費',
        amount: 45000,
        account: '管理費',
        supplier: '電力会社',
        department: '管理部門'
      }
    })
  ])

  console.log(`Created ${transactions.length} sample transactions`)

  // ========== サンプル分割割当の作成 ==========
  console.log('Creating sample allocation splits...')
  
  // 家賃の按分例（助成金A:72,000円、助成金B:48,000円）
  const allocations = await Promise.all([
    prisma.allocationSplit.create({
      data: {
        transactionId: 'tx_002',
        budgetItemId: budgetItems[0].id, // 助成金A 管理費
        amount: 72000,
        note: '家賃按分（60%）'
      }
    }),
    prisma.allocationSplit.create({
      data: {
        transactionId: 'tx_002',
        budgetItemId: budgetItems[3].id, // 助成金B 管理費
        amount: 48000,
        note: '家賃按分（40%）'
      }
    }),
    
    // 事務用品（単一割当）
    prisma.allocationSplit.create({
      data: {
        transactionId: 'tx_001',
        budgetItemId: budgetItems[1].id, // 助成金A 事業費
        amount: 15000,
        note: '事務用品（全額）'
      }
    })
  ])

  console.log(`Created ${allocations.length} sample allocation splits`)

  console.log('✅ Database seeding completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })