-- detailIdベースのスキーマへの移行スクリプト
-- 
-- 注意：このスクリプトは段階的に実行してください

-- 1. 割当データの一時テーブル作成
CREATE TEMP TABLE temp_allocations AS
SELECT 
  a.id as old_id,
  t."detailId",
  t."freeDealId",
  a."budgetItemId",
  a.amount,
  a.note,
  a."createdAt",
  a."updatedAt"
FROM allocation_splits a
JOIN transactions t ON a."transactionId" = t.id
WHERE t."detailId" IS NOT NULL;

-- 確認
SELECT COUNT(*) as allocation_count FROM temp_allocations;

-- 2. 既存の割当データを削除
DELETE FROM allocation_splits;

-- 3. 取引データを削除
DELETE FROM transactions;

-- 4. 取引テーブルのスキーマを変更
-- detailIdが必須になるようにする
ALTER TABLE transactions ALTER COLUMN "detailId" SET NOT NULL;

-- 5. detailIdにユニーク制約を追加（freeDealIdの制約を削除）
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS "transactions_freeDealId_key";
ALTER TABLE transactions ADD CONSTRAINT "transactions_detailId_key" UNIQUE ("detailId");

-- 6. インデックスを更新
DROP INDEX IF EXISTS "idx_transactions_freedealid";
CREATE INDEX idx_transactions_detailid ON transactions ("detailId");
CREATE INDEX idx_transactions_freedealid ON transactions ("freeDealId") WHERE "freeDealId" IS NOT NULL;