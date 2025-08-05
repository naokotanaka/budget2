# freee連携ページ仕様書

## 概要

freeeから取得したデータを単純に表示するページの仕様です。フィルタリング機能は不要で、期間指定によるデータ取得と表形式での表示に特化します。

## 要件

### 必須機能
- 期間指定によるfreeeデータ取得
- 取得データの表形式表示
- freee接続状態の確認
- シンプルなUI
- **利用者認証不要**（誰でもアクセス可能）

### 除外機能
- データフィルタリング
- 複雑なエラーハンドリング
- データ編集機能
- 分割割当機能
- **利用者認証・アクセス制御**

## ページ仕様

### URL構成
- **メインページ**: `/freee/data`（利用者認証不要）
- **管理者設定**: `/auth/freee`（既存、管理者用freee接続設定）
- **データ取得API**: `/api/freee/data`

### ページ構成

```
┌─────────────────────────────────────┐
│ freee連携 - データ表示              │
├─────────────────────────────────────┤
│ [freee接続状態] [最終取得日時]       │
│                                     │
│ 期間指定:                           │
│ 開始日: [2024-01-01] 終了日: [今日]  │
│ 会社: [選択ドロップダウン]            │
│ [データ取得] ボタン                  │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ 取得結果: 123件                     │
│ ┌─────────────────────────────────┐ │
│ │ SVAR DataGrid テーブル          │ │
│ │ - 発生日                        │ │
│ │ - 取引先                        │ │
│ │ - 摘要                          │ │
│ │ - 勘定科目                      │ │
│ │ │ - 金額                        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 機能仕様

### 1. freee接続状態表示
- freee API接続の可否を表示
- 接続済み: 「freee接続済み ✓」（緑色）
- 未接続: 「freee未接続 - 管理者による設定が必要です」（オレンジ色）+ 設定案内

### 2. 期間指定機能
- **開始日**: date input（デフォルト: 30日前）
- **終了日**: date input（デフォルト: 今日）
- **会社選択**: select（freee接続後に取得した会社一覧）
- **取得ボタン**: 期間とフィールド入力後に有効化

### 3. データ表示テーブル

#### 表示列
| 列名 | 幅 | 表示内容 | ソート |
|------|-----|----------|--------|
| 発生日 | 120px | YYYY-MM-DD | ○ |
| 取引先 | 150px | partner_name | ○ |
| 摘要 | 200px | description | ○ |
| 勘定科目 | 120px | account_item_name | ○ |
| 金額 | 120px | ¥999,999 右揃え | ○ |
| freee ID | 80px | deal.id | × |

#### テーブル設定
- **ライブラリ**: SVAR DataGrid
- **ページング**: 50件/ページ
- **ソート**: 全列可能（デフォルト: 発生日降順）
- **高さ**: 400px固定

### 4. データ取得処理

#### API仕様
```typescript
POST /api/freee/data
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31", 
  "companyId": 123
}

Response:
{
  "success": true,
  "data": FreeeTransaction[],
  "count": 150,
  "message": "150件のデータを取得しました"
}
```

#### エラーレスポンス
```typescript
{
  "success": false,
  "error": "freee接続が必要です。管理者にお問い合わせください。",
  "needsSetup": true
}
```

## 技術仕様

### フロントエンド（Svelte）

#### ページコンポーネント: `/freee/data/+page.svelte`
```typescript
<script lang="ts">
  import { Grid } from "wx-svelte-grid";
  import { goto } from '$app/navigation';
  
  export let data;
  
  let startDate = getDefaultStartDate(); // 30日前
  let endDate = getDefaultEndDate();     // 今日
  let selectedCompanyId = data.companies[0]?.id || null;
  let transactions: FreeeTransaction[] = [];
  let loading = false;
  let errorMessage = '';
  
  // データ取得関数
  async function fetchData() {
    if (!data.isConnected) {
      errorMessage = 'freee接続が必要です。管理者にお問い合わせください。';
      return;
    }
    
    loading = true;
    try {
      const response = await fetch('/api/freee/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          companyId: selectedCompanyId
        })
      });
      
      const result = await response.json();
      if (result.success) {
        transactions = result.data;
      } else {
        errorMessage = result.error;
      }
    } catch (error) {
      errorMessage = 'データ取得中にエラーが発生しました';
    } finally {
      loading = false;
    }
  }
  
  // DataGrid設定
  const columns = [
    { id: "issue_date", header: "発生日", width: 120, sort: true },
    { id: "partner_name", header: "取引先", width: 150, sort: true },
    { id: "description", header: "摘要", width: 200, sort: true },
    { id: "account_item_name", header: "勘定科目", width: 120, sort: true },
    { 
      id: "amount", 
      header: "金額", 
      width: 120, 
      sort: true,
      align: "right",
      template: (value) => `¥${value.toLocaleString()}`
    },
    { id: "id", header: "freee ID", width: 80, sort: false }
  ];
</script>
```

#### サーバーロード: `/freee/data/+page.server.ts`
```typescript
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/database';
import { FreeeAPIClient } from '$lib/freee/client';

export const load: PageServerLoad = async () => {
  // freee接続状態チェック
  const tokenRecord = await prisma.freeeToken.findFirst();
  const isConnected = tokenRecord && new Date() < tokenRecord.expiresAt;
  
  let companies = [];
  if (isConnected) {
    try {
      const client = new FreeeAPIClient(getFreeeConfig());
      companies = await client.getCompanies(tokenRecord.accessToken);
    } catch (error) {
      console.warn('会社情報取得失敗:', error);
    }
  }
  
  return {
    isConnected,
    companies,
    lastSyncAt: tokenRecord?.updatedAt || null
  };
};
```

### バックエンド（API）

#### データ取得API: `/api/freee/data/+server.ts`
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { prisma } from '$lib/database';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { startDate, endDate, companyId } = await request.json();
    
    // バリデーション
    if (!startDate || !endDate || !companyId) {
      return json({ 
        success: false, 
        error: '開始日、終了日、会社IDは必須です' 
      }, { status: 400 });
    }
    
    // freee接続トークン取得
    const tokenRecord = await prisma.freeeToken.findFirst();
    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'freee接続が必要です。管理者にお問い合わせください。',
        needsSetup: true
      }, { status: 503 });
    }
    
    // freee API呼び出し
    const client = new FreeeAPIClient(getFreeeConfig());
    const deals = await client.getDeals(
      tokenRecord.accessToken,
      companyId,
      startDate,
      endDate,
      500 // 最大500件
    );
    
    // データ変換（表示用）
    const transformedData = deals.map(deal => ({
      id: deal.id,
      issue_date: deal.issue_date,
      partner_name: deal.partner_name || '－',
      description: deal.description || 
        `${deal.type === 'income' ? '収入' : '支出'} - ${deal.partner_name || '不明'}`,
      account_item_name: deal.details[0]?.account_item_name || '不明',
      amount: Math.abs(deal.amount)
    }));
    
    return json({
      success: true,
      data: transformedData,
      count: transformedData.length,
      message: `${transformedData.length}件のデータを取得しました`
    });
    
  } catch (error) {
    console.error('freeeデータ取得エラー:', error);
    return json({ 
      success: false, 
      error: 'データ取得中にエラーが発生しました' 
    }, { status: 500 });
  }
};
```

## UI設計

### デザイン要件
- **統一感**: 既存ページ（ダッシュボード）と同じデザイン
- **シンプル**: 余計な装飾は避ける
- **レスポンシブ**: モバイル対応不要（PC優先）

### コンポーネント設計
```
FreeeDataPage
├── ConnectionStatusCard（freee接続状態表示）
├── DateRangeForm（期間指定フォーム）
├── CompanySelector（会社選択）
├── FetchButton（取得ボタン）
└── DataGrid（データ表示テーブル）
```

### カラー設計
- **成功**: 緑色（bg-green-100, text-green-800）
- **警告**: オレンジ色（bg-orange-100, text-orange-800）
- **エラー**: 赤色（bg-red-100, text-red-800）
- **通常**: グレー（bg-gray-50, text-gray-900）

## ファイル構成

```
src/routes/freee/data/
├── +page.svelte          # メインページ
├── +page.server.ts       # サーバーロード
└── +layout.svelte        # レイアウト（オプション）

src/routes/api/freee/data/
└── +server.ts            # データ取得API

src/lib/components/freee/  # （必要に応じて）
├── ConnectionStatus.svelte # freee接続状態コンポーネント
├── DateRangeForm.svelte    # 期間指定フォーム
└── CompanySelector.svelte  # 会社選択
```

## 実装手順

### Phase 1: 基本ページ作成
1. `/freee/data` ルート作成（利用者認証不要）
2. freee接続状態チェック機能
3. 基本的なUI実装

### Phase 2: データ取得機能
1. API エンドポイント作成
2. freee API呼び出し
3. データ変換処理

### Phase 3: テーブル表示
1. SVAR DataGrid統合
2. 列設定・ソート機能
3. データバインディング

### Phase 4: 期間指定機能
1. 日付入力フォーム
2. 会社選択機能
3. データ取得ボタン

## テスト観点

### 機能テスト
- freee接続状態チェック
- 期間指定による取得
- データ表示の正確性
- エラーハンドリング
- 利用者認証不要の確認

### UI/UXテスト
- 表示レスポンス速度
- テーブルソート動作
- モバイル表示（簡易確認）

---

**作成日**: 2024年8月5日  
**バージョン**: 1.0  
**対象**: nagaiku-budget-v2プロジェクト