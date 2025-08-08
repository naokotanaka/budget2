-- nagaiku-budget から nagaiku-budget-v2 へのデータ移行スクリプト
-- 安全性: 現行システムのデータは一切変更せず、読み取りのみ
-- 対象: 新システム（nagaiku_budget_v2_dev）への挿入のみ

-- ⚠️ 重要: 実行前に新システムのデータをバックアップ
-- PGPASSWORD=nagaiku_password2024 pg_dump -h localhost -U nagaiku_user nagaiku_budget_v2_dev > backup_before_migration.sql

-- 1. 新システムの既存データをクリア（開発環境のみ）
TRUNCATE budget_schedules CASCADE;
TRUNCATE budget_items CASCADE; 
TRUNCATE grants CASCADE;

-- 2. 助成金データの移行
-- 現行システム: nagaiku_budget.grants → 新システム: nagaiku_budget_v2_dev.grants
INSERT INTO grants (name, "grantCode", "totalAmount", "startDate", "endDate", status)
SELECT 
    name,
    grant_code,
    total_amount,
    start_date::timestamp,  -- date → timestamp変換
    end_date::timestamp,    -- date → timestamp変換
    CASE 
        WHEN status = 'active' THEN 'in_progress'
        WHEN status = 'completed' THEN 'completed'
        WHEN status = 'applied' THEN 'applied'
        ELSE status
    END as status
FROM dblink('host=localhost port=5432 dbname=nagaiku_budget user=nagaiku_user password=nagaiku_password2024',
           'SELECT id, name, grant_code, total_amount, start_date, end_date, status FROM grants ORDER BY id')
AS t(old_id INTEGER, name TEXT, grant_code TEXT, total_amount INTEGER, start_date DATE, end_date DATE, status TEXT);

-- 3. 予算項目データの移行
-- 現行システム: nagaiku_budget.budget_items → 新システム: nagaiku_budget_v2_dev.budget_items
WITH current_grants AS (
    SELECT name, grant_code, id as new_grant_id
    FROM grants
),
legacy_budget_items AS (
    SELECT *
    FROM dblink('host=localhost port=5432 dbname=nagaiku_budget user=nagaiku_user password=nagaiku_password2024',
               'SELECT bi.id, bi.grant_id, bi.name, bi.category, bi.budgeted_amount, bi.remarks, g.name as grant_name, g.grant_code
                FROM budget_items bi 
                JOIN grants g ON bi.grant_id = g.id 
                ORDER BY bi.id')
    AS t(old_id INTEGER, old_grant_id INTEGER, name TEXT, category TEXT, budgeted_amount INTEGER, 
         remarks TEXT, grant_name TEXT, grant_code TEXT)
)
INSERT INTO budget_items (name, category, "budgetedAmount", note, "grantId", "sortOrder")
SELECT 
    lbi.name,
    lbi.category,
    lbi.budgeted_amount,
    lbi.remarks,  -- remarks → note
    cg.new_grant_id,
    lbi.old_id    -- 元のIDをソート順として使用
FROM legacy_budget_items lbi
JOIN current_grants cg ON (
    cg.grant_code = lbi.grant_code OR 
    (cg.grant_code IS NULL AND lbi.grant_code IS NULL AND cg.name = lbi.grant_name)
);

-- 4. 予算スケジュール（月チェック）の生成
-- 助成金の期間から、1週間以上含む月にチェックを設定
INSERT INTO budget_schedules ("budgetItemId", year, month, "isActive")
WITH grant_periods AS (
    SELECT 
        g.id as grant_id,
        g."startDate",
        g."endDate",
        EXTRACT(YEAR FROM g."startDate") as start_year,
        EXTRACT(MONTH FROM g."startDate") as start_month,
        EXTRACT(DAY FROM g."startDate") as start_day,
        EXTRACT(YEAR FROM g."endDate") as end_year,
        EXTRACT(MONTH FROM g."endDate") as end_month,
        EXTRACT(DAY FROM g."endDate") as end_day
    FROM grants g
    WHERE g."startDate" IS NOT NULL AND g."endDate" IS NOT NULL
),
monthly_coverage AS (
    SELECT 
        gp.grant_id,
        month_series.year_month_date,
        EXTRACT(YEAR FROM month_series.year_month_date) as year,
        EXTRACT(MONTH FROM month_series.year_month_date) as month,
        -- その月の開始日と終了日
        DATE_TRUNC('month', month_series.year_month_date) as month_start,
        (DATE_TRUNC('month', month_series.year_month_date) + INTERVAL '1 month' - INTERVAL '1 day')::date as month_end,
        -- 助成金期間との重複期間を計算
        GREATEST(gp."startDate"::date, DATE_TRUNC('month', month_series.year_month_date)::date) as overlap_start,
        LEAST(gp."endDate"::date, (DATE_TRUNC('month', month_series.year_month_date) + INTERVAL '1 month' - INTERVAL '1 day')::date) as overlap_end
    FROM grant_periods gp
    CROSS JOIN generate_series(
        DATE_TRUNC('month', gp."startDate"), 
        DATE_TRUNC('month', gp."endDate"), 
        '1 month'::interval
    ) AS month_series(year_month_date)
),
valid_months AS (
    SELECT 
        mc.grant_id,
        mc.year,
        mc.month
    FROM monthly_coverage mc
    WHERE (mc.overlap_end - mc.overlap_start + 1) >= 7  -- 7日以上（1週間以上）
)
SELECT 
    bi.id as budget_item_id,
    vm.year,
    vm.month,
    true as is_active
FROM valid_months vm
JOIN budget_items bi ON bi."grantId" = vm.grant_id;

-- 5. 移行結果の確認クエリ
-- 移行後に手動実行してデータを確認してください:
/*
SELECT 'grants' as table_name, COUNT(*) as count FROM grants
UNION ALL
SELECT 'budget_items', COUNT(*) FROM budget_items
UNION ALL  
SELECT 'budget_schedules', COUNT(*) FROM budget_schedules;

SELECT g.name, COUNT(bi.id) as budget_items_count, COUNT(bs.id) as schedule_count
FROM grants g
LEFT JOIN budget_items bi ON bi."grantId" = g.id
LEFT JOIN budget_schedules bs ON bs."budgetItemId" = bi.id
GROUP BY g.id, g.name
ORDER BY g.name;
*/