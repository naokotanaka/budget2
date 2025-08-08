/**
 * CSVファイル構造分析スクリプト
 * 混在データの分類問題を詳しく調査
 */

// 分析対象のサンプルデータ
const sampleCSV = `name,grantCode,totalAmount,startDate,endDate,status,category,budgetedAmount,note
科学研究費助成事業,240001,5000000,2024-04-01,2025-03-31,in_progress,,,
情報技術推進機構,240002,3000000,2024-05-01,2025-02-28,in_progress,,,
研究用消耗品,,,,,消耗品費,500000,実験用試薬・材料
旅費交通費,,,,,旅費,300000,学会発表・調査出張
人件費,,,,,賃金,1200000,研究補助者給与
備品購入費,,,,,備品費,800000,測定機器・PC等
通信運搬費,,,,,通信費,50000,インターネット・郵送料`;

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => 
        line.split(',').map(cell => cell.trim())
    );
    return { headers, rows };
}

function analyzeDataStructure() {
    console.log('=== CSV構造分析開始 ===\n');
    
    const { headers, rows } = parseCSV(sampleCSV);
    
    console.log('ヘッダー:', headers);
    console.log('行数:', rows.length);
    console.log();
    
    // 各行の詳細分析
    console.log('=== 各行の詳細分析 ===');
    rows.forEach((row, index) => {
        console.log(`\n行 ${index + 1}:`);
        headers.forEach((header, colIndex) => {
            const value = row[colIndex] || '';
            console.log(`  ${header}: "${value}"`);
        });
        
        // 現在のロジックによる分類テスト
        const confidence = getCurrentClassificationLogic(row, headers);
        console.log(`  分類信頼度 - 助成金: ${confidence.grant.toFixed(2)}, 予算項目: ${confidence.budgetItem.toFixed(2)}`);
        
        let classification = 'Unknown';
        if (confidence.grant > confidence.budgetItem && confidence.grant > 0.3) {
            classification = 'Grant';
        } else if (confidence.budgetItem > confidence.grant && confidence.budgetItem > 0.3) {
            classification = 'Budget Item';
        }
        console.log(`  結果: ${classification}`);
    });
    
    console.log('\n=== 問題点の分析 ===');
    analyzeProblemPoints(headers, rows);
    
    console.log('\n=== 改善案の提案 ===');
    suggestImprovements();
}

function getCurrentClassificationLogic(row, headers) {
    const grantKeywords = ['助成金', 'grant', '総額', 'totalAmount', '開始日', 'startDate', '終了日', 'endDate'];
    const budgetItemKeywords = ['項目', 'item', '予算額', 'budgetedAmount', 'カテゴリ', 'category', '備考', 'note'];
    
    let grantScore = 0;
    let budgetItemScore = 0;

    headers.forEach((header, index) => {
        const value = row[index] || '';
        if (!value) return;

        const headerLower = header.toLowerCase();
        
        // 助成金スコア
        if (grantKeywords.some(keyword => 
            headerLower.includes(keyword.toLowerCase()) || header.includes(keyword)
        )) {
            grantScore += 0.3;
            
            if (header.includes('総額') || header.includes('金額')) {
                const amount = parseInt(value.replace(/[,¥]/g, ''));
                if (!isNaN(amount) && amount > 100000) {
                    grantScore += 0.4;
                }
            }
        }
        
        // 予算項目スコア
        if (budgetItemKeywords.some(keyword => 
            headerLower.includes(keyword.toLowerCase()) || header.includes(keyword)
        )) {
            budgetItemScore += 0.3;
            
            if (header.includes('カテゴリ') && 
                ['消耗', '賃金', '旅費', '通信', '委託', '備品'].some(cat => value.includes(cat))) {
                budgetItemScore += 0.4;
            }
        }
    });

    // データ内容ベースのスコア
    const dataText = row.join(' ').toLowerCase();
    
    // 助成金らしいパターン
    if (/^\d{6}_/.test(dataText)) {
        grantScore += 0.2;
    }
    if (dataText.includes('active') || dataText.includes('completed') || dataText.includes('進行中')) {
        grantScore += 0.3;
    }
    
    // 予算項目らしいパターン
    if (['消耗品', '人件費', '旅費交通費', '通信運搬費'].some(cat => dataText.includes(cat))) {
        budgetItemScore += 0.4;
    }

    return {
        grant: Math.min(grantScore, 1.0),
        budgetItem: Math.min(budgetItemScore, 1.0)
    };
}

function analyzeProblemPoints(headers, rows) {
    console.log('1. ヘッダーベースの問題:');
    console.log('   - すべての行が同じヘッダーを使用している');
    console.log('   - 助成金用フィールド（grantCode, startDate等）と');
    console.log('     予算項目用フィールド（category, note等）が混在');
    console.log('   - 空値による判定の困難さ');
    
    console.log('\n2. データパターンの問題:');
    rows.forEach((row, index) => {
        const filledFields = row.filter(field => field && field.trim()).length;
        console.log(`   行${index + 1}: ${filledFields}個のフィールドに値`);
        
        // 助成金らしいフィールド
        const grantFields = [row[1], row[2], row[3], row[4], row[5]].filter(f => f && f.trim()).length; // grantCode, totalAmount, startDate, endDate, status
        const budgetFields = [row[6], row[7], row[8]].filter(f => f && f.trim()).length; // category, budgetedAmount, note
        
        console.log(`     助成金フィールド: ${grantFields}/5, 予算項目フィールド: ${budgetFields}/3`);
    });
    
    console.log('\n3. 現在のロジックの限界:');
    console.log('   - ヒューリスティック（経験則）に依存');
    console.log('   - 閾値（0.3）が適切でない場合がある');
    console.log('   - 複雑すぎて保守が困難');
}

function suggestImprovements() {
    console.log('オプション1: シンプルなフィールド存在チェック');
    console.log('   - 助成金: grantCodeまたはstartDate/endDateに値があるか');
    console.log('   - 予算項目: categoryまたはnoteに値があるか');
    
    console.log('\nオプション2: CSVファイル分離');
    console.log('   - grants.csv と budget_items.csv を別々に用意');
    console.log('   - シンプルで確実な処理が可能');
    
    console.log('\nオプション3: セクション形式の復活');
    console.log('   - [助成金データ] と [予算項目データ] のセクション区切り');
    console.log('   - 既存のlegacy-csv-parserを活用');
    
    console.log('\nオプション4: UIでの明示的な選択');
    console.log('   - ユーザーが「助成金」「予算項目」を明示的に選択');
    console.log('   - 混在ファイルではなく、単一データタイプのCSVのみ許可');
    
    console.log('\n推奨: オプション2（ファイル分離）またはオプション4（明示的選択）');
    console.log('理由: シンプルで確実、保守しやすい');
}

// 改善されたシンプルな分類ロジックのテスト
function testSimpleClassification(row, headers) {
    // オプション1の実装例
    const hasGrantCode = headers.includes('grantCode') && row[headers.indexOf('grantCode')] && row[headers.indexOf('grantCode')].trim();
    const hasStartDate = headers.includes('startDate') && row[headers.indexOf('startDate')] && row[headers.indexOf('startDate')].trim();
    const hasEndDate = headers.includes('endDate') && row[headers.indexOf('endDate')] && row[headers.indexOf('endDate')].trim();
    const hasCategory = headers.includes('category') && row[headers.indexOf('category')] && row[headers.indexOf('category')].trim();
    const hasNote = headers.includes('note') && row[headers.indexOf('note')] && row[headers.indexOf('note')].trim();
    
    const isGrant = hasGrantCode || (hasStartDate && hasEndDate);
    const isBudgetItem = hasCategory || hasNote;
    
    if (isGrant && !isBudgetItem) return 'Grant';
    if (isBudgetItem && !isGrant) return 'Budget Item';
    return 'Ambiguous';
}

console.log('\n=== 改善されたシンプル分類のテスト ===');
const { headers, rows } = parseCSV(sampleCSV);
rows.forEach((row, index) => {
    const result = testSimpleClassification(row, headers);
    console.log(`行 ${index + 1}: ${result}`);
});

// 分析開始
analyzeDataStructure();