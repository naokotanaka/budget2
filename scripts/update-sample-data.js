import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSampleData() {
  try {
    console.log('既存データの更新開始...');

    // 既存データのステータス更新
    await prisma.grant.updateMany({
      where: { status: 'active' },
      data: { status: 'active' }
    });

    // テスト用の終了・報告済みデータを作成
    const testData = [
      {
        name: '2023年度福祉助成金',
        grantCode: 'WELFARE2023',
        totalAmount: 2000000,
        startDate: new Date('2023-04-01'),
        endDate: new Date('2024-03-31'),
        status: 'applied'
      },
      {
        name: '2024年度教育支援金',
        grantCode: 'EDU2024',
        totalAmount: 1500000,
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-12-31'),
        status: 'completed'
      },
      {
        name: '2022年度地域活性化',
        grantCode: 'REGION2022',
        totalAmount: 3000000,
        startDate: new Date('2022-06-01'),
        endDate: new Date('2023-05-31'),
        status: 'applied'
      }
    ];

    for (const data of testData) {
      const existing = await prisma.grant.findFirst({
        where: { name: data.name }
      });

      if (!existing) {
        await prisma.grant.create({ data });
        console.log(`作成: ${data.name}`);
      } else {
        console.log(`既存: ${data.name}`);
      }
    }

    // 更新後のデータ確認
    const grants = await prisma.grant.findMany({
      select: {
        name: true,
        status: true,
        startDate: true,
        endDate: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('\n=== 更新後のデータ ===');
    grants.forEach(grant => {
      console.log(`${grant.name}: ${grant.status} (${grant.startDate?.toISOString().split('T')[0]} ~ ${grant.endDate?.toISOString().split('T')[0]})`);
    });

    console.log('\n更新完了！');
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSampleData();