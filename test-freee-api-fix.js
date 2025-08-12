#!/usr/bin/env node
/**
 * freee API パラメータテストスクリプト
 * 現在の問題：description, memo, account_item_name が undefined
 * 原因：accruals=without, payments=without が詳細情報を制限している可能性
 */

import { FreeeAPIClient } from './src/lib/freee/client.js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function testFreeeAPI() {
  try {
    console.log('=== freee API パラメータテスト開始 ===');
    
    // 保存されたトークンを取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      where: { id: 1 }
    });

    if (!tokenRecord) {
      console.error('freeeトークンが見つかりません');
      return;
    }

    const client = new FreeeAPIClient({
      clientId: process.env.FREEE_CLIENT_ID,
      clientSecret: process.env.FREEE_CLIENT_SECRET,
      redirectUri: process.env.FREEE_REDIRECT_URI,
      baseUrl: process.env.FREEE_BASE_URL || 'https://api.freee.co.jp'
    });

    let accessToken = tokenRecord.accessToken;

    // トークン期限チェック
    if (new Date() >= tokenRecord.expiresAt) {
      console.log('トークンを更新中...');
      const newToken = await client.refreshToken(tokenRecord.refreshToken);
      accessToken = newToken.accessToken;
    }

    // 会社IDを取得
    const companies = await client.getCompanies(accessToken);
    if (companies.length === 0) {
      console.error('会社が見つかりません');
      return;
    }
    const companyId = companies[0].id;
    console.log(`使用する会社ID: ${companyId}`);

    // === テスト1: 現在のパラメータ（問題のある方法） ===
    console.log('\n=== テスト1: 現在のパラメータ（accruals=without, payments=without） ===');
    await testAPICall(accessToken, companyId, 'current', {
      accruals: 'without',
      payments: 'without'
    });

    // === テスト2: accruals=with, payments=without ===
    console.log('\n=== テスト2: accruals=with, payments=without ===');
    await testAPICall(accessToken, companyId, 'test2', {
      accruals: 'with',
      payments: 'without'
    });

    // === テスト3: accruals=without, payments=with ===
    console.log('\n=== テスト3: accruals=without, payments=with ===');
    await testAPICall(accessToken, companyId, 'test3', {
      accruals: 'without',
      payments: 'with'
    });

    // === テスト4: 両方とも with ===
    console.log('\n=== テスト4: accruals=with, payments=with ===');
    await testAPICall(accessToken, companyId, 'test4', {
      accruals: 'with',
      payments: 'with'
    });

    // === テスト5: パラメータなし ===
    console.log('\n=== テスト5: accruals, payments パラメータなし ===');
    await testAPICall(accessToken, companyId, 'test5', {});

  } catch (error) {
    console.error('テストエラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function testAPICall(accessToken, companyId, testName, customParams) {
  try {
    // 基本パラメータ
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      limit: '3', // テスト用に少数に制限
      offset: '0'
    });

    // カスタムパラメータを追加
    Object.entries(customParams).forEach(([key, value]) => {
      params.append(key, value);
    });

    // 日付範囲（最近1週間）
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    params.append('start_issue_date', startDate.toISOString().split('T')[0]);
    params.append('end_issue_date', endDate.toISOString().split('T')[0]);

    const url = `https://api.freee.co.jp/api/1/deals?${params.toString()}`;
    console.log(`${testName} URL:`, url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${testName} エラー:`, response.status, errorText);
      return;
    }

    const data = await response.json();
    console.log(`${testName} 取得件数:`, data.deals?.length || 0);

    // 最初の取引の詳細を確認
    if (data.deals && data.deals.length > 0) {
      const deal = data.deals[0];
      console.log(`${testName} サンプルデータ:`, {
        id: deal.id,
        description: deal.description,
        memo: deal.memo,
        ref_number: deal.ref_number,
        partner_name: deal.partner_name,
        details: deal.details?.map(detail => ({
          account_item_name: detail.account_item_name,
          item_name: detail.item_name,
          description: detail.description,
          section_name: detail.section_name
        }))
      });
    }

  } catch (error) {
    console.error(`${testName} テストエラー:`, error);
  }
}

// 実行
testFreeeAPI();