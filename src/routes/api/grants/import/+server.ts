import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import type { RequestHandler } from './$types';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

const dbPath = '/home/tanaka/projects/nagaiku-budget-v2/database.sqlite';

// データベースディレクトリの確認と作成
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// データベース接続（詳細ログ付き）
let db: Database.Database;
try {
  console.log('データベース接続を初期化:', dbPath);
  db = new Database(dbPath);
  console.log('データベース接続成功');
  
  // テーブル初期化
  db.exec(`
    CREATE TABLE IF NOT EXISTS grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grantCode TEXT UNIQUE,
      totalAmount INTEGER,
      startDate TEXT,
      endDate TEXT,
      status TEXT CHECK(status IN ('active', 'completed', 'applied')) DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Grantsテーブル初期化完了');
} catch (error) {
  console.error('データベース初期化エラー:', error);
  throw error;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const requestData = await request.json();
    console.log('受信したリクエストデータ:', JSON.stringify(requestData, null, 2));
    
    const { data } = requestData;
    console.log('抽出されたdata:', data);
    console.log('dataの型:', typeof data);
    console.log('dataは配列か:', Array.isArray(data));
    console.log('dataの長さ:', data?.length);
    
    if (!data) {
      console.log('データが存在しません');
      return json({ 
        success: false,
        error: 'データが存在しません',
        message: 'dataフィールドが必要です' 
      }, { status: 400 });
    }
    
    if (!Array.isArray(data)) {
      console.log('データが配列ではありません');
      return json({ 
        success: false,
        error: 'データが配列ではありません',
        message: 'dataは配列である必要があります' 
      }, { status: 400 });
    }
    
    if (data.length === 0) {
      console.log('データが空です');
      return json({ 
        success: false,
        error: 'データが空です',
        message: 'インポートするデータがありません' 
      }, { status: 400 });
    }
    
    let imported = 0;
    const errors: string[] = [];
    
    // データベーストランザクション開始
    const insertGrant = db.prepare(`
      INSERT INTO grants (name, grantCode, totalAmount, startDate, endDate, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const checkExisting = db.prepare('SELECT COUNT(*) as count FROM grants WHERE name = ? OR (grantCode IS NOT NULL AND grantCode = ?)');
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // 必須フィールドチェック
        if (!row.name || typeof row.name !== 'string' || row.name.trim() === '') {
          errors.push(`行 ${i + 1}: 助成金名が必要です`);
          continue;
        }
        
        const name = row.name.trim();
        const grantCode = row.grantCode && typeof row.grantCode === 'string' ? row.grantCode.trim() || null : null;
        
        // 重複チェック
        const existing = checkExisting.get(name, grantCode);
        if (existing && existing.count > 0) {
          errors.push(`行 ${i + 1}: 助成金「${name}」は既に存在します`);
          continue;
        }
        
        // 金額の変換
        let totalAmount = null;
        if (row.totalAmount) {
          const amount = parseInt(String(row.totalAmount).replace(/[^\d]/g, ''));
          if (!isNaN(amount)) {
            totalAmount = amount;
          }
        }
        
        // 日付の変換
        let startDate = null;
        let endDate = null;
        
        if (row.startDate && typeof row.startDate === 'string') {
          const date = new Date(row.startDate);
          if (!isNaN(date.getTime())) {
            startDate = row.startDate;
          }
        }
        
        if (row.endDate && typeof row.endDate === 'string') {
          const date = new Date(row.endDate);
          if (!isNaN(date.getTime())) {
            endDate = row.endDate;
          }
        }
        
        // ステータスの正規化
        let status = 'active';
        if (row.status && typeof row.status === 'string') {
          const statusMap: { [key: string]: string } = {
            '進行中': 'active',
            '終了': 'completed',
            '報告済み': 'applied',
            'active': 'active',
            'completed': 'completed',
            'applied': 'applied'
          };
          status = statusMap[row.status] || 'active';
        }
        
        // データ挿入
        insertGrant.run(name, grantCode, totalAmount, startDate, endDate, status);
        imported++;
        
      } catch (error) {
        errors.push(`行 ${i + 1}: ${error}`);
      }
    }
    
    return json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('助成金インポートエラー:', error);
    return json({ 
      error: 'インポート処理でエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};