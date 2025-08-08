#!/usr/bin/env npx tsx

/**
 * レガシーCSVインポーターのテストスクリプト
 */

import { readFileSync } from 'fs';
import { LegacyCSVImporter } from './src/lib/utils/legacy-csv-importer.js';

async function testLegacyImport() {
  console.log('🚀 レガシーCSVインポーターのテスト開始');
  
  try {
    // レガシーCSVファイルを読み込み
    const csvPath = '/home/tanaka/nagaiku-budget/backend/test_export.csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    console.log('📁 ファイル読み込み完了:', csvPath);
    
    // インポーターを初期化（ドライランモード）
    const importer = new LegacyCSVImporter({
      dryRun: true,
      validateRelationships: true,
      encoding: 'auto',
      progressCallback: (progress) => {
        console.log(`📊 ${progress.stage}: ${progress.percentage}% - ${progress.message || ''}`);
      }
    });
    
    // インポート実行
    console.log('\n🔄 インポート処理開始...');
    const result = await importer.importLegacyCSV(csvContent);
    
    // 結果表示
    console.log('\n📋 インポート結果:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 成功: ${result.success}`);
    console.log(`📝 メッセージ: ${result.message}`);
    
    // エンコーディング情報
    console.log('\n🔤 エンコーディング情報:');
    console.log(`検出されたエンコーディング: ${result.encoding.detectedEncoding}`);
    console.log(`信頼度: ${Math.round(result.encoding.confidence * 100)}%`);
    if (result.encoding.bom) {
      console.log('BOM検出: あり');
    }
    
    // 変換統計
    console.log('\n📊 変換統計:');
    const stats = result.conversion.stats;
    console.log(`助成金: ${stats.grantsConverted} 件`);
    console.log(`予算項目: ${stats.budgetItemsConverted} 件`);
    console.log(`割当: ${stats.allocationsConverted} 件`);
    console.log(`エラー: ${stats.errorsCount} 件`);
    console.log(`警告: ${stats.warningsCount} 件`);
    
    // 詳細データサンプル
    if (result.conversion.grants.length > 0) {
      console.log('\n💰 助成金データサンプル:');
      const sample = result.conversion.grants[0];
      console.log(`- 名称: ${sample.name}`);
      console.log(`- 総額: ${sample.totalAmount || '未設定'}`);
      console.log(`- ステータス: ${sample.status}`);
      console.log(`- レガシーID: ${sample.legacyId}`);
    }
    
    if (result.conversion.budgetItems.length > 0) {
      console.log('\n📝 予算項目データサンプル:');
      const sample = result.conversion.budgetItems[0];
      console.log(`- 名称: ${sample.name}`);
      console.log(`- カテゴリ: ${sample.category || '未設定'}`);
      console.log(`- 予算額: ${sample.budgetedAmount || '未設定'}`);
      console.log(`- レガシーID: ${sample.legacyId}`);
      console.log(`- レガシー助成金ID: ${sample.legacyGrantId}`);
    }
    
    if (result.conversion.allocations.length > 0) {
      console.log('\n💸 割当データサンプル:');
      const sample = result.conversion.allocations[0];
      console.log(`- 取引ID: ${sample.transactionId}`);
      console.log(`- 金額: ${sample.amount}`);
      console.log(`- レガシーID: ${sample.legacyId}`);
      console.log(`- レガシー予算項目ID: ${sample.legacyBudgetItemId}`);
    }
    
    // 検証結果
    console.log('\n🔍 検証結果:');
    console.log(`データ有効性: ${result.validation.isValid ? '✅ 有効' : '❌ 無効'}`);
    
    // 関係性チェック
    const checks = result.validation.relationshipChecks;
    if (checks.missingGrants.length > 0) {
      console.log(`❌ 存在しない助成金ID: ${checks.missingGrants.join(', ')}`);
    }
    if (checks.missingBudgetItems.length > 0) {
      console.log(`❌ 存在しない予算項目ID: ${checks.missingBudgetItems.join(', ')}`);
    }
    
    // エラー表示
    if (result.errors.length > 0) {
      console.log('\n❌ エラー一覧:');
      result.errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      if (result.errors.length > 10) {
        console.log(`... および ${result.errors.length - 10} 件のエラー`);
      }
    }
    
    // 警告表示
    if (result.warnings.length > 0) {
      console.log('\n⚠️  警告一覧:');
      result.warnings.slice(0, 5).forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
      if (result.warnings.length > 5) {
        console.log(`... および ${result.warnings.length - 5} 件の警告`);
      }
    }
    
    console.log('\n✅ テスト完了');
    
    // 次のステップの提案
    if (result.success) {
      console.log('\n🎯 次のステップ:');
      console.log('1. 必要に応じてデータを修正');
      console.log('2. dryRun: false でインポート実行');
      console.log('3. データベースのバックアップを事前に取得');
    }
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (import.meta.url === `file://${process.argv[1]}`) {
  testLegacyImport().catch(console.error);
}