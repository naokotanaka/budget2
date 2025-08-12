#!/usr/bin/env tsx
/**
 * 同期ロジックをテスト - 勘定科目マスタ取得とマッピング
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSyncLogic() {
  try {
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
    const companyId = company.id;
    
    console.log(`📢 会社: ${company.display_name} (ID: ${companyId})\n`);
    
    // 1. 勘定科目マスタを取得
    console.log('=== STEP 1: 勘定科目マスタ取得 ===');
    const accountItemsResponse = await fetch(
      `https://api.freee.co.jp/api/1/account_items?company_id=${companyId}`,
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const accountItemsData = await accountItemsResponse.json();
    const accountItemMap = new Map<number, string>();
    
    if (accountItemsData.account_items) {
      accountItemsData.account_items.forEach((item: any) => {
        accountItemMap.set(item.id, item.name);
      });
      console.log(`✅ 勘定科目マスタ取得完了: ${accountItemMap.size}件\n`);
    }
    
    // 2. 最新の取引を1件取得してテスト
    console.log('=== STEP 2: 取引データ取得（accruals: with） ===');
    const dealsResponse = await fetch(
      `https://api.freee.co.jp/api/1/deals?company_id=${companyId}&limit=1&accruals=with`,
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const dealsData = await dealsResponse.json();
    if (dealsData.deals && dealsData.deals.length > 0) {
      const deal = dealsData.deals[0];
      console.log(`取引ID: ${deal.id}`);
      console.log(`取引日: ${deal.issue_date}`);
      
      if (deal.details && deal.details.length > 0) {
        const detail = deal.details[0];
        console.log('\n=== STEP 3: 勘定科目名の取得ロジック ===');
        console.log(`明細のaccount_item_id: ${detail.account_item_id}`);
        console.log(`明細のaccount_item_name: ${detail.account_item_name || '(なし)'}`);
        
        // 同期処理と同じロジック
        let accountName = '不明';
        
        // まずaccount_item_nameがあればそれを使用
        if (detail.account_item_name) {
          accountName = detail.account_item_name;
          console.log(`✅ account_item_nameから取得: ${accountName}`);
        } 
        // なければaccount_item_idからマスタを参照
        else if (detail.account_item_id) {
          const masterName = accountItemMap.get(detail.account_item_id);
          if (masterName) {
            accountName = masterName;
            console.log(`✅ マスタから取得: ${accountName}`);
          } else {
            console.log(`❌ マスタに存在しないID: ${detail.account_item_id}`);
          }
        }
        
        console.log(`\n最終的な勘定科目名: ${accountName}`);
        
        // データベースの該当レコードを確認
        const existingTx = await prisma.transaction.findFirst({
          where: { freeDealId: BigInt(deal.id) }
        });
        
        if (existingTx) {
          console.log(`\n=== データベースの現在値 ===`);
          console.log(`DB勘定科目: ${existingTx.account}`);
          console.log(`正しい値: ${accountName}`);
          
          if (existingTx.account !== accountName) {
            console.log('⚠️ データベースの値が正しくありません！');
          }
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
testSyncLogic();