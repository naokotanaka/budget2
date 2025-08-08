#!/usr/bin/env node

/**
 * レガシーCSVインポート機能のテストスクリプト
 * 実際のtest_export.csvファイルを使用してテストを実行
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { LegacyCSVParser } from './src/lib/utils/legacy-csv-parser.js';
import { LegacyCSVConverter } from './src/lib/utils/legacy-csv-converter.js';
import { LegacyCSVValidator } from './src/lib/utils/legacy-csv-validator.js';

async function runTest() {
  console.log('🚀 レガシーCSVインポート機能テスト開始\n');

  try {
    // 1. CSVファイルの読み込み
    console.log('📁 CSVファイルを読み込み中...');
    const csvPath = resolve('/home/tanaka/nagaiku-budget/backend/test_export.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    console.log(`✅ ファイル読み込み完了: ${csvPath}`);
    console.log(`📄 ファイルサイズ: ${csvContent.length} 文字\n`);

    // 2. CSVパースのテスト
    console.log('🔍 CSVファイルを解析中...');
    const parser = new LegacyCSVParser();
    const parsedData = await parser.parseCSV(csvContent);
    
    console.log('📊 パース結果:');
    console.log(`  助成金データ: ${parsedData.grants.length} 件`);
    console.log(`  予算項目データ: ${parsedData.budgetItems.length} 件`);
    console.log(`  割当データ: ${parsedData.allocations.length} 件`);
    console.log(`  パースエラー: ${parsedData.parseErrors.length} 件`);
    console.log(`  警告: ${parsedData.warnings.length} 件\n`);

    // パースエラーの表示
    if (parsedData.parseErrors.length > 0) {
      console.log('⚠️ パースエラー:');
      parsedData.parseErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.section}] 行${error.line}: ${error.message}`);
      });
      console.log('');
    }

    // 警告の表示
    if (parsedData.warnings.length > 0) {
      console.log('⚠️ 警告:');
      parsedData.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
      console.log('');
    }

    // 3. データ検証のテスト
    console.log('🔍 データ検証を実行中...');
    const validator = new LegacyCSVValidator();
    const validationResult = validator.validateLegacyData(parsedData);
    
    console.log('📊 検証結果:');
    console.log(`  有効: ${validationResult.isValid ? '✅ YES' : '❌ NO'}`);
    console.log(`  エラー: ${validationResult.errors.length} 件`);
    console.log(`  警告: ${validationResult.warnings.length} 件`);
    console.log(`  参照エラー - 助成金: ${validationResult.relationshipChecks.missingGrants.length} 件`);
    console.log(`  参照エラー - 予算項目: ${validationResult.relationshipChecks.missingBudgetItems.length} 件\n`);

    // 検証エラーの表示
    if (validationResult.errors.length > 0) {
      console.log('❌ 検証エラー:');
      validationResult.errors.slice(0, 10).forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.section}] 行${error.line}: ${error.message}`);
      });
      if (validationResult.errors.length > 10) {
        console.log(`  ... 他 ${validationResult.errors.length - 10} 件のエラー`);
      }
      console.log('');
    }

    // 4. データ変換のテスト
    console.log('🔄 データ変換を実行中...');
    const converter = new LegacyCSVConverter({
      skipInvalidDates: true,
      defaultGrantStatus: 'in_progress',
      preserveLegacyIds: true,
      validateRelationships: true
    });
    
    const conversionResult = converter.convertLegacyData(parsedData);
    
    console.log('📊 変換結果:');
    console.log(`  助成金変換: ${conversionResult.grants.length} 件`);
    console.log(`  予算項目変換: ${conversionResult.budgetItems.length} 件`);
    console.log(`  割当変換: ${conversionResult.allocations.length} 件`);
    console.log(`  変換エラー: ${conversionResult.errors.length} 件`);
    console.log(`  変換警告: ${conversionResult.warnings.length} 件\n`);

    // 5. サンプルデータの表示
    console.log('📋 サンプルデータ:');
    
    if (conversionResult.grants.length > 0) {
      console.log('\n助成金サンプル (最初の3件):');
      conversionResult.grants.slice(0, 3).forEach((grant, index) => {
        console.log(`  ${index + 1}. ${grant.name}`);
        console.log(`     総額: ${grant.totalAmount ? grant.totalAmount.toLocaleString() + '円' : 'なし'}`);
        console.log(`     期間: ${grant.startDate ? grant.startDate.toISOString().split('T')[0] : 'なし'} - ${grant.endDate ? grant.endDate.toISOString().split('T')[0] : 'なし'}`);
        console.log(`     ステータス: ${grant.status}`);
        console.log(`     レガシーID: ${grant.legacyId}`);
      });
    }

    if (conversionResult.budgetItems.length > 0) {
      console.log('\n予算項目サンプル (最初の3件):');
      conversionResult.budgetItems.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name}`);
        console.log(`     カテゴリ: ${item.category || 'なし'}`);
        console.log(`     予算額: ${item.budgetedAmount ? item.budgetedAmount.toLocaleString() + '円' : 'なし'}`);
        console.log(`     助成金ID: ${item.legacyGrantId}`);
        console.log(`     レガシーID: ${item.legacyId}`);
      });
    }

    if (conversionResult.allocations.length > 0) {
      console.log('\n割当サンプル (最初の3件):');
      conversionResult.allocations.slice(0, 3).forEach((allocation, index) => {
        console.log(`  ${index + 1}. 取引ID: ${allocation.transactionId}`);
        console.log(`     金額: ${allocation.amount.toLocaleString()}円`);
        console.log(`     予算項目ID: ${allocation.legacyBudgetItemId}`);
        console.log(`     レガシーID: ${allocation.legacyId}`);
      });
    }

    // 6. 統計情報の表示
    console.log('\n📈 統計情報:');
    console.log(`  処理対象レコード総数: ${parsedData.grants.length + parsedData.budgetItems.length + parsedData.allocations.length} 件`);
    console.log(`  変換成功レコード数: ${conversionResult.grants.length + conversionResult.budgetItems.length + conversionResult.allocations.length} 件`);
    console.log(`  変換成功率: ${(((conversionResult.grants.length + conversionResult.budgetItems.length + conversionResult.allocations.length) / (parsedData.grants.length + parsedData.budgetItems.length + parsedData.allocations.length)) * 100).toFixed(1)}%`);

    // 7. データ整合性チェック
    console.log('\n🔍 データ整合性チェック:');
    const grantIdMap = new Map(conversionResult.grants.map(g => [g.legacyId, g]));
    const budgetItemIdMap = new Map(conversionResult.budgetItems.map(b => [b.legacyId, b]));
    
    const orphanedBudgetItems = conversionResult.budgetItems.filter(item => 
      !grantIdMap.has(item.legacyGrantId)
    );
    
    const orphanedAllocations = conversionResult.allocations.filter(allocation => 
      !budgetItemIdMap.has(allocation.legacyBudgetItemId)
    );

    console.log(`  孤立した予算項目: ${orphanedBudgetItems.length} 件`);
    console.log(`  孤立した割当: ${orphanedAllocations.length} 件`);

    if (orphanedBudgetItems.length > 0) {
      console.log('  孤立した予算項目:');
      orphanedBudgetItems.slice(0, 5).forEach(item => {
        console.log(`    - ${item.name} (助成金ID: ${item.legacyGrantId})`);
      });
    }

    if (orphanedAllocations.length > 0) {
      console.log('  孤立した割当:');
      orphanedAllocations.slice(0, 5).forEach(allocation => {
        console.log(`    - 取引ID: ${allocation.transactionId} (予算項目ID: ${allocation.legacyBudgetItemId})`);
      });
    }

    // 8. 総合結果
    console.log('\n🎯 テスト結果:');
    const hasErrors = validationResult.errors.length > 0 || conversionResult.errors.length > 0;
    const hasWarnings = validationResult.warnings.length > 0 || conversionResult.warnings.length > 0;
    
    if (!hasErrors) {
      console.log('✅ テスト成功: レガシーCSVインポート機能は正常に動作しています');
    } else {
      console.log('⚠️ テスト警告: エラーが発生しましたが、処理は継続可能です');
    }

    if (hasWarnings) {
      console.log('📝 注意事項: 警告が発生しました。データの確認をお勧めします');
    }

    console.log('\n🏁 テスト完了');
    return !hasErrors;

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
    console.error('スタックトレース:', error instanceof Error ? error.stack : 'N/A');
    return false;
  }
}

// スクリプトとして実行された場合のみテストを実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('テスト実行エラー:', error);
      process.exit(1);
    });
}