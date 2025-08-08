# レガシーCSVインポーター

nagaiku-budgetの従来システムから新システムへのデータ移行用CSVインポーター

## 概要

従来のnagaiku-budgetシステムで使用していた特殊なCSV形式を解析し、新しいnagaiku-budget-v2システムにインポートするための機能群です。

## CSVファイル形式

従来システムのCSVは以下の3つのセクションから構成されます：

```csv
[助成金データ]
ID,名称,総額,開始日,終了日,ステータス
1,WAM,,2025-03-04,2025-07-24,active
2,Test Grant,100000,2025-01-01,2025-12-31,active

[予算項目データ]
ID,助成金ID,名称,カテゴリ,予算額
1,1,人件費,人件費,100000
2,1,消耗品費,事業費,50000

[割当データ]
ID,取引ID,予算項目ID,金額
1,5041103_1,1,3200
2,5040903_1,2,7436
```

## 主要機能

### 1. セクション形式CSVパーサー (`LegacyCSVParser`)

- `[助成金データ]`, `[予算項目データ]`, `[割当データ]` セクションを識別
- 各セクションの構造を検証
- エラー箇所の詳細な報告

### 2. データ変換機能 (`LegacyCSVConverter`)

- レガシーフィールド名から新システムフィールド名へのマッピング
- データ型の自動変換（文字列→数値、日付など）
- ステータス値の正規化
- データ関係性の保持

### 3. 整合性検証 (`LegacyCSVValidator`)

- データ品質の検証
- 関係性チェック（助成金-予算項目、予算項目-割当の整合性）
- 業務ルールの検証（予算額の合計チェックなど）

### 4. エンコーディング検出 (`EncodingDetector`)

- 自動エンコーディング検出（UTF-8, Shift_JIS, EUC-JP）
- BOM処理
- 日本語文字の信頼度判定

### 5. 統合インポーター (`LegacyCSVImporter`)

- 全機能を統合したメインクラス
- 進行状況報告
- バッチ処理
- ドライラン機能

## 使用方法

### 基本的な使用例

```typescript
import { LegacyCSVImporter } from '$lib/utils/legacy-csv-importer';

const importer = new LegacyCSVImporter({
  encoding: 'auto',
  validateRelationships: true,
  dryRun: false,
  progressCallback: (progress) => {
    console.log(`${progress.stage}: ${progress.percentage}%`);
  }
});

// ファイルからインポート
const result = await importer.importLegacyCSV(file);

if (result.success) {
  console.log(result.message);
  console.log(`インポート件数:`, result.imported);
} else {
  console.error('インポートエラー:', result.errors);
}
```

### ドライラン（検証のみ）

```typescript
const importer = new LegacyCSVImporter({
  dryRun: true,
  validateRelationships: true
});

const result = await importer.importLegacyCSV(file);
console.log('変換可能なデータ:', result.conversion.stats);
```

### 個別機能の使用

```typescript
import { LegacyCSVParser } from '$lib/utils/legacy-csv-parser';
import { LegacyCSVConverter } from '$lib/utils/legacy-csv-converter';

// パースのみ
const parser = new LegacyCSVParser();
const legacyData = await parser.parseCSV(csvContent);

// 変換のみ
const converter = new LegacyCSVConverter({
  skipInvalidDates: true,
  defaultGrantStatus: 'in_progress'
});
const conversion = converter.convertLegacyData(legacyData);
```

## 設定オプション

```typescript
interface LegacyImportConfig {
  // データ変換設定
  skipInvalidDates?: boolean;          // 不正な日付をスキップ
  defaultGrantStatus?: string;         // デフォルト助成金ステータス
  preserveLegacyIds?: boolean;         // レガシーID保持
  validateRelationships?: boolean;     // 関係性検証

  // エンコーディング設定
  encoding?: 'auto' | 'utf-8' | 'shift_jis' | 'euc-jp';

  // インポート設定
  dryRun?: boolean;                   // ドライラン
  batchSize?: number;                 // バッチサイズ
  progressCallback?: (progress) => void;  // 進行状況コールバック
}
```

## エラーハンドリング

```typescript
const result = await importer.importLegacyCSV(file);

// エラー詳細
if (!result.success) {
  result.errors.forEach(error => {
    console.error('エラー:', error);
  });
  
  result.warnings.forEach(warning => {
    console.warn('警告:', warning);
  });
}

// 検証結果詳細
const validation = result.validation;
if (!validation.isValid) {
  validation.errors.forEach(error => {
    console.error(`[${error.section}:${error.line}] ${error.message}`);
  });
}
```

## データマッピング

### 助成金データ
- `ID` → `legacyId` (保持用)
- `名称` → `name`
- `総額` → `totalAmount`
- `開始日` → `startDate`
- `終了日` → `endDate`
- `ステータス` → `status` (active→in_progress, completed→completed)

### 予算項目データ
- `ID` → `legacyId` (保持用)
- `助成金ID` → `grantId` (関係性解決)
- `名称` → `name`
- `カテゴリ` → `category`
- `予算額` → `budgetedAmount`

### 割当データ
- `ID` → `legacyId` (保持用)
- `取引ID` → `transactionId`
- `予算項目ID` → `budgetItemId` (関係性解決)
- `金額` → `amount`

## 注意事項

1. **エンコーディング**: 自動検出ですが、ヒントとして明示的に指定することを推奨
2. **関係性**: 助成金→予算項目→割当の順序でインポートされます
3. **バックアップ**: インポート前に必ずデータベースのバックアップを取得してください
4. **メタデータテーブル**: レガシーID保持のため、メタデータテーブルが必要です

## API エンドポイント

- `POST /api/grants/legacy-import` - 助成金データインポート
- `POST /api/budget-items/legacy-import` - 予算項目データインポート  
- `POST /api/allocations/legacy-import` - 割当データインポート

## サンプルCSVの生成

```typescript
import { LegacyCSVImporter } from '$lib/utils/legacy-csv-importer';

const sampleCSV = LegacyCSVImporter.generateSampleCSV();
console.log(sampleCSV);
```

## トラブルシューティング

### よくあるエラー

1. **エンコーディングエラー**
   ```
   エンコーディング検出に失敗
   → hintEncodingを明示的に指定
   ```

2. **関係性エラー**
   ```
   参照される助成金が存在しません
   → 助成金データが先にインポートされているか確認
   ```

3. **データ形式エラー**
   ```
   金額の形式が不正です
   → CSVの数値フォーマットを確認
   ```

## ファイル構成

```
src/lib/utils/
├── legacy-csv-parser.ts      # セクション形式CSVパーサー
├── legacy-csv-converter.ts   # データ変換機能
├── legacy-csv-validator.ts   # 整合性検証
├── encoding-detector.ts      # エンコーディング検出
├── legacy-csv-importer.ts    # 統合インポーター
└── legacy-csv-README.md      # このファイル

src/lib/types/
└── legacy-csv.ts             # 型定義

src/routes/api/
├── grants/legacy-import/+server.ts
├── budget-items/legacy-import/+server.ts
└── allocations/legacy-import/+server.ts
```