# nagaiku-budget から nagaiku-budget-v2 データ移行レポート

## 実施概要
- **実施日時**: 2025-08-22
- **移行元**: nagaiku_budget（現行システム）
- **移行先**: nagaiku_budget_v2_prod（新システム）
- **移行ステータス**: ✅ 成功

## 移行結果サマリー

| テーブル | 移行件数 | ステータス |
|----------|----------|------------|
| categories | 12件 | ✅ 完了 |
| grants | 8件 | ✅ 完了 |
| budget_items | 27件 | ✅ 完了 |
| transactions | 582件 | ✅ 完了 |
| allocation_splits | 221件 | ✅ 完了 |

## 主要な変更点

### 1. スキーマの変更
- **allocations** → **allocation_splits** テーブル名変更
- 割当データに `detailId` フィールドを追加し、取引との新しい関連付けを実装
- `freeDealId` のUNIQUE制約を削除（重複データ対応）

### 2. detailIdの付与ロジック
```javascript
detailId = journal_number * 100 + journal_line_number
```
- 例: journal_number=5070202, journal_line_number=1 → detailId=507020201
- 全582件の取引でユニークなdetailIdが正常に生成・適用

### 3. 日付型の変換
- **旧システム**: DATE型
- **新システム**: DATETIME型
- 変換ルール:
  - start_date → 00:00:00に設定
  - end_date → 23:59:59に設定
  - transaction date → 12:00:00に設定

### 4. 新規フィールドの追加
- **grants**: createdAt, updatedAt
- **budget_items**: sortOrder, createdAt, updatedAt
- **categories**: type, color, sortOrder
- **transactions**: detailDescription, receiptIds, tags
- **allocation_splits**: note, updatedAt

## データ整合性チェック結果

### リレーション整合性
✅ **budget_items → grants**: 整合性OK（孤立データなし）
✅ **allocation_splits → budget_items**: 整合性OK（孤立データなし）
✅ **allocation_splits → transactions**: 整合性OK（孤立データなし）

### データ検証サンプル

#### 助成金別予算項目と割当状況
```
grant_name    | budget_item_name      | allocation_count | total_allocated
WAM補         | 消耗品費              | 68               | 327,625円
WAM補         | 賃金（アルバイト）    | 20               | 695,126円
WAM補         | 家賃                  | 2                | 301,600円
つながり10    | 食材費                | 18               | 222,682円
むす春        | 食品購入費            | 8                | 48,120円
```

#### 取引と割当の関連確認
- detailIdによる関連付けが正常に動作
- 取引金額と割当金額の整合性確認済み

## 解決した問題

### 1. 日付変換エラー
- **問題**: PostgreSQLから返される日付オブジェクトの不適切な文字列結合
- **解決**: JavaScriptのDateオブジェクトを直接使用し、setHours()で時刻設定

### 2. freeDealId重複エラー
- **問題**: 現行システムで同一freee取引IDが複数の仕訳行に存在
- **解決**: PrismaスキーマのfreeDealId UNIQUE制約を削除

### 3. ESモジュール対応
- **問題**: package.jsonの"type": "module"設定によるrequire構文エラー
- **解決**: import構文とES Module形式に変更

## 移行後の確認事項

### ✅ 完了済み
- [ ] 全テーブルの件数確認
- [ ] リレーション整合性チェック
- [ ] サンプルデータの抽出確認
- [ ] detailIdの一意性確認
- [ ] 割当金額の集計確認

### 📋 今後の作業
- [ ] アプリケーションでの動作確認
- [ ] freee連携機能のテスト
- [ ] ユーザー受け入れテスト
- [ ] 本番運用開始

## 使用したファイル
- `/home/tanaka/projects/nagaiku-budget-v2/migration/migrate-data.js` - 移行スクリプト
- `/home/tanaka/projects/nagaiku-budget-v2/migration/schema-mapping.md` - スキーママッピング
- `/home/tanaka/projects/nagaiku-budget-v2/prisma/schema.prisma` - 新システムスキーマ

## 実行方法
```bash
# DRY-RUN（テスト実行）
node migration/migrate-data.js --dry-run --verbose

# 本番実行
node migration/migrate-data.js

# 詳細ログ付き実行
node migration/migrate-data.js --verbose
```

## 備考
- 移行中に現行システムを停止する必要はありません
- 移行先データベースは完全にクリアしてから移行を実行
- すべてのデータ移行が正常完了し、整合性チェックもすべてパス
- 新システムでの運用準備が整いました

---
**移行責任者**: Claude Code Assistant  
**移行完了日時**: 2025-08-22