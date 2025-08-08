/**
 * 助成期間から月を抽出するユーティリティ関数
 */

interface Grant {
  startDate?: string;
  endDate?: string;
}

export interface MonthInfo {
  year: number;
  month: number;
  label: string;
  key: string; // YYYY-MM形式
  displayName: string; // 表示用の短縮名
  fiscalYear: number; // 年度
  quarter: number; // 四半期 (1-4)
  fiscalQuarter: number; // 年度内の四半期 (1-4)
  isStartOfQuarter: boolean; // 四半期の開始月かどうか
  isEndOfQuarter: boolean; // 四半期の終了月かどうか
  isStartOfFiscalYear: boolean; // 年度の開始月かどうか
  isEndOfFiscalYear: boolean; // 年度の終了月かどうか
}

/**
 * 全助成金から統合期間（最小開始日〜最大終了日）を取得し、
 * その期間の全ての月を抽出する
 */
export function extractMonthsFromAllGrants(grants: Grant[]): MonthInfo[] {
  // 有効な日付を持つ助成金のみフィルター
  const validGrants = grants.filter(grant => 
    grant.startDate && grant.endDate
  );

  if (validGrants.length === 0) {
    return [];
  }

  // 最小開始日と最大終了日を取得
  const startDates = validGrants.map(g => new Date(g.startDate!));
  const endDates = validGrants.map(g => new Date(g.endDate!));
  
  const minStartDate = new Date(Math.min(...startDates.map(d => d.getTime())));
  const maxEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));

  console.log('📅 統合期間:', {
    start: minStartDate.toISOString().split('T')[0],
    end: maxEndDate.toISOString().split('T')[0],
    grantsCount: validGrants.length
  });

  // 期間内の全ての月を生成
  return generateMonthList(minStartDate, maxEndDate);
}

/**
 * 指定期間内の全ての月を生成
 */
export function generateMonthList(startDate: Date, endDate: Date): MonthInfo[] {
  const months: MonthInfo[] = [];
  
  // 開始日の月初から開始
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  // 終了日の月末まで
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    
    // 年度計算（4月開始）
    const fiscalYear = month >= 4 ? year : year - 1;
    
    // 四半期計算
    const quarter = Math.ceil(month / 3);
    
    // 年度内の四半期計算
    let fiscalQuarter: number;
    if (month >= 4 && month <= 6) fiscalQuarter = 1; // Q1: 4-6月
    else if (month >= 7 && month <= 9) fiscalQuarter = 2; // Q2: 7-9月
    else if (month >= 10 && month <= 12) fiscalQuarter = 3; // Q3: 10-12月
    else fiscalQuarter = 4; // Q4: 1-3月
    
    months.push({
      year,
      month,
      label: `${year}年${month}月`,
      key: `${year}-${month.toString().padStart(2, '0')}`,
      displayName: `${month}月`,
      fiscalYear,
      quarter,
      fiscalQuarter,
      isStartOfQuarter: month % 3 === 1,
      isEndOfQuarter: month % 3 === 0,
      isStartOfFiscalYear: month === 4,
      isEndOfFiscalYear: month === 3
    });
    
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * 単一助成金から月を抽出
 */
export function extractMonthsFromGrant(grant: Grant): MonthInfo[] {
  if (!grant.startDate || !grant.endDate) {
    return [];
  }

  const startDate = new Date(grant.startDate);
  const endDate = new Date(grant.endDate);

  return generateMonthList(startDate, endDate);
}

/**
 * 月情報を年度別にグループ化
 */
export function groupMonthsByFiscalYear(months: MonthInfo[]) {
  const groups: { [fiscalYear: string]: MonthInfo[] } = {};

  months.forEach(month => {
    // 日本の年度（4月開始）
    const fiscalYear = month.month >= 4 ? month.year : month.year - 1;
    const key = `${fiscalYear}年度`;

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(month);
  });

  return groups;
}

/**
 * 月情報を四半期別にグループ化
 */
export function groupMonthsByQuarter(months: MonthInfo[]) {
  const groups: { [quarter: string]: MonthInfo[] } = {};

  months.forEach(month => {
    const quarter = Math.ceil(month.month / 3);
    const key = `${month.year}年Q${quarter}`;

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(month);
  });

  return groups;
}

/**
 * 年度内の四半期文字列を取得
 */
export function getFiscalQuarterLabel(fiscalYear: number, fiscalQuarter: number): string {
  return `${fiscalYear}年度 Q${fiscalQuarter}`;
}

/**
 * 月の選択状態をチェック
 */
export function getMonthSelectionStats(months: MonthInfo[], selectedKeys: string[]): {
  total: number;
  selected: number;
  percentage: number;
  fiscalYears: { [key: string]: { total: number; selected: number } };
  quarters: { [key: string]: { total: number; selected: number } };
} {
  const stats = {
    total: months.length,
    selected: selectedKeys.length,
    percentage: months.length > 0 ? Math.round((selectedKeys.length / months.length) * 100) : 0,
    fiscalYears: {} as { [key: string]: { total: number; selected: number } },
    quarters: {} as { [key: string]: { total: number; selected: number } }
  };

  // 年度別・四半期別の集計
  months.forEach(month => {
    const fyKey = `${month.fiscalYear}年度`;
    const qKey = getFiscalQuarterLabel(month.fiscalYear, month.fiscalQuarter);
    
    // 年度別集計
    if (!stats.fiscalYears[fyKey]) {
      stats.fiscalYears[fyKey] = { total: 0, selected: 0 };
    }
    stats.fiscalYears[fyKey].total++;
    if (selectedKeys.includes(month.key)) {
      stats.fiscalYears[fyKey].selected++;
    }
    
    // 四半期別集計
    if (!stats.quarters[qKey]) {
      stats.quarters[qKey] = { total: 0, selected: 0 };
    }
    stats.quarters[qKey].total++;
    if (selectedKeys.includes(month.key)) {
      stats.quarters[qKey].selected++;
    }
  });
  
  return stats;
}

/**
 * デバッグ用：助成金の期間情報を表示
 */
export function logGrantPeriods(grants: Grant[]): void {
  console.log('📊 助成金期間一覧:');
  grants.forEach((grant, index) => {
    if (grant.startDate && grant.endDate) {
      console.log(`  ${index + 1}. ${grant.startDate} 〜 ${grant.endDate}`);
    } else {
      console.log(`  ${index + 1}. 期間未設定`);
    }
  });
}