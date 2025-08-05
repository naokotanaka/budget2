# SvelteKit ルーティング ガイドライン

## 概要

nagaiku-budget-v2プロジェクトにおけるURL問題の再発防止とルーティングの一貫性確保のためのガイドラインです。

## 基本原則

### 1. 常に`base`パスを考慮する

```typescript
// ❌ 悪い例：ハードコーディング
href="/budget2/freee/data"

// ✅ 良い例：baseパスを使用
import { base } from '$app/paths';
href={`${base}/freee/data`}

// ✅ より良い例：ヘルパー関数を使用
import { createRouteUrl } from '$lib/utils/routing';
href={createRouteUrl.freeeData()}
```

### 2. 統一されたルーティングヘルパーを使用する

プロジェクト全体で`/src/lib/utils/routing.ts`のヘルパー関数を使用してください：

```typescript
import { createRouteUrl, ROUTES, isActivePath } from '$lib/utils/routing';

// URL生成
const url = createRouteUrl.freeeData(); // "/budget2/freee/data"

// アクティブ状態の判定
const isActive = isActivePath($page.url.pathname, ROUTES.FREEE_DATA);
```

### 3. 新しいルートを追加する際の手順

1. **ルート定数の追加**
   ```typescript
   // src/lib/utils/routing.ts の ROUTES に追加
   export const ROUTES = {
     // ... 既存のルート
     NEW_FEATURE: '/new-feature'
   } as const;
   ```

2. **ヘルパー関数の追加**
   ```typescript
   // createRouteUrl に対応する関数を追加
   export const createRouteUrl = {
     // ... 既存の関数
     newFeature: () => createUrl(ROUTES.NEW_FEATURE)
   } as const;
   ```

3. **ナビゲーションに追加**
   ```svelte
   <!-- src/routes/+layout.svelte -->
   <a href={createRouteUrl.newFeature()}>
     新機能
   </a>
   ```

### 4. デバッグ機能の活用

開発環境では`DebugNavigation`コンポーネントが自動的に表示されます：

- 現在のパス情報
- ベースパス設定
- ルート状態
- 強制ナビゲーション機能

## 設定ファイルの管理

### svelte.config.js

```javascript
export default {
  kit: {
    adapter: adapter(),
    paths: {
      base: '/budget2'  // プロダクション環境のサブパス
    }
  }
};
```

### vite.config.ts

```typescript
export default defineConfig({
  // 開発サーバー設定
  server: {
    https: { /* SSL設定 */ },
    hmr: { /* HMR設定 */ }
  },
  // プロダクション最適化
  build: {
    rollupOptions: {
      output: {
        manualChunks: { /* チャンク最適化 */ }
      }
    }
  }
});
```

## トラブルシューティング

### よくある問題と解決方法

1. **404エラーが発生する**
   - ナビゲーションリンクが`base`パスを含んでいるか確認
   - ブラウザの開発者ツールでネットワークタブを確認
   - `DebugNavigation`でパス情報を確認

2. **アクティブ状態が正しく表示されない**
   - `isActivePath`関数を使用しているか確認
   - パス比較の条件を確認

3. **ルーティングの一貫性がない**
   - 全ての画面で`createRouteUrl`ヘルパーを使用
   - ハードコーディングされたパスを避ける

### デバッグ手順

1. **ブラウザ開発者ツール**
   ```javascript
   // コンソールで実行
   console.log('Current pathname:', window.location.pathname);
   console.log('SvelteKit page:', $page.url.pathname);
   ```

2. **SvelteKitのログ確認**
   - `app.html`のデバッグスクリプトが動作を記録
   - ナビゲーションイベントを監視

3. **サーバーサイドの確認**
   ```bash
   # ビルドしてエラーがないか確認
   npm run build
   
   # 実際のHTTPレスポンスを確認
   curl -I https://nagaiku.top/budget2/freee/data
   ```

## ベストプラクティス

### コード規約

1. **インポート順序**
   ```typescript
   // 1. Svelteのインポート
   import { page } from '$app/stores';
   import { base } from '$app/paths';
   
   // 2. プロジェクトのヘルパー
   import { createRouteUrl, ROUTES } from '$lib/utils/routing';
   
   // 3. コンポーネント
   import MyComponent from '$lib/components/MyComponent.svelte';
   ```

2. **ファイル構成**
   ```
   src/
   ├── lib/
   │   └── utils/
   │       └── routing.ts          # ルーティングヘルパー
   ├── routes/
   │   ├── +layout.svelte          # 共通ナビゲーション
   │   └── [feature]/
   │       ├── +page.svelte
   │       └── +page.server.ts
   ```

### パフォーマンス最適化

1. **プリロード設定**
   ```svelte
   <a href={createRouteUrl.transactions()} 
      data-sveltekit-preload-data="hover">
     取引一覧
   </a>
   ```

2. **チャンク分割**
   - `vite.config.ts`でライブラリ別にチャンク分割
   - 重要でない機能は遅延読み込み

## 環境別設定

### 開発環境
- `DebugNavigation`コンポーネントが表示される
- HMRによるリアルタイム更新
- HTTPS証明書による安全な開発

### プロダクション環境
- Nginxプロキシ経由での配信
- チャンク最適化によるパフォーマンス向上
- ベースパス設定による安全なデプロイ

## 更新履歴

- 2025-08-05: 初版作成
- URL問題の根本解決と予防策の確立
- ルーティングヘルパー関数の導入
- デバッグ機能の強化

## 関連ファイル

- `/src/lib/utils/routing.ts` - ルーティングヘルパー
- `/src/routes/+layout.svelte` - 共通ナビゲーション
- `/src/lib/components/DebugNavigation.svelte` - デバッグ機能
- `/svelte.config.js` - SvelteKit設定
- `/vite.config.ts` - Vite設定
- `/budget2-nginx.conf` - Nginxプロキシ設定