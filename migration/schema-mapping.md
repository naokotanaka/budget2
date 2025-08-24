# nagaiku-budget から nagaiku-budget-v2 へのスキーママッピング

## 概要
現行システム（nagaiku_budget）から新システム（nagaiku_budget_v2_prod）へのデータ移行のための詳細なマッピング情報

## データ量
- grants: 8件
- budget_items: 27件
- transactions: 582件
- allocations: 221件
- categories: 12件

## テーブル別マッピング

### 1. grants → grants

| 旧フィールド | 新フィールド | 型変更 | 備考 |
|--------------|--------------|--------|------|
| id | id | なし | |
| name | name | なし | |
| total_amount | totalAmount | なし | |
| start_date | startDate | date → DateTime | 時刻部分は00:00:00で設定 |
| end_date | endDate | date → DateTime | 時刻部分は23:59:59で設定 |
| status | status | なし | |
| grant_code | grantCode | なし | |
| - | createdAt | 新規 | 現在時刻を設定 |
| - | updatedAt | 新規 | 現在時刻を設定 |

### 2. budget_items → budget_items

| 旧フィールド | 新フィールド | 型変更 | 備考 |
|--------------|--------------|--------|------|
| id | id | なし | |
| grant_id | grantId | なし | |
| name | name | なし | |
| category | category | なし | |
| budgeted_amount | budgetedAmount | なし | |
| remarks | note | なし | フィールド名変更 |
| planned_start_date | - | 削除 | 新システムでは未使用 |
| planned_end_date | - | 削除 | 新システムでは未使用 |
| - | createdAt | 新規 | 現在時刻を設定 |
| - | updatedAt | 新規 | 現在時刻を設定 |
| - | sortOrder | 新規 | デフォルト値0 |

### 3. transactions → transactions

| 旧フィールド | 新フィールド | 型変更 | 備考 |
|--------------|--------------|--------|------|
| id | id | なし | |
| journal_number | journalNumber | integer → BigInt | |
| journal_line_number | journalLineNumber | なし | |
| date | date | date → DateTime | 時刻部分は12:00:00で設定 |
| description | description | なし | |
| amount | amount | なし | |
| account | account | なし | |
| supplier | supplier | なし | |
| item | item | なし | |
| memo | memo | なし | |
| remark | remark | なし | |
| department | department | なし | |
| management_number | managementNumber | なし | |
| freee_deal_id | freeDealId | bigint → BigInt | |
| created_at | createdAt | なし | |
| - | updatedAt | 新規 | 現在時刻を設定 |
| - | detailDescription | 新規 | NULLで設定 |
| - | detailId | 新規 | journal_number * 100 + journal_line_number で生成 |
| - | receiptIds | 新規 | NULLで設定 |
| - | tags | 新規 | NULLで設定 |

### 4. allocations → allocation_splits

| 旧フィールド | 新フィールド | 型変更 | 備考 |
|--------------|--------------|--------|------|
| id | - | 削除 | 新システムではcuid()を使用 |
| transaction_id | - | 削除 | detailIdを使ってリレーション構築 |
| budget_item_id | budgetItemId | なし | |
| amount | amount | なし | |
| created_at | createdAt | なし | |
| - | id | 新規 | cuid()で生成 |
| - | note | 新規 | NULLで設定 |
| - | updatedAt | 新規 | 現在時刻を設定 |
| - | detailId | 新規 | transactionのdetailIdを参照 |

### 5. categories → categories

| 旧フィールド | 新フィールド | 型変更 | 備考 |
|--------------|--------------|--------|------|
| id | id | なし | |
| name | name | なし | |
| description | - | 削除 | 新システムでは未使用 |
| created_at | createdAt | なし | |
| updated_at | updatedAt | なし | |
| is_active | isActive | なし | |
| - | type | 新規 | デフォルト値'general' |
| - | color | 新規 | NULLで設定 |
| - | sortOrder | 新規 | デフォルト値0 |

## 重要な注意点

### 1. detailIdの生成ロジック
- 新システムでは取引と割当をdetailIdで関連付け
- detailId = journal_number * 100 + journal_line_number で生成
- この値はユニークになることを確認済み

### 2. リレーションの変更
- 旧システム: allocations.transaction_id → transactions.id
- 新システム: allocation_splits.detailId → transactions.detailId

### 3.移行順序
1. categories
2. grants  
3. budget_items
4. transactions
5. allocation_splits

### 4. データ変換の考慮事項
- 日付型から日時型への変換
- integerからBigIntへの変換
- 新規フィールドのデフォルト値設定
- cuid()による新しいID生成

## 制約と依存関係
- budget_items.grantId → grants.id (CASCADE DELETE)
- allocation_splits.budgetItemId → budget_items.id (CASCADE DELETE)
- allocation_splits.detailId → transactions.detailId (NULLABLE)