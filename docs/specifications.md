# nagaiku-budget-v2 システム仕様書

## 概要

**nagaiku-budget-v2**は、NPO法人ながいくの予算管理システムの改良版です。既存システムの機能を継承しつつ、**1対多予算項目割当機能**を新たに追加し、Tsumiki（SvelteKit）技術スタックで再構築します。

## プロジェクト情報

| 項目 | 内容 |
|------|------|
| **プロジェクト名** | nagaiku-budget-v2 |
| **技術スタック** | SvelteKit + TypeScript + Prisma + PostgreSQL |
| **テーブルライブラリ** | SVAR Svelte DataGrid |
| **開発環境** | HTTPS対応、tmux管理 |
| **本番環境** | systemctl管理 |
| **アクセスURL** | https://nagaiku.top/budget2 |
| **開発URL** | https://localhost:3002 |

## 主要な改良点

### 🆕 新機能
1. **1対多予算項目割当**
   - 1つの取引を複数の予算項目に分割割当
   - 金額・割合指定による按分機能
   - 家賃・光熱費等の複数助成金への按分に対応

2. **モダンUI/UX**
   - SVAR Svelte DataGridによる高性能テーブル
   - 会計向け数値フォーマット（右揃え、カンマ区切り）
   - レスポンシブデザイン

### 🔄 継承機能
- freee API連携（OAuth2認証）
- CSV取込（【事】【管】勘定科目フィルタリング）
- 助成金・予算項目管理
- クロス集計レポート
- データ同期・重複チェック

## システム構成

### アーキテクチャ
```
┌─────────────────────────────────────────────────────────────┐
│                     フロントエンド                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐   │
│  │   SvelteKit     │  │ SVAR DataGrid   │  │ Tailwind CSS│   │
│  │   TypeScript    │  │ (テーブル表示)   │  │  (スタイル)  │   │
│  └─────────────────┘  └─────────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                     バックエンド                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐   │
│  │   SvelteKit     │  │     Prisma      │  │    Zod      │   │
│  │   サーバーAPI    │  │    (ORM)       │  │  (検証)      │   │
│  └─────────────────┘  └─────────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   データベース                                │
│               PostgreSQL                                    │
│         (開発: nagaiku_budget_v2_dev)                        │
│         (本番: nagaiku_budget_v2_prod)                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   外部API                                    │
│                 freee API                                   │
│            (OAuth2認証・取引データ取得)                        │
└─────────────────────────────────────────────────────────────┘
```

### ネットワーク構成
```
Internet → Nginx → HTTPS Proxy → SvelteKit App (Port 3002)
                     ↓
              PostgreSQL Database
```

## データベース設計

### 主要エンティティ

#### 1. Transactions（取引）
既存の取引データを格納。freee APIまたはCSVから取得。

```typescript
model Transaction {
  id                   String      @id
  journalNumber        Int
  journalLineNumber    Int
  date                 DateTime
  description          String?
  amount               Int         // 金額（円単位）
  account              String?     // 勘定科目
  supplier             String?
  item                 String?
  memo                 String?
  remark               String?
  department           String?
  managementNumber     String?
  freeDealId           Int?
  createdAt            DateTime    @default(now())
  
  // 関係
  allocations          AllocationSplit[]
  
  @@map("transactions")
}
```

#### 2. Grants（助成金）
助成金情報を管理。

```typescript
model Grant {
  id           Int         @id @default(autoincrement())
  name         String      // 助成金名
  grantCode    String?     // 助成金コード
  totalAmount  Int?        // 総額
  startDate    DateTime?   // 開始日
  endDate      DateTime?   // 終了日
  status       String      @default("active")
  createdAt    DateTime    @default(now())
  
  // 関係
  budgetItems  BudgetItem[]
  
  @@map("grants")
}
```

#### 3. BudgetItems（予算項目）
各助成金に紐づく予算項目。

```typescript
model BudgetItem {
  id              Int       @id @default(autoincrement())
  name            String    // 予算項目名
  category        String?   // カテゴリ
  budgetedAmount  Int?      // 予算額
  grantId         Int       // 助成金ID
  createdAt       DateTime  @default(now())
  
  // 関係
  grant           Grant     @relation(fields: [grantId], references: [id])
  allocations     AllocationSplit[]
  
  @@map("budget_items")
}
```

#### 4. AllocationSplit（分割割当）⭐ **新機能**
1つの取引を複数の予算項目に分割割当。

```typescript
model AllocationSplit {
  id             String      @id @default(cuid())
  transactionId  String      // 取引ID
  budgetItemId   Int         // 予算項目ID
  amount         Int         // 分割金額
  percentage     Float?      // 割合（オプション）
  note           String?     // 分割理由・備考
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  
  // 関係
  transaction    Transaction @relation(fields: [transactionId], references: [id])
  budgetItem     BudgetItem  @relation(fields: [budgetItemId], references: [id])
  
  @@map("allocation_splits")
}
```

#### 5. FreeeTokens（freee認証）
freee API認証情報。

```typescript
model FreeeToken {
  id           Int       @id @default(autoincrement())
  accessToken  String    @db.Text
  refreshToken String    @db.Text
  expiresAt    DateTime
  tokenType    String    @default("Bearer")
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  @@map("freee_tokens")
}
```

## 機能仕様

### 1. 取引管理機能

#### 1.1 取引一覧表示
- **画面**: `/transactions`
- **機能**: 
  - SVAR DataGridによる高性能テーブル表示
  - 数値の右揃え・カンマ区切りフォーマット
  - ソート・フィルター機能
  - ページネーション対応

#### 1.2 予算項目割当（新機能）
- **機能**: 1対多分割割当
- **操作方法**:
  1. **簡易割当**: ドロップダウンで単一予算項目選択
  2. **分割割当**: モーダルで複数予算項目に金額・割合指定
- **割当例**:
  ```
  取引: 家賃 120,000円
  ↓ 分割割当
  ・助成金A「管理費」: 72,000円 (60%)
  ・助成金B「事業費」: 48,000円 (40%)
  ```

### 2. freee API連携機能

#### 2.1 OAuth2認証
- **エンドポイント**: `/freee/auth`
- **リダイレクトURI**: `https://nagaiku.top/budget2/freee/callback`
- **機能**: 
  - freee認証フロー
  - トークン自動更新
  - 認証状態管理

#### 2.2 取引データ同期
- **機能**: 
  - 【事】【管】勘定科目フィルタリング
  - 増分同期・重複チェック
  - 仕訳番号・行番号による重複判定

### 3. CSV取込機能

#### 3.1 ファイルアップロード
- **対象**: freeeエクスポートCSV
- **フィルタリング**: 【事】【管】勘定科目のみ取込
- **検証**: データ形式・重複チェック

### 4. レポート機能

#### 4.1 クロス集計レポート
- **表示**: 予算項目 × 月のクロス集計
- **データ**: 分割割当後の金額で集計
- **エクスポート**: CSV形式でダウンロード

### 5. 助成金・予算項目管理

#### 5.1 助成金管理
- **CRUD操作**: 助成金の作成・編集・削除
- **予算項目管理**: 各助成金に紐づく予算項目設定

## UI/UX設計

### デザインシステム
- **フレームワーク**: Tailwind CSS
- **カラーパレット**: 既存システムとの統一感
- **レスポンシブ**: モバイル・タブレット対応

### 主要画面

#### 1. ダッシュボード (`/`)
- 概要統計表示
- 未割当取引数
- 月次サマリー

#### 2. 取引一覧 (`/transactions`)
- SVAR DataGridテーブル
- フィルター・ソート機能
- 予算項目割当UI

#### 3. 分割割当モーダル
- 複数予算項目選択
- 金額・割合入力
- リアルタイム合計計算

#### 4. 助成金管理 (`/grants`)
- 助成金CRUD
- 予算項目管理

#### 5. レポート (`/reports`)
- クロス集計表
- グラフ表示
- エクスポート機能

## セキュリティ仕様

### 認証・認可
- **freee OAuth2**: API認証
- **セッション管理**: サーバーサイドセッション
- **CSRF対策**: SvelteKitビルトイン保護

### データ保護
- **HTTPS通信**: 開発・本番環境とも
- **環境変数**: 機密情報の適切な管理
- **入力検証**: Zodスキーマによる検証

### アクセス制御
- **環境分離**: 開発・本番データベース分離
- **ファイアウォール**: 必要ポートのみ開放

## 開発・運用仕様

### 開発環境
- **管理**: tmux
- **URL**: https://localhost:3002
- **データベース**: nagaiku_budget_v2_dev
- **証明書**: 自己署名SSL証明書

### 本番環境
- **管理**: systemctl
- **URL**: https://nagaiku.top/budget2
- **データベース**: nagaiku_budget_v2_prod
- **プロキシ**: Nginx HTTPS

### デプロイフロー
1. **開発**: tmuxでローカル開発
2. **ビルド**: `npm run build`
3. **本番起動**: `systemctl start nagaiku-budget-v2`

### バックアップ・監視
- **データベースバックアップ**: 既存運用に準拠
- **ログ監視**: systemdログ
- **エラー通知**: 既存システムと統合

## 技術制約・前提条件

### システム要件
- **Node.js**: 18+
- **PostgreSQL**: 13+
- **メモリ**: 最小1GB
- **ストレージ**: 最小10GB

### 外部依存
- **freee API**: 取引データ取得
- **Nginx**: リバースプロキシ
- **SSL証明書**: HTTPS通信

### ブラウザ対応
- **Chrome/Edge**: 最新2バージョン
- **Firefox**: 最新2バージョン
- **Safari**: 最新2バージョン

## 移行計画

### Phase 1: 基盤構築 ✅
- [x] プロジェクト初期化
- [x] 開発環境構築
- [x] HTTPS設定
- [x] Nginx設定

### Phase 2: データベース設計
- [ ] Prismaスキーマ実装
- [ ] マイグレーション作成
- [ ] シードデータ作成

### Phase 3: 基本機能実装
- [ ] 取引CRUD API
- [ ] 助成金・予算項目管理
- [ ] 基本UI実装

### Phase 4: 分割割当機能
- [ ] AllocationSplitモデル実装
- [ ] 分割割当UI
- [ ] 計算ロジック

### Phase 5: 外部連携
- [ ] freee API連携
- [ ] CSV取込機能
- [ ] データ同期

### Phase 6: レポート・仕上げ
- [ ] クロス集計レポート
- [ ] エクスポート機能
- [ ] 最終テスト

## 品質保証

### テスト戦略
- **単体テスト**: Vitest
- **統合テスト**: Prismaクエリテスト
- **E2Eテスト**: Playwright（オプション）

### コード品質
- **TypeScript**: 型安全性
- **ESLint**: コード規約
- **Prettier**: フォーマット

### パフォーマンス
- **SVAR DataGrid**: 大量データ対応
- **仮想スクロール**: 高速レンダリング
- **データベース最適化**: インデックス最適化

---

## 付録

### 用語集
- **分割割当**: 1つの取引を複数の予算項目に金額を分けて割り当てること
- **按分**: 一定の基準に従って比例配分すること
- **【事】【管】**: freee勘定科目の接頭語（事業費・管理費）

### 関連ドキュメント
- [既存システム仕様](../nagaiku-budget/README.md)
- [freee API仕様](https://developer.freee.co.jp/)
- [SVAR DataGrid仕様](https://svar.dev/svelte/datagrid/)

---

**作成日**: 2024年8月4日  
**バージョン**: v1.0  
**作成者**: Claude Code