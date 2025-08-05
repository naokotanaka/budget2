/**
 * システム共通の色分けルール
 * 期間と残額の状況を視覚的に表現
 */

/**
 * 期間の色分け判定
 * @param endDate - 終了日（ISO文字列 or Date）
 * @returns Tailwind CSSクラス
 */
export function getPeriodColor(endDate?: string | Date): string {
  if (!endDate) return 'text-gray-600';
  
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  
  if (diffWeeks <= 4) {
    return 'text-red-600'; // 残り4週間以下（緊急）
  }
  return 'text-gray-600'; // 通常
}

/**
 * 残額の色分け判定
 * @param totalAmount - 総額
 * @param usedAmount - 使用済み額
 * @param endDate - 終了日（ISO文字列 or Date）
 * @returns Tailwind CSSクラス
 */
export function getAmountColor(
  totalAmount?: number, 
  usedAmount?: number, 
  endDate?: string | Date
): string {
  if (!totalAmount || usedAmount === undefined) return 'text-gray-600';
  
  const remaining = totalAmount - usedAmount;
  
  // 残額が0以下の場合はグレー
  if (remaining <= 0) {
    return 'text-gray-500';
  }
  
  // 期間による判定
  if (endDate) {
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    
    if (diffWeeks <= 4 && remaining > 0) {
      return 'text-red-600'; // 残り4週間で残額あり（緊急）
    } else if (diffWeeks <= 8 && remaining > 0) {
      return 'text-blue-600'; // 残り8週間で残額あり（注意）
    }
  }
  
  return 'text-green-600'; // それ以外（正常状態）
}

/**
 * 予算執行率による色分け判定
 * @param usedAmount - 使用済み額
 * @param totalAmount - 総額
 * @param endDate - 終了日（ISO文字列 or Date）
 * @returns Tailwind CSSクラス
 */
export function getUsageRateColor(
  usedAmount?: number,
  totalAmount?: number,
  endDate?: string | Date
): string {
  if (!totalAmount || usedAmount === undefined) return 'text-gray-600';
  
  const usageRate = (usedAmount / totalAmount) * 100;
  
  // 期間考慮
  if (endDate) {
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    
    // 終了間近での高使用率は警告
    if (diffWeeks <= 4 && usageRate >= 80) {
      return 'text-red-600'; // 緊急
    } else if (diffWeeks <= 8 && usageRate >= 70) {
      return 'text-blue-600'; // 注意
    }
  }
  
  // 一般的な使用率による判定
  if (usageRate >= 90) {
    return 'text-red-600'; // 危険
  } else if (usageRate >= 70) {
    return 'text-yellow-600'; // 警告
  }
  
  return 'text-green-600'; // 正常
}

/**
 * 色分けルールの説明
 */
export const COLOR_RULES = {
  period: {
    red: '残り4週間以下（緊急対応必要）',
    gray: '通常状態'
  },
  amount: {
    gray: '残額なし・予算超過',
    red: '残り4週間で残額あり（早急な執行必要）',
    blue: '残り8週間で残額あり（計画的執行必要）',
    green: '正常状態'
  },
  usage: {
    red: '使用率90%以上または終了間近での高使用',
    yellow: '使用率70%以上',
    blue: '終了間近での中程度使用',
    green: '正常な使用率'
  }
} as const;