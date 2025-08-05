import { base } from '$app/paths';

/**
 * アプリケーション共通のルーティングヘルパー関数
 * basePath設定を考慮したURL生成を行う
 */

/**
 * basePath を含む完全なURLを生成
 * @param path - アプリケーション内のパス（例: '/freee/data'）
 * @returns basePath を含む完全なURL（例: '/budget2/freee/data'）
 */
export function createUrl(path: string): string {
  // パスが既にbaseで始まっている場合はそのまま返す
  if (path.startsWith(base)) {
    return path;
  }
  
  // 先頭のスラッシュを正規化
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * 現在のパスが指定されたパスとマッチするかチェック
 * @param currentPath - 現在のパス（通常は $page.url.pathname）
 * @param targetPath - 比較対象のパス（例: '/freee/data'）
 * @returns パスがマッチする場合はtrue
 */
export function isActivePath(currentPath: string, targetPath: string): boolean {
  const normalizedCurrent = currentPath.replace(base, '') || '/';
  const normalizedTarget = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return normalizedCurrent === normalizedTarget;
}

/**
 * 現在のパスからbasePath部分を除去
 * @param fullPath - 完全なパス（例: '/budget2/freee/data'）
 * @returns basePathを除いたパス（例: '/freee/data'）
 */
export function removeBasePath(fullPath: string): string {
  if (!fullPath.startsWith(base)) {
    return fullPath;
  }
  
  const withoutBase = fullPath.replace(base, '');
  return withoutBase || '/';
}

/**
 * 頻繁に使用される画面へのURLを定数として定義
 */
export const ROUTES = {
  DASHBOARD: '/',
  TRANSACTIONS: '/transactions',
  BUDGET_ITEMS: '/budget-items',
  ALLOCATIONS: '/allocations',
  GRANTS: '/grants',
  FREEE_DATA: '/freee/data',
  FREEE_SYNC: '/freee/sync',
  FREEE_AUTH: '/auth/freee',
  FREEE_AUTH_STATUS: '/auth/freee/status',
  FREEE_AUTH_CALLBACK: '/auth/freee/callback',
  // API エンドポイント
  API_FREEE_DATA: '/api/freee/data',
  API_FREEE_SYNC: '/api/freee/sync',
  API_GRANTS: '/api/grants'
} as const;

/**
 * ROUTESを使用してURLを生成する便利関数
 */
export const createRouteUrl = {
  dashboard: () => createUrl(ROUTES.DASHBOARD),
  transactions: () => createUrl(ROUTES.TRANSACTIONS),
  budgetItems: () => createUrl(ROUTES.BUDGET_ITEMS),
  allocations: () => createUrl(ROUTES.ALLOCATIONS),
  grants: () => createUrl(ROUTES.GRANTS),
  freeeData: () => createUrl(ROUTES.FREEE_DATA),
  freeeSync: () => createUrl(ROUTES.FREEE_SYNC),
  freeeAuth: () => createUrl(ROUTES.FREEE_AUTH),
  freeeAuthStatus: () => createUrl(ROUTES.FREEE_AUTH_STATUS),
  freeeAuthCallback: () => createUrl(ROUTES.FREEE_AUTH_CALLBACK),
  // API エンドポイント
  apiFreeeData: () => createUrl(ROUTES.API_FREEE_DATA),
  apiFreeeSync: () => createUrl(ROUTES.API_FREEE_SYNC),
  apiGrants: () => createUrl(ROUTES.API_GRANTS)
} as const;

/**
 * 開発時のデバッグ情報を生成
 */
export function getDebugInfo(currentPath: string) {
  return {
    currentPath,
    base,
    pathWithoutBase: removeBasePath(currentPath),
    isBaseMatch: currentPath.startsWith(base),
    availableRoutes: Object.entries(ROUTES).map(([key, path]) => ({
      name: key,
      path,
      fullUrl: createUrl(path),
      isActive: isActivePath(currentPath, path)
    }))
  };
}