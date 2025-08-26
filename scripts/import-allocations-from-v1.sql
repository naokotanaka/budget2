-- nagaiku-budgetからnagaiku-budget-v2へ割当データを移行するスクリプト
-- 実行: env PGPASSWORD=nagaiku_password2024 psql -h localhost -U nagaiku_user -d nagaiku_budget_v2_prod < scripts/import-allocations-from-v1.sql

-- 既存の割当データをバックアップ
CREATE TABLE IF NOT EXISTS allocation_splits_backup_20250827 AS 
SELECT * FROM allocation_splits;

-- 既存の割当データをクリア
TRUNCATE TABLE allocation_splits CASCADE;

-- nagaiku-budgetから割当データをインポート
-- transaction_idとbudget_item_idのマッピングが必要
INSERT INTO allocation_splits (
    id,
    "budgetItemId",
    amount,
    note,
    "createdAt",
    "updatedAt",
    "detailId"
)
SELECT 
    CONCAT('import_v1_', a.id, '_', EXTRACT(EPOCH FROM NOW())::INTEGER) as id,
    a.budget_item_id as "budgetItemId",
    a.amount,
    '旧システムから移行' as note,
    COALESCE(a.created_at, NOW()) as "createdAt",
    COALESCE(a.created_at, NOW()) as "updatedAt",
    t2."detailId"
FROM 
    dblink('dbname=nagaiku_budget user=nagaiku_user password=nagaiku_password2024',
           'SELECT id, transaction_id, budget_item_id, amount, created_at FROM allocations')
    AS a(id integer, transaction_id varchar, budget_item_id integer, amount integer, created_at timestamp)
JOIN 
    dblink('dbname=nagaiku_budget user=nagaiku_user password=nagaiku_password2024',
           'SELECT id, deal_id FROM transactions WHERE deal_id IS NOT NULL')
    AS t1(id varchar, deal_id bigint) ON a.transaction_id = t1.id
JOIN 
    transactions t2 ON t2."detailId" = t1.deal_id::bigint
WHERE 
    a.budget_item_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM budget_items WHERE id = a.budget_item_id)
ON CONFLICT (id) DO UPDATE SET
    "budgetItemId" = EXCLUDED."budgetItemId",
    amount = EXCLUDED.amount,
    note = EXCLUDED.note,
    "updatedAt" = NOW();

-- 結果を確認
SELECT 
    'インポート完了' as status,
    COUNT(*) as imported_count 
FROM allocation_splits 
WHERE id LIKE 'import_v1_%';

-- budget_item_idごとの集計
SELECT 
    bi.name,
    COUNT(*) as allocation_count,
    SUM(a.amount) as total_amount
FROM allocation_splits a
JOIN budget_items bi ON bi.id = a."budgetItemId"
GROUP BY bi.id, bi.name
ORDER BY bi.name;