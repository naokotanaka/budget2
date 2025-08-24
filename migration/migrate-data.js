#!/usr/bin/env node

/**
 * nagaiku-budget から nagaiku-budget-v2 へのデータ移行スクリプト
 * 
 * 実行方法:
 * node migration/migrate-data.js [--dry-run] [--verbose]
 * 
 * オプション:
 * --dry-run: 実際の移行は行わず、処理内容のみ表示
 * --verbose: 詳細ログを出力
 */

import { Client } from 'pg';
import { createId } from '@paralleldrive/cuid2';

// データベース接続設定
const sourceConfig = {
  user: 'nagaiku_user',
  password: 'nagaiku_password2024',
  host: 'localhost',
  database: 'nagaiku_budget',
  port: 5432,
};

const targetConfig = {
  user: 'nagaiku_user',
  password: 'nagaiku_password2024',
  host: 'localhost',
  database: 'nagaiku_budget_v2_prod',
  port: 5432,
};

// コマンドライン引数の処理
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || DRY_RUN;

class DataMigrator {
  constructor() {
    this.sourceDb = new Client(sourceConfig);
    this.targetDb = new Client(targetConfig);
    this.stats = {
      categories: 0,
      grants: 0,
      budgetItems: 0,
      transactions: 0,
      allocationSplits: 0
    };
  }

  async connect() {
    await this.sourceDb.connect();
    await this.targetDb.connect();
    console.log('✅ データベースに接続しました');
  }

  async disconnect() {
    await this.sourceDb.end();
    await this.targetDb.end();
    console.log('✅ データベース接続を終了しました');
  }

  log(message, force = false) {
    if (VERBOSE || force) {
      console.log(message);
    }
  }

  async execute(query, params = [], description = '') {
    if (DRY_RUN) {
      this.log(`[DRY-RUN] ${description}: ${query}`);
      return { rows: [] };
    }
    
    try {
      this.log(`実行中: ${description}`);
      const result = await this.targetDb.query(query, params);
      return result;
    } catch (error) {
      console.error(`❌ エラー in ${description}:`, error.message);
      throw error;
    }
  }

  async clearTargetDatabase() {
    console.log('🧹 ターゲットデータベースをクリア中...');
    
    const clearQueries = [
      'DELETE FROM allocation_splits',
      'DELETE FROM budget_schedules',
      'DELETE FROM budget_items',
      'DELETE FROM grants',
      'DELETE FROM transactions',
      'DELETE FROM categories',
      'DELETE FROM freee_syncs',
      'DELETE FROM freee_tokens'
    ];

    for (const query of clearQueries) {
      await this.execute(query, [], `クリア: ${query}`);
    }
  }

  async migrateCategories() {
    console.log('📂 カテゴリの移行中...');
    
    const sourceData = await this.sourceDb.query(`
      SELECT id, name, created_at, updated_at, is_active
      FROM categories
      ORDER BY id
    `);

    for (const row of sourceData.rows) {
      const query = `
        INSERT INTO categories (id, name, type, "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      const params = [
        row.id,
        row.name,
        'general', // デフォルトタイプ
        0, // デフォルトソート順
        row.is_active ?? true,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ];

      await this.execute(query, params, `カテゴリ: ${row.name}`);
      this.stats.categories++;
    }

    // シーケンス更新
    await this.execute(
      `SELECT setval('categories_id_seq', COALESCE(MAX(id), 1)) FROM categories`,
      [],
      'カテゴリIDシーケンス更新'
    );
  }

  async migrateGrants() {
    console.log('💰 助成金の移行中...');
    
    const sourceData = await this.sourceDb.query(`
      SELECT id, name, total_amount, start_date, end_date, status, grant_code
      FROM grants
      ORDER BY id
    `);

    for (const row of sourceData.rows) {
      const query = `
        INSERT INTO grants (id, name, "grantCode", "totalAmount", "startDate", "endDate", status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      // 日付を DateTime に変換（PostgreSQLから返された日付オブジェクトをそのまま使用）
      let startDate = null;
      let endDate = null;
      
      if (row.start_date) {
        // PostgreSQLから返されたDateオブジェクトを開始時刻（00:00:00）に設定
        startDate = new Date(row.start_date);
        startDate.setHours(0, 0, 0, 0);
      }
      
      if (row.end_date) {
        // PostgreSQLから返されたDateオブジェクトを終了時刻（23:59:59）に設定
        endDate = new Date(row.end_date);
        endDate.setHours(23, 59, 59, 999);
      }
      
      const params = [
        row.id,
        row.name,
        row.grant_code,
        row.total_amount,
        startDate,
        endDate,
        row.status || 'active',
        new Date(),
        new Date()
      ];

      await this.execute(query, params, `助成金: ${row.name}`);
      this.stats.grants++;
    }

    // シーケンス更新
    await this.execute(
      `SELECT setval('grants_id_seq', COALESCE(MAX(id), 1)) FROM grants`,
      [],
      '助成金IDシーケンス更新'
    );
  }

  async migrateBudgetItems() {
    console.log('📊 予算項目の移行中...');
    
    const sourceData = await this.sourceDb.query(`
      SELECT id, grant_id, name, category, budgeted_amount, remarks
      FROM budget_items
      ORDER BY id
    `);

    for (const row of sourceData.rows) {
      const query = `
        INSERT INTO budget_items (id, "grantId", name, category, "budgetedAmount", note, "sortOrder", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      const params = [
        row.id,
        row.grant_id,
        row.name,
        row.category,
        row.budgeted_amount,
        row.remarks, // remarks → note
        0, // デフォルトソート順
        new Date(),
        new Date()
      ];

      await this.execute(query, params, `予算項目: ${row.name}`);
      this.stats.budgetItems++;
    }

    // シーケンス更新
    await this.execute(
      `SELECT setval('budget_items_id_seq', COALESCE(MAX(id), 1)) FROM budget_items`,
      [],
      '予算項目IDシーケンス更新'
    );
  }

  async migrateTransactions() {
    console.log('💳 取引の移行中...');
    
    const sourceData = await this.sourceDb.query(`
      SELECT 
        id, journal_number, journal_line_number, date, description, amount,
        account, supplier, item, memo, remark, department, management_number,
        freee_deal_id, created_at
      FROM transactions
      ORDER BY journal_number, journal_line_number
    `);

    for (const row of sourceData.rows) {
      const query = `
        INSERT INTO transactions (
          id, "journalNumber", "journalLineNumber", date, description, amount,
          account, supplier, item, memo, remark, department, "managementNumber",
          "freeDealId", "detailId", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `;
      
      // detailId = journal_number * 100 + journal_line_number で生成
      const detailId = BigInt(row.journal_number) * 100n + BigInt(row.journal_line_number);
      
      // 日付を DateTime に変換（時刻は12:00:00に設定）
      const transactionDate = new Date(row.date);
      transactionDate.setHours(12, 0, 0, 0);
      
      const params = [
        row.id,
        row.journal_number,
        row.journal_line_number,
        transactionDate,
        row.description,
        row.amount,
        row.account,
        row.supplier,
        row.item,
        row.memo,
        row.remark,
        row.department,
        row.management_number,
        row.freee_deal_id,
        detailId.toString(), // BigInt を文字列として挿入
        row.created_at || new Date(),
        new Date()
      ];

      await this.execute(query, params, `取引: ${row.id}`);
      this.stats.transactions++;
    }
  }

  async migrateAllocationSplits() {
    console.log('📈 割当の移行中...');
    
    const sourceData = await this.sourceDb.query(`
      SELECT 
        a.transaction_id,
        a.budget_item_id,
        a.amount,
        a.created_at,
        t.journal_number,
        t.journal_line_number
      FROM allocations a
      JOIN transactions t ON a.transaction_id = t.id
      ORDER BY a.id
    `);

    for (const row of sourceData.rows) {
      const query = `
        INSERT INTO allocation_splits (id, "budgetItemId", amount, "detailId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      // detailId = journal_number * 100 + journal_line_number で生成
      const detailId = BigInt(row.journal_number) * 100n + BigInt(row.journal_line_number);
      
      const params = [
        createId(), // 新しいcuid
        row.budget_item_id,
        row.amount,
        detailId.toString(), // BigInt を文字列として挿入
        row.created_at || new Date(),
        new Date()
      ];

      await this.execute(query, params, `割当: ${row.transaction_id} → ${row.budget_item_id}`);
      this.stats.allocationSplits++;
    }
  }

  async validateMigration() {
    console.log('🔍 移行データの検証中...');
    
    if (DRY_RUN) {
      console.log('⚠️  DRY-RUN モードのため検証をスキップします');
      return;
    }

    // データ数の確認
    const checks = [
      { table: 'categories', expected: this.stats.categories },
      { table: 'grants', expected: this.stats.grants },
      { table: 'budget_items', expected: this.stats.budgetItems },
      { table: 'transactions', expected: this.stats.transactions },
      { table: 'allocation_splits', expected: this.stats.allocationSplits }
    ];

    for (const check of checks) {
      const result = await this.targetDb.query(`SELECT COUNT(*) as count FROM ${check.table}`);
      const actual = parseInt(result.rows[0].count);
      
      if (actual === check.expected) {
        console.log(`✅ ${check.table}: ${actual}件 (期待値: ${check.expected}件)`);
      } else {
        console.log(`❌ ${check.table}: ${actual}件 (期待値: ${check.expected}件) - 不一致!`);
      }
    }

    // リレーションの整合性確認
    const relationChecks = [
      {
        name: 'budget_items → grants',
        query: 'SELECT COUNT(*) FROM budget_items b LEFT JOIN grants g ON b."grantId" = g.id WHERE g.id IS NULL'
      },
      {
        name: 'allocation_splits → budget_items',
        query: 'SELECT COUNT(*) FROM allocation_splits a LEFT JOIN budget_items b ON a."budgetItemId" = b.id WHERE b.id IS NULL'
      },
      {
        name: 'allocation_splits → transactions',
        query: 'SELECT COUNT(*) FROM allocation_splits a LEFT JOIN transactions t ON a."detailId" = t."detailId" WHERE t."detailId" IS NULL'
      }
    ];

    for (const check of relationChecks) {
      const result = await this.targetDb.query(check.query);
      const orphaned = parseInt(result.rows[0].count);
      
      if (orphaned === 0) {
        console.log(`✅ ${check.name}: 整合性OK`);
      } else {
        console.log(`❌ ${check.name}: ${orphaned}件の孤立データを発見!`);
      }
    }
  }

  async printSummary() {
    console.log('\n📊 移行結果サマリー:');
    console.log('========================');
    console.log(`カテゴリ: ${this.stats.categories}件`);
    console.log(`助成金: ${this.stats.grants}件`);
    console.log(`予算項目: ${this.stats.budgetItems}件`);
    console.log(`取引: ${this.stats.transactions}件`);
    console.log(`割当: ${this.stats.allocationSplits}件`);
    console.log('========================');
    
    if (DRY_RUN) {
      console.log('⚠️  これはDRY-RUNの結果です。実際のデータは変更されていません。');
    } else {
      console.log('✅ データ移行が正常に完了しました!');
    }
  }

  async run() {
    try {
      console.log(`🚀 データ移行を開始します... (Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'})`);
      
      await this.connect();
      
      if (!DRY_RUN) {
        await this.clearTargetDatabase();
      }
      
      await this.migrateCategories();
      await this.migrateGrants();
      await this.migrateBudgetItems();
      await this.migrateTransactions();
      await this.migrateAllocationSplits();
      
      await this.validateMigration();
      await this.printSummary();
      
    } catch (error) {
      console.error('❌ 移行中にエラーが発生しました:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// スクリプト実行
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  const migrator = new DataMigrator();
  migrator.run();
}

export default DataMigrator;