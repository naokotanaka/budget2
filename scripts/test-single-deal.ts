#!/usr/bin/env tsx
/**
 * 特定の取引を個別に取得して詳細を確認
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSingleDeal() {
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
    
    // 取引一覧を取得（accruals: withパラメータ付き）
    console.log('=== 取引一覧API（accruals: with） ===');
    const listResponse = await fetch(
      `https://api.freee.co.jp/api/1/deals?company_id=${company.id}&start_issue_date=2025-07-01&end_issue_date=2025-07-01&accruals=with&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const listData = await listResponse.json();
    if (listData.deals && listData.deals.length > 0) {
      const deal = listData.deals[0];
      console.log('取引ID:', deal.id);
      console.log('取引日付:', deal.issue_date);
      console.log('\n【明細情報（一覧API）】');
      if (deal.details && deal.details.length > 0) {
        console.log('明細データあり:');
        deal.details.forEach((detail: any, index: number) => {
          console.log(`\n明細 ${index + 1}:`);
          console.log('  全フィールド:', JSON.stringify(detail, null, 2));
        });
      } else {
        console.log('明細データなし');
      }
      
      // 同じ取引を個別APIで取得
      console.log('\n' + '='.repeat(60));
      console.log('=== 個別取引API ===');
      const singleResponse = await fetch(
        `https://api.freee.co.jp/api/1/deals/${deal.id}?company_id=${company.id}&accruals=with`,
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const singleData = await singleResponse.json();
      if (singleData.deal) {
        console.log('\n【明細情報（個別API）】');
        if (singleData.deal.details && singleData.deal.details.length > 0) {
          console.log('明細データあり:');
          singleData.deal.details.forEach((detail: any, index: number) => {
            console.log(`\n明細 ${index + 1}:`);
            console.log('  全フィールド:', JSON.stringify(detail, null, 2));
          });
        } else {
          console.log('明細データなし');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
testSingleDeal();
