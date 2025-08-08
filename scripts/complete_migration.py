#!/usr/bin/env python3
"""
現行システムから新システムへの完全データ移行
現行システムは読み取り専用、新システムのみに書き込み
"""

import psycopg2
import sys
from datetime import datetime, timedelta
import calendar

# データベース接続情報
DB_CONFIG = {
    'host': 'localhost',
    'user': 'nagaiku_user', 
    'password': 'nagaiku_password2024'
}

def connect_db(dbname):
    """データベース接続"""
    config = DB_CONFIG.copy()
    config['database'] = dbname
    return psycopg2.connect(**config)

def migrate_remaining_budget_items():
    """残りの予算項目データを移行"""
    print("📥 残りの予算項目データを移行中...")
    
    # 現行システムから全予算項目データ取得
    with connect_db('nagaiku_budget') as current_conn:
        with current_conn.cursor() as cur:
            cur.execute("""
                SELECT bi.id, bi.name, bi.category, bi.budgeted_amount, bi.remarks, g.grant_code
                FROM budget_items bi
                JOIN grants g ON bi.grant_id = g.id
                ORDER BY bi.id
            """)
            budget_items = cur.fetchall()
    
    # 新システムに既存の予算項目を確認
    with connect_db('nagaiku_budget_v2_dev') as new_conn:
        with new_conn.cursor() as cur:
            cur.execute('SELECT "sortOrder" FROM budget_items')
            existing_ids = {row[0] for row in cur.fetchall()}
    
    # 新システムに未移行データを挿入
    with connect_db('nagaiku_budget_v2_dev') as new_conn:
        with new_conn.cursor() as cur:
            inserted_count = 0
            for item_id, name, category, budgeted_amount, remarks, grant_code in budget_items:
                if item_id not in existing_ids:
                    cur.execute("""
                        INSERT INTO budget_items (name, category, "budgetedAmount", note, "grantId", "sortOrder", "updatedAt")
                        SELECT %s, %s, %s, %s, g.id, %s, CURRENT_TIMESTAMP
                        FROM grants g WHERE g."grantCode" = %s
                    """, (name, category, budgeted_amount or 0, remarks, item_id, grant_code or ''))
                    inserted_count += 1
            
            new_conn.commit()
            print(f"✅ 予算項目データ {inserted_count} 件を新規挿入しました")

def generate_month_schedules():
    """月チェック（budget_schedules）を生成"""
    print("📅 月チェックデータを生成中...")
    
    with connect_db('nagaiku_budget_v2_dev') as new_conn:
        with new_conn.cursor() as cur:
            # 既存のbudget_schedulesをクリア
            cur.execute('DELETE FROM budget_schedules')
            
            # 全助成金の期間情報を取得
            cur.execute("""
                SELECT id, name, "startDate", "endDate" 
                FROM grants 
                WHERE "startDate" IS NOT NULL AND "endDate" IS NOT NULL
            """)
            grants = cur.fetchall()
            
            total_schedules = 0
            for grant_id, grant_name, start_date, end_date in grants:
                # その助成金の全予算項目を取得
                cur.execute('SELECT id FROM budget_items WHERE "grantId" = %s', (grant_id,))
                budget_item_ids = [row[0] for row in cur.fetchall()]
                
                # 助成金期間の各月について7日以上含むかチェック
                current_month = start_date.replace(day=1)
                while current_month <= end_date:
                    # その月の最終日を計算
                    if current_month.month == 12:
                        next_month = current_month.replace(year=current_month.year + 1, month=1)
                    else:
                        next_month = current_month.replace(month=current_month.month + 1)
                    month_end = next_month - timedelta(days=1)
                    
                    # 助成金期間とその月の重複期間を計算
                    overlap_start = max(start_date, current_month)
                    overlap_end = min(end_date, month_end)
                    overlap_days = (overlap_end - overlap_start).days + 1
                    
                    # 7日以上重複する場合、その月にチェックを入れる
                    if overlap_days >= 7:
                        for budget_item_id in budget_item_ids:
                            cur.execute("""
                                INSERT INTO budget_schedules ("budgetItemId", year, month, "isActive", "updatedAt")
                                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                            """, (budget_item_id, current_month.year, current_month.month, True))
                            total_schedules += 1
                    
                    # 次の月へ
                    if current_month.month == 12:
                        current_month = current_month.replace(year=current_month.year + 1, month=1)
                    else:
                        current_month = current_month.replace(month=current_month.month + 1)
            
            new_conn.commit()
            print(f"✅ 月チェックデータ {total_schedules} 件を生成しました")

def verify_migration():
    """移行結果を検証"""
    print("📊 移行結果を検証中...")
    
    with connect_db('nagaiku_budget_v2_dev') as new_conn:
        with new_conn.cursor() as cur:
            # 各テーブルの件数確認
            cur.execute("""
                SELECT 'grants' as table_name, COUNT(*) as count FROM grants
                UNION ALL
                SELECT 'budget_items', COUNT(*) FROM budget_items
                UNION ALL
                SELECT 'budget_schedules', COUNT(*) FROM budget_schedules
            """)
            for table_name, count in cur.fetchall():
                print(f"  {table_name}: {count} 件")
            
            # 助成金別サマリー
            print("\n📋 助成金別サマリー:")
            cur.execute("""
                SELECT 
                    g.name,
                    g."grantCode",
                    COUNT(DISTINCT bi.id) as budget_items_count,
                    COUNT(DISTINCT bs.id) as schedule_months_count
                FROM grants g
                LEFT JOIN budget_items bi ON bi."grantId" = g.id
                LEFT JOIN budget_schedules bs ON bs."budgetItemId" = bi.id  
                GROUP BY g.id, g.name, g."grantCode"
                ORDER BY g.name
            """)
            for name, code, items, schedules in cur.fetchall():
                print(f"  {name} ({code}): 予算項目 {items}件, 月スケジュール {schedules}件")

if __name__ == '__main__':
    print("🚀 データ移行完了処理開始...")
    print("⚠️  現行システム（nagaiku_budget）は読み取り専用です")
    print("✅ 新システム（nagaiku_budget_v2_dev）のみに書き込みます")
    
    try:
        # 1. 残りの予算項目データ移行
        migrate_remaining_budget_items()
        
        # 2. 月チェック生成
        generate_month_schedules()
        
        # 3. 移行結果確認
        verify_migration()
        
        print("\n🎉 データ移行完了！")
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        sys.exit(1)