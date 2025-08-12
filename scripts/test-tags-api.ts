#!/usr/bin/env tsx
/**
 * freee APIのタグ（メモタグ）情報を取得するスクリプト
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTagsAPI() {
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
    
    console.log(`📢 会社: ${company.display_name} (ID: ${company.id})\n`);
    
    // freee APIからタグ一覧を取得
    const tagsResponse = await fetch(
      `https://api.freee.co.jp/api/1/tags?company_id=${company.id}`,
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!tagsResponse.ok) {
      console.error(`❌ タグ取得エラー: ${tagsResponse.status}`);
      const errorText = await tagsResponse.text();
      console.error('Error response:', errorText);
      return;
    }

    const tagsData = await tagsResponse.json();
    console.log('📊 取得したタグ数:', tagsData.tags?.length || 0);
    
    // タグ情報を表示
    if (tagsData.tags && tagsData.tags.length > 0) {
      console.log('\n【メモタグ一覧】');
      console.log('='.repeat(60));
      
      tagsData.tags.forEach((tag: any) => {
        console.log(`\nタグID: ${tag.id}`);
        console.log(`タグ名: ${tag.name}`);
        console.log(`ショートカット: ${tag.shortcut || '(なし)'}`);
        console.log(`作成日時: ${tag.created_at || '(不明)'}`);
        
        // その他のフィールドを探す
        const knownFields = ['id', 'name', 'shortcut', 'created_at', 'company_id'];
        const otherFields = Object.keys(tag).filter(key => !knownFields.includes(key));
        
        if (otherFields.length > 0) {
          console.log('【その他のフィールド】');
          otherFields.forEach(key => {
            console.log(`  ${key}:`, tag[key]);
          });
        }
      });
      
      // タグIDとタグ名のマッピングを作成
      console.log('\n' + '='.repeat(60));
      console.log('【タグIDマッピング】');
      const tagMap = new Map();
      tagsData.tags.forEach((tag: any) => {
        tagMap.set(tag.id, tag.name);
        console.log(`  ${tag.id} => ${tag.name}`);
      });
      
      // 特定のタグID（例：14744862）があれば、その名前を表示
      const testTagId = 14744862;
      if (tagMap.has(testTagId)) {
        console.log(`\n✨ タグID ${testTagId} の名前: ${tagMap.get(testTagId)}`);
      }
      
    } else {
      console.log('\n⚠️ タグが登録されていません');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ タグ情報取得完了');
    console.log('これらのタグ名を取引データと紐付けることで、メモタグを表示できます');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
testTagsAPI();