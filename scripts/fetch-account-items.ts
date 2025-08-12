#!/usr/bin/env tsx
/**
 * freee APIから勘定科目マスタを取得してキャッシュする
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fetchAccountItems() {
  try {
    // freeeトークンを取得
    const token = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (!token) {
      console.error('❌ freeeトークンが見つかりません');
      return;
    }

    // 会社情報を取得
    const companiesResponse = await fetch(
      'https://api.freee.co.jp/api/1/companies',
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const companiesData = await companiesResponse.json();
    const company = companiesData.companies?.[0];
    
    console.log(`📢 会社: ${company.display_name} (ID: ${company.id})\n`);
    
    // 勘定科目一覧を取得
    const response = await fetch(
      `https://api.freee.co.jp/api/1/account_items?company_id=${company.id}`,
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    console.log('📊 取得した勘定科目数:', data.account_items?.length || 0);
    
    // IDと名前のマッピングを作成
    const accountMap = new Map();
    data.account_items?.forEach((item: any) => {
      accountMap.set(item.id, item.name);
    });
    
    // テスト：特定のIDで名前を取得
    const testId = 253177176; // 先ほどのログから
    console.log(`\n勘定科目ID ${testId} の名前: ${accountMap.get(testId)}`);
    
    // 【事】【管】を含む勘定科目のみ表示
    console.log('\n【事】【管】を含む主要勘定科目:');
    console.log('='.repeat(60));
    data.account_items?.forEach((item: any) => {
      if (item.name?.includes('【事】') || item.name?.includes('【管】')) {
        console.log(`  ${item.id}: ${item.name}`);
      }
    });
    
    return accountMap;
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
fetchAccountItems();