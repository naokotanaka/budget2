#!/usr/bin/env tsx
/**
 * freee APIの取引データ構造を調査するスクリプト
 * 「振込手数料」などの取引内容がどのフィールドに含まれるか確認
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFreeeAPI() {
  try {
    // freeeトークンを取得
    const token = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (!token) {
      console.error('❌ freeeトークンが見つかりません');
      return;
    }

    console.log('✅ freeeトークン取得成功');
    
    // まず会社情報を取得
    const companiesResponse = await fetch(
      'https://api.freee.co.jp/api/1/companies',
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!companiesResponse.ok) {
      console.error(`❌ 会社情報取得エラー: ${companiesResponse.status}`);
      return;
    }
    
    const companiesData = await companiesResponse.json();
    const company = companiesData.companies?.[0];
    
    if (!company) {
      console.error('❌ 会社情報が見つかりません');
      return;
    }
    
    console.log(`📢 会社: ${company.display_name} (ID: ${company.id})`);
    
    // 特定の取引を取得（管理番号2507-093、freee ID: 2897457014）
    const specificDealResponse = await fetch(
      `https://api.freee.co.jp/api/1/deals/${2897457014}?company_id=${company.id}`,
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (specificDealResponse.ok) {
      const specificData = await specificDealResponse.json();
      console.log('📌 管理番号2507-093の取引詳細:');
      console.log(JSON.stringify(specificData.deal, null, 2));
    }
    
    // freee APIから最新の取引を取得
    const response = await fetch(
      `https://api.freee.co.jp/api/1/deals?company_id=${company.id}&limit=3`,
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`❌ freee API error: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const data = await response.json();
    console.log('\n📊 取得した取引数:', data.deals?.length || 0);
    
    // 各取引の詳細を表示
    if (data.deals && data.deals.length > 0) {
      data.deals.forEach((deal: any, index: number) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`取引 ${index + 1} (ID: ${deal.id})`);
        console.log('='.repeat(60));
        
        // 基本情報
        console.log('\n【基本情報】');
        console.log('  日付:', deal.issue_date);
        console.log('  金額:', deal.amount);
        console.log('  取引先:', deal.partner_name || '(未設定)');
        
        // 取引タイプ関連
        console.log('\n【取引タイプ情報】※ここに「振込手数料」があるはず');
        console.log('  type:', deal.type);
        console.log('  type_display_name:', deal.type_display_name);
        console.log('  status:', deal.status);
        console.log('  description:', deal.description);
        console.log('  memo:', deal.memo);
        console.log('  ref_number:', deal.ref_number);
        
        // 未知のフィールドを探す
        console.log('\n【その他のフィールド】');
        const knownFields = ['id', 'company_id', 'issue_date', 'due_date', 'amount', 'due_amount', 
                           'type', 'partner_id', 'partner_code', 'partner_name', 'ref_number',
                           'description', 'memo', 'details', 'receipt_ids', 'receipts'];
        
        Object.keys(deal).forEach(key => {
          if (!knownFields.includes(key)) {
            console.log(`  ${key}:`, JSON.stringify(deal[key]));
          }
        });
        
        // 明細情報
        if (deal.details && deal.details.length > 0) {
          console.log('\n【明細情報】');
          deal.details.forEach((detail: any, dIndex: number) => {
            console.log(`\n  明細 ${dIndex + 1}:`);
            console.log('    勘定科目:', detail.account_item_name);
            console.log('    品目:', detail.item_name || '(なし)');
            console.log('    金額:', detail.amount);
            console.log('    説明:', detail.description || '(なし)');
            console.log('    部門:', detail.section_name || '(なし)');
            console.log('    税区分:', detail.tax_code || '(なし)');
            console.log('    タグID:', detail.tag_ids || '(なし)');
            console.log('    タグ名:', detail.tag_names || '(なし)');
            console.log('    メモタグ:', detail.memo_tags || '(なし)');
            
            // 明細の未知フィールド
            const knownDetailFields = ['id', 'account_item_id', 'account_item_name', 
                                      'tax_code', 'item_id', 'item_name', 'section_id', 
                                      'section_name', 'amount', 'description', 'tag_ids', 
                                      'tag_names', 'memo_tags'];
            
            console.log('    【明細のその他フィールド】');
            Object.keys(detail).forEach(key => {
              if (!knownDetailFields.includes(key)) {
                console.log(`      ${key}:`, JSON.stringify(detail[key]));
              }
            });
          });
        }
        
        // タグ情報（取引レベル）
        if (deal.tag_ids || deal.tags || deal.memo_tags) {
          console.log('\n【タグ情報（取引レベル）】');
          console.log('  tag_ids:', deal.tag_ids);
          console.log('  tags:', deal.tags);
          console.log('  memo_tags:', deal.memo_tags);
        }
        
        // 支払・振込関連（もしあれば）
        if (deal.payments) {
          console.log('\n【支払情報】');
          console.log('  payments:', JSON.stringify(deal.payments, null, 2));
        }
        
        if (deal.transfers) {
          console.log('\n【振込情報】');
          console.log('  transfers:', JSON.stringify(deal.transfers, null, 2));
        }
        
        if (deal.walletable_id || deal.from_walletable_id) {
          console.log('\n【口座情報】');
          console.log('  walletable_id:', deal.walletable_id);
          console.log('  from_walletable_id:', deal.from_walletable_id);
        }
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 調査完了');
    console.log('「振込手数料」のような情報は上記のどこかにあるはずです');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
testFreeeAPI();