-- nagaiku-budget-v2 PostgreSQL パフォーマンス最適化スクリプト
-- 実行前にデータベースへの接続を確認してください

-- ========== 検索・ソート用インデックス作成 ==========

-- 取引テーブル用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_account ON transactions(account);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_amount ON transactions(amount);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_freeDealId ON transactions("freeDealId") WHERE "freeDealId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date_amount ON transactions(date, amount);

-- 分割割当テーブル用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocation_splits_transaction ON allocation_splits("transactionId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocation_splits_budget_item ON allocation_splits("budgetItemId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocation_splits_amount ON allocation_splits(amount);

-- 予算項目テーブル用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_items_grant ON budget_items("grantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_items_category ON budget_items(category) WHERE category IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_items_sort_order ON budget_items("sortOrder");

-- 予算スケジュールテーブル用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_schedules_budget_item ON budget_schedules("budgetItemId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_schedules_year_month ON budget_schedules(year, month);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_schedules_active ON budget_schedules("isActive") WHERE "isActive" = true;

-- 助成金テーブル用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grants_status ON grants(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grants_dates ON grants("startDate", "endDate") WHERE "startDate" IS NOT NULL AND "endDate" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grants_grant_code ON grants("grantCode") WHERE "grantCode" IS NOT NULL;

-- カテゴリテーブル用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_type_active ON categories(type, "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_sort_order ON categories("sortOrder");

-- ========== 複合クエリ用インデックス ==========

-- 取引と分割割当の組み合わせ用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date_desc ON transactions(date DESC);

-- 予算項目と助成金の組み合わせ用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_items_grant_sort ON budget_items("grantId", "sortOrder");

-- ========== 統計情報更新 ==========
ANALYZE;

-- ========== インデックス使用状況確認用クエリ（実行後に確認） ==========
/*
-- インデックス使用統計の確認
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- テーブルサイズ確認
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::text)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::text) DESC;
*/