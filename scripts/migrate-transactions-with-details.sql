-- 旧DBから取引データを本番DBに移行し、割当と紐付けるSQL
-- 
-- 実行方法:
-- 1. このSQLを旧DBで実行して、INSERT文を生成
-- 2. 生成されたINSERT文を本番DBで実行

-- 旧DBで実行して、本番DB用のINSERT文を生成
SELECT 
  'INSERT INTO transactions (id, "journalNumber", "journalLineNumber", date, description, amount, ' ||
  'account, supplier, department, item, memo, remark, "managementNumber", "freeDealId", "detailId", ' ||
  '"createdAt", "updatedAt") VALUES (' ||
  '''' || 'old_' || t.id || ''', ' ||
  COALESCE(t.journal_number::text, 'NULL') || ', ' ||
  COALESCE(t.journal_line_number::text, 'NULL') || ', ' ||
  '''' || t.date::text || ''', ' ||
  COALESCE('''' || REPLACE(t.description, '''', '''''') || '''', 'NULL') || ', ' ||
  t.amount || ', ' ||
  COALESCE('''' || REPLACE(t.account, '''', '''''') || '''', 'NULL') || ', ' ||
  COALESCE('''' || REPLACE(t.supplier, '''', '''''') || '''', 'NULL') || ', ' ||
  COALESCE('''' || REPLACE(t.department, '''', '''''') || '''', 'NULL') || ', ' ||
  COALESCE('''' || REPLACE(t.item, '''', '''''') || '''', 'NULL') || ', ' ||
  COALESCE('''' || REPLACE(t.memo, '''', '''''') || '''', 'NULL') || ', ' ||
  COALESCE('''' || REPLACE(t.remark, '''', '''''') || '''', 'NULL') || ', ' ||
  COALESCE('''' || REPLACE(t.management_number, '''', '''''') || '''', 'NULL') || ', ' ||
  COALESCE(t.freee_deal_id::text, 'NULL') || ', ' ||
  -- detailIdの計算: freee_deal_idがある場合は仮のdetailIdを生成
  CASE 
    WHEN t.freee_deal_id IS NOT NULL THEN 
      '''' || t.freee_deal_id::text || '_temp'''
    ELSE 'NULL'
  END || ', ' ||
  '''' || COALESCE(t.created_at, NOW())::text || ''', ' ||
  '''' || NOW()::text || ''');'
FROM transactions t
WHERE EXISTS (
  SELECT 1 FROM allocations a 
  WHERE a.transaction_id = t.id AND a.amount > 0
)
ORDER BY t.journal_number, t.journal_line_number;