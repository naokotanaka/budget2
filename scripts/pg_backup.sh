#!/bin/bash
# nagaiku-budget-v2 PostgreSQL自動バックアップスクリプト

BACKUP_DIR="/home/tanaka/projects/nagaiku-budget-v2/backup/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "PostgreSQLバックアップ開始: $DATE"

# データベースバックアップ（カスタム形式）
PGPASSWORD=nagaiku_password2024 pg_dump -h localhost -U nagaiku_user -Fc nagaiku_budget_v2_dev > "$BACKUP_DIR/nagaiku_budget_v2_dev_$DATE.custom"
if [ $? -eq 0 ]; then
    echo "カスタム形式バックアップ完了: nagaiku_budget_v2_dev_$DATE.custom"
else
    echo "エラー: カスタム形式バックアップに失敗しました"
    exit 1
fi

# データベースバックアップ（SQL形式）
PGPASSWORD=nagaiku_password2024 pg_dump -h localhost -U nagaiku_user nagaiku_budget_v2_dev > "$BACKUP_DIR/nagaiku_budget_v2_dev_$DATE.sql"
if [ $? -eq 0 ]; then
    echo "SQL形式バックアップ完了: nagaiku_budget_v2_dev_$DATE.sql"
else
    echo "エラー: SQL形式バックアップに失敗しました"
    exit 1
fi

# スキーマのみバックアップ（構造確認用）
PGPASSWORD=nagaiku_password2024 pg_dump -h localhost -U nagaiku_user --schema-only nagaiku_budget_v2_dev > "$BACKUP_DIR/schema_only_$DATE.sql"
if [ $? -eq 0 ]; then
    echo "スキーマバックアップ完了: schema_only_$DATE.sql"
fi

# データのみバックアップ（データ移行用）
PGPASSWORD=nagaiku_password2024 pg_dump -h localhost -U nagaiku_user --data-only nagaiku_budget_v2_dev > "$BACKUP_DIR/data_only_$DATE.sql"
if [ $? -eq 0 ]; then
    echo "データバックアップ完了: data_only_$DATE.sql"
fi

# 7日間より古いバックアップを削除
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.custom" -mtime +7 -delete

echo "バックアップ作業完了: $(date)"

# バックアップファイルサイズを表示
echo "作成されたバックアップファイル:"
ls -lh "$BACKUP_DIR"/*_$DATE.*