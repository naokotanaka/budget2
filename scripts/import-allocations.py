#!/usr/bin/env python3
"""
nagaiku-budgetからnagaiku-budget-v2へ割当データを移行するスクリプト
"""
import psycopg2
from datetime import datetime
import sys

# データベース接続情報
SOURCE_DB = {
    'dbname': 'nagaiku_budget',
    'user': 'nagaiku_user',
    'password': 'nagaiku_password2024',
    'host': 'localhost'
}

TARGET_DB = {
    'dbname': 'nagaiku_budget_v2_prod',
    'user': 'nagaiku_user',
    'password': 'nagaiku_password2024',
    'host': 'localhost'
}

def main():
    # ソースDBに接続
    source_conn = psycopg2.connect(**SOURCE_DB)
    source_cur = source_conn.cursor()
    
    # ターゲットDBに接続
    target_conn = psycopg2.connect(**TARGET_DB)
    target_cur = target_conn.cursor()
    
    try:
        # 既存の割当データをバックアップ
        print("既存データをバックアップ中...")
        backup_table = f"allocation_splits_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        target_cur.execute(f"CREATE TABLE {backup_table} AS SELECT * FROM allocation_splits")
        target_conn.commit()
        print(f"バックアップテーブル作成: {backup_table}")
        
        # 既存の割当データをクリア
        print("既存の割当データをクリア中...")
        target_cur.execute("TRUNCATE TABLE allocation_splits CASCADE")
        target_conn.commit()
        
        # transaction_idからdetailIdへのマッピングを取得
        print("トランザクションマッピングを取得中...")
        
        # nagaiku-budgetのtransactionsテーブルから取得
        source_cur.execute("""
            SELECT 
                t.id as transaction_id,
                t.journal_number,
                t.journal_line_number,
                t.date,
                t.amount
            FROM transactions t
            WHERE t.id IS NOT NULL
        """)
        v1_transactions = {row[0]: row for row in source_cur.fetchall()}
        
        # nagaiku-budget-v2のtransactionsテーブルから対応を探す
        target_cur.execute("""
            SELECT 
                id,
                "journalNumber",
                date,
                amount,
                "detailId"
            FROM transactions
            WHERE "detailId" IS NOT NULL
        """)
        v2_transactions = {}
        for row in target_cur.fetchall():
            # journal_numberとdateとamountで照合
            v2_transactions[f"{row[1]}_{row[2]}_{row[3]}"] = row[4]  # detailId
        
        # allocationsデータを取得
        print("割当データを取得中...")
        source_cur.execute("""
            SELECT 
                a.id,
                a.transaction_id,
                a.budget_item_id,
                a.amount,
                a.created_at
            FROM allocations a
            WHERE a.transaction_id IS NOT NULL
                AND a.budget_item_id IS NOT NULL
        """)
        allocations = source_cur.fetchall()
        print(f"取得した割当数: {len(allocations)}")
        
        # 新しい割当データを挿入
        inserted_count = 0
        skipped_count = 0
        
        for allocation in allocations:
            alloc_id, trans_id, budget_item_id, amount, created_at = allocation
            
            # v1のトランザクション情報を取得
            if trans_id not in v1_transactions:
                skipped_count += 1
                continue
            
            v1_trans = v1_transactions[trans_id]
            journal_num = v1_trans[1]
            trans_date = v1_trans[3]
            trans_amount = v1_trans[4]
            
            # v2のdetailIdを探す
            lookup_key = f"{journal_num}_{trans_date}_{trans_amount}"
            if lookup_key not in v2_transactions:
                # 日付とamountだけで再検索
                for key, detail_id in v2_transactions.items():
                    if key.endswith(f"_{trans_date}_{trans_amount}"):
                        detail_id_found = detail_id
                        break
                else:
                    skipped_count += 1
                    continue
            else:
                detail_id_found = v2_transactions[lookup_key]
            
            # budget_itemの存在確認
            target_cur.execute("SELECT id FROM budget_items WHERE id = %s", (budget_item_id,))
            if not target_cur.fetchone():
                skipped_count += 1
                continue
            
            # 新しいIDを生成
            new_id = f"import_v1_{alloc_id}_{int(datetime.now().timestamp())}"
            
            # 挿入
            target_cur.execute("""
                INSERT INTO allocation_splits (
                    id, "budgetItemId", amount, note, "createdAt", "updatedAt", "detailId"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    "budgetItemId" = EXCLUDED."budgetItemId",
                    amount = EXCLUDED.amount,
                    note = EXCLUDED.note,
                    "updatedAt" = NOW()
            """, (
                new_id,
                budget_item_id,
                amount,
                f'旧システムから移行 (取引: {trans_id})',
                created_at or datetime.now(),
                created_at or datetime.now(),
                detail_id_found
            ))
            inserted_count += 1
        
        target_conn.commit()
        
        print(f"\n移行完了:")
        print(f"  - インポート成功: {inserted_count}件")
        print(f"  - スキップ: {skipped_count}件")
        
        # 結果を確認
        target_cur.execute("SELECT COUNT(*) FROM allocation_splits WHERE id LIKE 'import_v1_%'")
        count = target_cur.fetchone()[0]
        print(f"  - 現在の割当総数: {count}件")
        
        # budget_item別の集計
        target_cur.execute("""
            SELECT 
                bi.name,
                COUNT(*) as count,
                SUM(a.amount) as total
            FROM allocation_splits a
            JOIN budget_items bi ON bi.id = a."budgetItemId"
            GROUP BY bi.id, bi.name
            ORDER BY bi.name
        """)
        
        print("\n予算項目別集計:")
        for row in target_cur.fetchall():
            print(f"  - {row[0]}: {row[1]}件, 合計 {row[2]:,}円")
        
    except Exception as e:
        print(f"エラー: {e}")
        target_conn.rollback()
        sys.exit(1)
    finally:
        source_cur.close()
        source_conn.close()
        target_cur.close()
        target_conn.close()

if __name__ == '__main__':
    main()