#!/bin/bash

# nagaiku-budget から nagaiku-budget-v2 への安全なデータ移行スクリプト
# 現行システムのデータは絶対に変更しません

set -e  # エラーで停止

echo "🛡️ 現行システムデータ移行開始..."
echo "⚠️ 現行システム（nagaiku_budget）は読み取り専用です"
echo "✅ 新システム（nagaiku_budget_v2_dev）のみに書き込みます"

# データベース接続情報
PGPASSWORD=nagaiku_password2024
export PGPASSWORD
DB_HOST=localhost
DB_USER=nagaiku_user
CURRENT_DB=nagaiku_budget
NEW_DB=nagaiku_budget_v2_dev

# 1. 新システムのバックアップ作成
echo "📦 新システムのバックアップ作成中..."
pg_dump -h $DB_HOST -U $DB_USER $NEW_DB > "backup_before_migration_$(date +%Y%m%d_%H%M%S).sql"
echo "✅ バックアップ完了"

# 2. 現行システムからデータエクスポート
echo "📤 現行システムからデータエクスポート中..."

# 助成金データエクスポート
psql -h $DB_HOST -U $DB_USER -d $CURRENT_DB -c "
COPY (
    SELECT id, name, grant_code, total_amount, start_date, end_date, status
    FROM grants 
    ORDER BY id
) TO STDOUT WITH CSV HEADER
" > /tmp/grants_export.csv

# 予算項目データエクスポート（助成金情報含む）
psql -h $DB_HOST -U $DB_USER -d $CURRENT_DB -c "
COPY (
    SELECT 
        bi.id, bi.grant_id, bi.name, bi.category, 
        bi.budgeted_amount, bi.remarks,
        g.name as grant_name, g.grant_code as grant_code
    FROM budget_items bi 
    JOIN grants g ON bi.grant_id = g.id 
    ORDER BY bi.id
) TO STDOUT WITH CSV HEADER
" > /tmp/budget_items_export.csv

echo "✅ エクスポート完了"

# 3. 新システムの既存データクリア
echo "🧹 新システムの既存データクリア中..."
psql -h $DB_HOST -U $DB_USER -d $NEW_DB -c "
TRUNCATE budget_schedules CASCADE;
TRUNCATE budget_items CASCADE; 
TRUNCATE grants CASCADE;
"
echo "✅ データクリア完了"

# 4. 助成金データインポート
echo "📥 助成金データインポート中..."
psql -h $DB_HOST -U $DB_USER -d $NEW_DB -c "
CREATE TEMP TABLE temp_grants (
    old_id INTEGER,
    name TEXT,
    grant_code TEXT,
    total_amount INTEGER,
    start_date DATE,
    end_date DATE,
    status TEXT
);

COPY temp_grants FROM '/tmp/grants_export.csv' WITH CSV HEADER;

INSERT INTO grants (name, \"grantCode\", \"totalAmount\", \"startDate\", \"endDate\", status)
SELECT 
    name,
    grant_code,
    total_amount,
    CASE 
        WHEN start_date IS NOT NULL THEN start_date::timestamp 
        ELSE NULL 
    END,
    CASE 
        WHEN end_date IS NOT NULL THEN end_date::timestamp 
        ELSE NULL 
    END,
    CASE 
        WHEN status = 'active' THEN 'in_progress'
        WHEN status = 'completed' THEN 'completed'
        WHEN status = 'applied' THEN 'applied'
        ELSE COALESCE(status, 'in_progress')
    END
FROM temp_grants
ORDER BY old_id;
"

# 5. 予算項目データインポート
echo "📥 予算項目データインポート中..."
psql -h $DB_HOST -U $DB_USER -d $NEW_DB -c "
CREATE TEMP TABLE temp_budget_items (
    old_id INTEGER,
    old_grant_id INTEGER,
    name TEXT,
    category TEXT,
    budgeted_amount INTEGER,
    remarks TEXT,
    grant_name TEXT,
    grant_code TEXT
);

COPY temp_budget_items FROM '/tmp/budget_items_export.csv' WITH CSV HEADER;

-- 助成金IDマッピングテーブル作成
CREATE TEMP TABLE grant_id_mapping AS
SELECT 
    g_new.id as new_grant_id,
    g_new.\"grantCode\" as grant_code,
    g_new.name as grant_name
FROM grants g_new;

INSERT INTO budget_items (name, category, \"budgetedAmount\", note, \"grantId\", \"sortOrder\")
SELECT 
    tbi.name,
    tbi.category,
    COALESCE(tbi.budgeted_amount, 0),
    tbi.remarks,
    gm.new_grant_id,
    tbi.old_id
FROM temp_budget_items tbi
JOIN grant_id_mapping gm ON (
    (gm.grant_code = tbi.grant_code) OR 
    (gm.grant_code IS NULL AND tbi.grant_code IS NULL AND gm.grant_name = tbi.grant_name)
)
ORDER BY tbi.old_id;
"

# 6. 月チェック生成（1週間以上の月）
echo "📅 月チェック生成中..."
psql -h $DB_HOST -U $DB_USER -d $NEW_DB -c "
-- 助成金期間から月チェックを生成
WITH RECURSIVE grant_months AS (
    -- 各助成金の開始月から終了月まで月を列挙
    SELECT 
        g.id as grant_id,
        DATE_TRUNC('month', g.\"startDate\")::date as month_start,
        g.\"startDate\"::date as grant_start,
        g.\"endDate\"::date as grant_end,
        EXTRACT(YEAR FROM DATE_TRUNC('month', g.\"startDate\")) as year,
        EXTRACT(MONTH FROM DATE_TRUNC('month', g.\"startDate\")) as month
    FROM grants g
    WHERE g.\"startDate\" IS NOT NULL AND g.\"endDate\" IS NOT NULL
    
    UNION ALL
    
    SELECT 
        gm.grant_id,
        (gm.month_start + INTERVAL '1 month')::date,
        gm.grant_start,
        gm.grant_end,
        EXTRACT(YEAR FROM gm.month_start + INTERVAL '1 month') as year,
        EXTRACT(MONTH FROM gm.month_start + INTERVAL '1 month') as month
    FROM grant_months gm
    WHERE gm.month_start + INTERVAL '1 month' <= DATE_TRUNC('month', gm.grant_end)
),
valid_months AS (
    SELECT DISTINCT
        gm.grant_id,
        gm.year,
        gm.month
    FROM grant_months gm
    WHERE (
        -- その月の助成金期間の日数が7日以上
        LEAST(
            gm.grant_end,
            (DATE_TRUNC('month', gm.month_start) + INTERVAL '1 month' - INTERVAL '1 day')::date
        ) - GREATEST(
            gm.grant_start,
            gm.month_start
        ) + 1
    ) >= 7
)
INSERT INTO budget_schedules (\"budgetItemId\", year, month, \"isActive\")
SELECT 
    bi.id,
    vm.year::integer,
    vm.month::integer,
    true
FROM valid_months vm
JOIN budget_items bi ON bi.\"grantId\" = vm.grant_id;
"

# 7. 移行結果確認
echo "📊 移行結果確認中..."
psql -h $DB_HOST -U $DB_USER -d $NEW_DB -c "
SELECT 
    'grants' as table_name, 
    COUNT(*) as imported_count 
FROM grants
UNION ALL
SELECT 
    'budget_items', 
    COUNT(*) 
FROM budget_items
UNION ALL  
SELECT 
    'budget_schedules', 
    COUNT(*) 
FROM budget_schedules;
"

echo ""
echo "🎉 データ移行完了！"
echo "📋 移行サマリー:"
psql -h $DB_HOST -U $DB_USER -d $NEW_DB -c "
SELECT 
    g.name as grant_name,
    g.\"grantCode\" as grant_code,
    COUNT(DISTINCT bi.id) as budget_items_count,
    COUNT(DISTINCT bs.id) as schedule_months_count
FROM grants g
LEFT JOIN budget_items bi ON bi.\"grantId\" = g.id
LEFT JOIN budget_schedules bs ON bs.\"budgetItemId\" = bi.id
GROUP BY g.id, g.name, g.\"grantCode\"
ORDER BY g.name;
"

# 8. 一時ファイル削除
echo "🧹 一時ファイルクリーンアップ中..."
rm -f /tmp/grants_export.csv /tmp/budget_items_export.csv

echo "✅ 全ての作業が完了しました！"