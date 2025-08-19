import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import type { RequestHandler } from './$types';

const db = new Database('/home/tanaka/projects/nagaiku-budget-v2/database.sqlite');

// テーブル初期化
db.exec(`
  CREATE TABLE IF NOT EXISTS budget_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    budgetedAmount INTEGER,
    usedAmount INTEGER DEFAULT 0,
    note TEXT,
    grantId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grantId) REFERENCES grants (id) ON DELETE SET NULL
  )
`);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { data } = await request.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return json({ 
        success: false,
        error: 'データが無効です',
        message: 'インポートするデータがありません' 
      }, { status: 400 });
    }
    
    let imported = 0;
    const errors: string[] = [];
    
    // データベース準備文
    const insertBudgetItem = db.prepare(`
      INSERT INTO budget_items (name, category, budgetedAmount, usedAmount, note, grantId)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const findGrantByName = db.prepare('SELECT id FROM grants WHERE name = ?');
    const checkExisting = db.prepare('SELECT COUNT(*) as count FROM budget_items WHERE name = ? AND grantId = ?');
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // 必須フィールドチェック
        if (!row.name || typeof row.name !== 'string' || row.name.trim() === '') {
          errors.push(`行 ${i + 1}: 項目名が必要です`);
          continue;
        }
        
        const name = row.name.trim();
        const category = row.category && typeof row.category === 'string' ? row.category.trim() : null;
        const note = row.note && typeof row.note === 'string' ? row.note.trim() : null;
        
        // 助成金の検索
        let grantId = null;
        if (row.grantName && typeof row.grantName === 'string') {
          const grant = findGrantByName.get(row.grantName.trim());
          if (grant) {
            grantId = grant.id;
          } else {
            errors.push(`行 ${i + 1}: 助成金「${row.grantName}」が見つかりません`);
            continue;
          }
        }
        
        // 重複チェック（同じ助成金内での項目名重複）
        if (grantId) {
          const existing = checkExisting.get(name, grantId);
          if (existing && existing.count > 0) {
            errors.push(`行 ${i + 1}: 項目「${name}」は既に存在します`);
            continue;
          }
        }
        
        // 金額の変換
        let budgetedAmount = null;
        if (row.budgetedAmount) {
          const amount = parseInt(String(row.budgetedAmount).replace(/[^\d]/g, ''));
          if (!isNaN(amount)) {
            budgetedAmount = amount;
          }
        }
        
        let usedAmount = 0;
        if (row.usedAmount) {
          const amount = parseInt(String(row.usedAmount).replace(/[^\d]/g, ''));
          if (!isNaN(amount)) {
            usedAmount = amount;
          }
        }
        
        // データ挿入
        insertBudgetItem.run(name, category, budgetedAmount, usedAmount, note, grantId);
        imported++;
        
      } catch (error: any) {
        errors.push(`行 ${i + 1}: ${error}`);
      }
    }
    
    return json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error: any) {
    console.error('予算項目インポートエラー:', error);
    return json({ 
      error: 'インポート処理でエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};