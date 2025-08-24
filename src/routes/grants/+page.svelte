<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { getPeriodColor, getAmountColor } from '$lib/utils/color-rules';
  import { 
    parseCSVLine, 
    parseAmount, 
    parseDate, 
    parseStatus 
  } from '$lib/utils/grants-helpers';
  import SimpleMonthCheckboxes from '$lib/components/SimpleMonthCheckboxes.svelte';
  import DeleteConfirmDialog from '$lib/components/DeleteConfirmDialog.svelte';
  import BudgetItemTable from './components/BudgetItemTable.svelte';
  import GrantCard from './components/GrantCard.svelte';
  import GrantFormComponent from './components/GrantForm.svelte';
  import BudgetItemFormComponent from './components/BudgetItemForm.svelte';
  import type { 
    Grant, 
    BudgetItem, 
    BudgetItemSchedule,
    MonthColumn,
    ImportPreviewItem
  } from '$lib/types/models';
  import { debug } from '$lib/utils/debug';

  let grants: Grant[] = [];
  let selectedGrant: Grant | null = null;
  let budgetItems: BudgetItem[] = [];
  let allBudgetItems: BudgetItem[] = []; // 全予算項目（フィルタリング前）
  let loading = false;
  let error = '';
  let showGrantForm = false;
  let showBudgetItemForm = false;
  let showImportModal = false;
  let showCompletedGrants = false; // 終了済み表示切り替え
  let showReportedGrants = false; // 報告済み表示切り替え
  let filterYear = ''; // 年度フィルター
  let importType: 'grants' | 'budgetItems' = 'grants';
  let importFile: File | null = null;
  let importPreview: any[] = [];
  let importError = '';
  let importProgress = 0;
  let isImporting = false;

  // 月データ表示制御
  let showMonthlyBudget: boolean = true;  // 予算額表示
  let showMonthlyUsed: boolean = false;    // 使用額表示
  let showMonthlyRemaining: boolean = false; // 残額表示
  
  // 削除機能の変数
  let showDeleteConfirm = false;
  let deleteTarget: { type: 'grant' | 'budgetItem', id: number, grantId?: number, name: string } | null = null;
  let deleteLoading = false;
  
  // 月の絞り込み制御（実際のデータに基づいて動的に設定）
  let monthFilterStartYear: number = 2025; // 実際のデータ範囲に合わせて調整
  let monthFilterStartMonth: number = 1;
  let monthFilterEndYear: number = 2025; // 実際のデータがある範囲
  let monthFilterEndMonth: number = 12;
  
  // 月データ表示制御（既に上で定義済みのため削除）
  
  // 進行中助成金の期間に基づいて月絞り込み範囲を設定
  function setDefaultFilterRangeFromInProgressGrants() {
    // 進行中の助成金を取得
    const inProgressGrants = grants.filter(grant => grant.status === 'active');
    
    if (inProgressGrants.length === 0) {
      debug.log('📅 進行中の助成金がないため、デフォルト範囲を維持');
      return;
    }
    
    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;
    
    inProgressGrants.forEach(grant => {
      if (grant.startDate) {
        const startDate = new Date(grant.startDate);
        if (!earliestStart || startDate < earliestStart) {
          earliestStart = startDate;
        }
      }
      
      if (grant.endDate) {
        const endDate = new Date(grant.endDate);
        if (!latestEnd || endDate > latestEnd) {
          latestEnd = endDate;
        }
      }
    });
    
    debug.log('📅 進行中助成金の期間調査:', {
      inProgressGrantsCount: inProgressGrants.length,
      earliestStart: earliestStart?.toISOString(),
      latestEnd: latestEnd?.toISOString()
    });
    
    // 初期値のままの場合のみ設定（ユーザーの手動設定を尊重）
    const isDefaultRange = (monthFilterStartYear === 2025 && monthFilterEndYear === 2025);
    
    if (isDefaultRange) {
      
      if (earliestStart) {
        monthFilterStartYear = earliestStart.getFullYear();
        monthFilterStartMonth = earliestStart.getMonth() + 1;
      }
      
      if (latestEnd) {
        monthFilterEndYear = latestEnd.getFullYear();
        monthFilterEndMonth = latestEnd.getMonth() + 1;
      }
      
      debug.log('📅 進行中助成金の期間に基づいてフィルター範囲を設定:', {
        startYear: monthFilterStartYear,
        startMonth: monthFilterStartMonth,
        endYear: monthFilterEndYear,
        endMonth: monthFilterEndMonth
      });
    }
  }
  
  // 月列生成時に自動的にフィルター範囲を調整（既存ロジック）
  function adjustFilterRangeToData() {
    if (monthColumns && monthColumns.length > 0) {
      const years = monthColumns.map(col => col.year);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      
      debug.log('📅 データに基づくフィルター範囲調整:', {
        currentStartYear: monthFilterStartYear,
        currentEndYear: monthFilterEndYear,
        dataMinYear: minYear,
        dataMaxYear: maxYear
      });
      
      // フォールバック：月列データがある場合の調整
      if (monthFilterStartYear === 2025 && monthFilterEndYear === 2025) {
        monthFilterStartYear = minYear;
        monthFilterEndYear = maxYear;
        debug.log('📅 フィルター範囲をフォールバック調整:', {
          newStartYear: monthFilterStartYear,
          newEndYear: monthFilterEndYear
        });
      }
    }
  }
  
  debug.log('🔧 初期月絞り込み設定:', {
    monthFilterStartYear,
    monthFilterStartMonth,
    monthFilterEndYear,
    monthFilterEndMonth
  });
  
  debug.log('🔧 月フィルタリング修正版 - 2024-2026年範囲で設定:', {
    monthFilterStartYear,
    monthFilterStartMonth,
    monthFilterEndYear,
    monthFilterEndMonth
  });
  
  // 月データ表示制御をwindowオブジェクトに設定（フォーマッター内からアクセス可能にする）
  // コメントアウト: 初期値が正しく反映されない問題のため無効化
  // $: {
  //   if (typeof window !== 'undefined') {
  //     (window as any).monthDisplaySettings = {
  //       showMonthlyBudget,
  //       showMonthlyUsed,
  //       showMonthlyRemaining,
  //       monthFilterStartYear,
  //       monthFilterStartMonth,
  //       monthFilterEndYear,
  //       monthFilterEndMonth
  //     };
  //   }
  // }
  
  // 月データの合計を計算するヘルパー関数
  function calculateMonthlyTotals(rowData: any) {
    const settings = (window as any).monthDisplaySettings || {
      showMonthlyBudget: true,
      showMonthlyUsed: false,
      showMonthlyRemaining: false
    };
    
    // すべての合計額（フィルタリング前）
    let totalAllBudget = 0;
    let totalAllUsed = 0;
    let totalAllRemaining = 0;
    
    // 表示月の合計額（フィルタリング後）
    let totalBudget = 0;
    let totalUsed = 0;
    let totalRemaining = 0;
    
    // monthColumnsから月データを集計
    monthColumns.forEach(monthCol => {
      const fieldName = `month_${monthCol.year}_${monthCol.month}`;
      const monthlyBudget = rowData[fieldName] || 0;
      
      // 対象月が絞り込み範囲内かチェック
      const targetYear = monthCol.year;
      const targetMonth = monthCol.month;
      const targetDate = targetYear * 100 + targetMonth; // YYYYMM形式で比較
      const filterStartDate = settings.monthFilterStartYear * 100 + settings.monthFilterStartMonth;
      const filterEndDate = settings.monthFilterEndYear * 100 + settings.monthFilterEndMonth;
      
      const isWithinFilterRange = targetDate >= filterStartDate && targetDate <= filterEndDate;
      
      // 現在の年月を取得
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // 対象月が過去・現在・未来かを判定
      const isCurrentOrPast = 
        targetYear < currentYear || 
        (targetYear === currentYear && targetMonth <= currentMonth);
      
      // 月別使用額を取得
      const monthKey = `${targetYear}-${targetMonth.toString().padStart(2, '0')}`;
      const monthlyUsed = rowData.monthlyUsedAmounts?.[monthKey] || 0;
      
      // すべての合計額（フィルタリング前）
      if (monthlyBudget > 0) {
        totalAllBudget += monthlyBudget;
      }
      if (isCurrentOrPast) {
        totalAllUsed += monthlyUsed;
      }
      // 残額計算（予算がない月でも使用額があればマイナス残額を計算）
      if (isCurrentOrPast) {
        totalAllRemaining += monthlyBudget - monthlyUsed;
      }
      
      // 表示月の合計額（フィルタリング後）
      if (isWithinFilterRange) {
        if (monthlyBudget > 0) {
          totalBudget += monthlyBudget;
        }
        if (isCurrentOrPast) {
          totalUsed += monthlyUsed;
        }
        // 残額計算（予算がない月でも使用額があればマイナス残額を計算）
        if (isCurrentOrPast) {
          totalRemaining += monthlyBudget - monthlyUsed;
        }
      }
    });
    
    return { 
      totalBudget, 
      totalUsed, 
      totalRemaining,
      totalAllBudget,
      totalAllUsed,
      totalAllRemaining
    };
  }

  // 新規・編集用フォームデータ
  let grantForm: {
    id?: number;
    name?: string;
    grantCode?: string;
    totalAmount?: number;
    startDate?: string | null;
    endDate?: string | null;
    status?: string;
  } = {};
  let budgetItemForm: Partial<BudgetItem> = {};

  const statusLabels = {
    active: '進行中',
    completed: '終了',
    applied: '報告済み'
  };

  const statusColors = {
    active: 'bg-blue-100 text-blue-800',
    completed: 'bg-yellow-100 text-yellow-800',
    applied: 'bg-green-100 text-green-800'
  };

  onMount(async () => {
    debug.log('🚀 onMount開始');
    await loadGrants();
    debug.log('🚀 loadGrants完了');
    await loadAllBudgetItems();
    debug.log('🚀 loadAllBudgetItems完了');
    
    // 複数回にわたって初期化を確実に実行
    const initializeComplete = () => {
      
      if (grants.length > 0 && budgetItems.length > 0) {
        // 進行中助成金の期間に基づいて月絞り込み範囲を設定
        setDefaultFilterRangeFromInProgressGrants();
        
        // 月列生成
        if (monthColumns.length === 0) {
          monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
          
          // フィルター範囲を自動調整（フォールバック）
          adjustFilterRangeToData();
          
          // 月列生成後にテーブル再構築
          setTimeout(() => {
            // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
          }, 500);
          
          // 追加: さらに後でも再実行（確実に実行するため）
          setTimeout(() => {
            debug.log('🔄 追加テーブル更新実行');
            if (monthColumns.length > 0) {
              // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
            }
          }, 2000);
          
          // 最終テスト - 手動実行用のwindow関数を追加
          setTimeout(() => {
            (window as any).testMonthColumns = () => {
              debug.log('🧪 手動月列テスト開始');
              debug.log('🧪 現在の状態:', {
                grants: grants.length,
                budgetItems: budgetItems.length,
                monthColumns: monthColumns.length,
                tableElement: !!tableElement
              });
              
              if (monthColumns.length === 0) {
                debug.log('🧪 月列を強制生成');
                monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
                debug.log('🧪 月列生成完了:', monthColumns.length);
              }
              
              debug.log('🧪 テーブル更新実行');
              // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
            };
            debug.log('🧪 手動テスト関数を準備しました。ブラウザのコンソールで testMonthColumns() を実行してください');
          }, 3000);
        }
        
        // スケジュール取得強制実行
        if (budgetItems.length > 0) {
          debug.log('🔄 初期スケジュール取得開始');
          handleScheduleLoad();
        }
        
        // テーブル初期化
        if (monthColumns.length > 0) {
          debug.log('🔄 初期テーブル初期化開始');
          // テーブル初期化はBudgetItemTableコンポーネント内で自動実行
        }
      }
    };

    // 複数のタイミングで初期化を試行
    setTimeout(initializeComplete, 50);
    setTimeout(initializeComplete, 200);
    setTimeout(initializeComplete, 500);
    
    // 外クリックでドロップダウンを閉じる処理はBudgetItemFormコンポーネント内で実行
    
    // 手動テスト用の関数をwindowに追加（確実に実行）
    (window as any).testMonthColumns = () => {
      debug.log('🧪 手動月列テスト開始');
      debug.log('🧪 現在の状態:', {
        grants: grants.length,
        budgetItems: budgetItems.length,  
        monthColumns: monthColumns.length
      });
      
      if (monthColumns.length === 0) {
        debug.log('🧪 月列を強制生成');
        monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
        debug.log('🧪 月列生成完了:', monthColumns.length);
      }
      
      debug.log('🧪 テーブル更新実行');
      // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
    };
    debug.log('🧪 手動テスト関数準備完了 - ブラウザで testMonthColumns() を実行してください');

    return () => {
      // イベントリスナーのクリーンアップはBudgetItemFormコンポーネント内で実行
      // テーブルのクリーンアップはBudgetItemTableコンポーネント内で実行
    };
  });

  // 月列とbudgetItemsのリアクティブ更新（無限ループ防止付き） - 無効化
  // $: if (grants.length > 0 && budgetItems.length > 0) {
  //   debug.log('🔄 月列・テーブル更新条件チェック:', {
  //     grants: grants.length,
  //     budgetItems: budgetItems.length,
  //     monthColumns: monthColumns.length
  //   });
    
    // monthColumnsが0の場合のみ自動生成 - 無効化
    // if (monthColumns.length === 0) {
    //   debug.log('🔄 月列が未生成、自動生成開始');
    //   monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
    //   debug.log('🔄 月列生成完了:', monthColumns.length, '件');
    // }
  // }
  
  // 月データ表示設定変更処理を関数として定義
  let lastDisplaySettings = { 
    showMonthlyBudget: true, 
    showMonthlyUsed: false, 
    showMonthlyRemaining: false,
    monthFilterStartYear: new Date().getFullYear(),
    monthFilterStartMonth: 1,
    monthFilterEndYear: new Date().getFullYear(),
    monthFilterEndMonth: 12
  };
  
  function handleDisplaySettingsChange() {
    const currentSettings = { 
      showMonthlyBudget, 
      showMonthlyUsed, 
      showMonthlyRemaining,
      monthFilterStartYear,
      monthFilterStartMonth,
      monthFilterEndYear,
      monthFilterEndMonth
    };
    const changed = JSON.stringify(currentSettings) !== JSON.stringify(lastDisplaySettings);
    
    if (changed) {
      debug.log('🔄 月データ表示設定・絞り込み変更:', currentSettings);
      
      // 月絞り込みが変更された場合は列構造を更新
      const isFilterChange = 
        currentSettings.monthFilterStartYear !== lastDisplaySettings.monthFilterStartYear ||
        currentSettings.monthFilterStartMonth !== lastDisplaySettings.monthFilterStartMonth ||
        currentSettings.monthFilterEndYear !== lastDisplaySettings.monthFilterEndYear ||
        currentSettings.monthFilterEndMonth !== lastDisplaySettings.monthFilterEndMonth;
      
      lastDisplaySettings = { ...currentSettings };
      
      if (isFilterChange) {
        // 絞り込み変更時はテーブル再構築
        debug.log('🔧 月絞り込み変更のためテーブル再構築');
        // テーブル再構築はBudgetItemTableコンポーネント内で自動実行
      } else {
        // 表示項目変更時は再描画のみ
        debug.log('🔧 表示項目変更のため再描画');
        // 再描画はBudgetItemTableコンポーネント内で自動実行
      }
    }
  }
  
  // 表示設定の変更を監視
  $: {
    showMonthlyBudget, showMonthlyUsed, showMonthlyRemaining, monthFilterStartYear, monthFilterStartMonth, monthFilterEndYear, monthFilterEndMonth;
    // 表示設定の変更はBudgetItemTableコンポーネント内で自動処理
    // 少し遅延させて処理
    setTimeout(handleDisplaySettingsChange, 10);
  }
  
  // 月絞り込み適用関数
  function getFilteredMonthColumns() {
    debug.log('🔍 getFilteredMonthColumns 開始:', {
      monthColumnsExists: !!monthColumns,
      monthColumnsLength: monthColumns?.length || 0,
      monthFilterStartYear,
      monthFilterStartMonth,
      monthFilterEndYear,
      monthFilterEndMonth
    });
    
    if (!monthColumns || monthColumns.length === 0) {
      debug.log('🔍 monthColumns が空のため絞り込み不可');
      return [];
    }
    
    const startDate = monthFilterStartYear * 100 + monthFilterStartMonth;
    const endDate = monthFilterEndYear * 100 + monthFilterEndMonth;
    
    debug.log('🔍 月絞り込み適用:', {
      startDate,
      endDate,
      totalMonthColumns: monthColumns.length,
      monthColumns: monthColumns.map(col => ({
        year: col.year,
        month: col.month,
        targetDate: col.year * 100 + col.month
      }))
    });
    
    const filtered = monthColumns.filter(monthCol => {
      const targetDate = monthCol.year * 100 + monthCol.month;
      const inRange = targetDate >= startDate && targetDate <= endDate;
      debug.log(`月列${monthCol.label}: targetDate=${targetDate}, inRange=${inRange}`);
      return inRange;
    });
    
    debug.log('🔍 絞り込み結果:', filtered.length, '列');
    
    // 絞り込み結果が0件の場合は、全ての月列を返す（安全な処理）
    if (filtered.length === 0) {
      debug.log('⚠️ 絞り込み結果が0件のため、全ての月列を表示');
      return monthColumns;
    }
    
    return filtered;
  }

  async function loadGrants() {
    loading = true;
    try {
      // baseが空の場合は/budget2を使用
      const apiBase = base || '/budget2';
      const url = `${apiBase}/api/grants`;
      debug.log('🔍 Fetching grants from URL:', url);
      debug.log('🔍 base path:', base, '→ apiBase:', apiBase);
      const response = await fetch(url);
      debug.log('🔍 Response status:', response.status);
      debug.log('🔍 Response OK:', response.ok);
      const data = await response.json();
      debug.log('🔍 Response data:', data);
      
      if (data.success) {
        grants = data.grants || [];
        debug.log('助成金取得完了:', grants.length, '件');
        
        // 月列を生成（ただし予算項目が既にロード済みの場合のみ）
        if (budgetItems.length > 0) {
          monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
          debug.log('助成金ロード後のmonthColumns:', monthColumns.length, '件');
        }
      } else {
        error = data.error || '助成金データの取得に失敗しました';
      }
    } catch (err) {
      error = '助成金データの取得中にエラーが発生しました';
      console.error('Load grants error:', err);
    } finally {
      loading = false;
    }
  }

  function selectGrant(grant: Grant) {
    debug.log('🔍 selectGrant called:', grant.name, grant.id);
    debug.log('🔍 現在のselectedGrant:', selectedGrant);
    debug.log('🔍 allBudgetItems数:', allBudgetItems.length);
    
    if (selectedGrant?.id === grant.id) {
      // 同じ助成金をクリックした場合は絞り込みを解除
      debug.log('🔍 絞り込み解除');
      selectedGrant = null;
      budgetItems = getFilteredBudgetItems(allBudgetItems);
    } else {
      // 助成金で絞り込み
      debug.log('🔍 絞り込み実行: grantId =', grant.id);
      selectedGrant = grant;
      const filtered = allBudgetItems.filter(item => item.grantId === grant.id);
      debug.log('🔍 絞り込み結果:', filtered.length, '件');
      budgetItems = getFilteredBudgetItems(filtered);
    }
    
    debug.log('🔍 最終budgetItems数:', budgetItems.length);
    
    // テーブルを再描画・更新
    if (budgetItems.length > 0) {
      debug.log('🔍 助成金絞り込み後のテーブル更新実行');
      // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
    } else {
      // budgetItemsが空の場合もテーブルをクリア
      debug.log('🔍 テーブルクリア実行');
      // テーブルクリア処理はBudgetItemTableコンポーネント内で自動実行
    }
  }

  // 終了・報告ステータスを除外するフィルター関数
  function getFilteredBudgetItems(items: any[]) {
    debug.log('getFilteredBudgetItems - 入力:', items.length, '件');
    debug.log('最初の3件のデータ:', items.slice(0, 3));
    debug.log('🔍 使用額チェック:', items.map(item => ({
      name: item.name,
      budgetedAmount: item.budgetedAmount,
      usedAmount: item.usedAmount,
      grantStatus: item.grantStatus || item.grant?.status
    })));
    
    // フィルタリングを有効化（一時的な無効化を削除）
    // return items; // ← これが原因でフィルタリングが効いていなかった！
    
    const filtered = items.filter(item => {
      const status = item.grantStatus || item.grant?.status;
      // ステータスが未定義の場合は表示
      if (!status) {
        return true;
      }
      
      // 基本表示: 進行中のみ
      if (status === 'active') {
        return true;
      }
      
      // 終了済み表示がONの場合、終了ステータスも表示
      if (showCompletedGrants && status === 'completed') {
        debug.log(`項目${item.id}(${item.name}) - 終了済み表示ON、表示`);
        return true;
      }
      
      // 報告済み表示がONの場合、報告済みステータスも表示
      if (showReportedGrants && status === 'applied') {
        debug.log(`項目${item.id}(${item.name}) - 報告済み表示ON、表示`);
        return true;
      }
      
      debug.log(`項目${item.id}(${item.name}) - 条件に合致せず、非表示`);
      return false;
    });
    
    debug.log('getFilteredBudgetItems - 出力:', filtered.length, '件');
    return filtered;
  }

  async function loadBudgetItems(grantId: number) {
    try {
      const response = await fetch(`${base}/api/grants/${grantId}/budget-items`);
      const data = await response.json();
      
      if (data.success) {
        budgetItems = data.budgetItems || [];
      } else {
        error = data.error || '予算項目の取得に失敗しました';
      }
    } catch (err) {
      error = '予算項目の取得中にエラーが発生しました';
      console.error('Load budget items error:', err);
    }
  }

  async function loadAllBudgetItems() {
    debug.log('📍 loadAllBudgetItems開始');
    try {
      // baseが空の場合は/budget2を使用
      const apiBase = base || '/budget2';
      const response = await fetch(`${apiBase}/api/budget-items`);
      const data = await response.json();
      
      debug.log('📍 APIレスポンス:', data.success, 'items:', data.budgetItems?.length);
      
      if (data.success) {
        allBudgetItems = data.budgetItems || [];
        // 使用額の確認（重要）
        debug.log('【使用額確認】予算項目の使用額:', allBudgetItems.filter(item => item.usedAmount > 0).map(item => ({
          name: item.name,
          usedAmount: item.usedAmount
        })));
        
        debug.log('📍 selectedGrant状態:', selectedGrant);
        
        // フィルター処理（selectedGrantの有無に関わらず実行）
        debug.log('📍 selectedGrant状態:', selectedGrant);
        try {
          if (!selectedGrant) {
            debug.log('📍 selectedGrantがnullなので、全項目をフィルター');
            budgetItems = getFilteredBudgetItems(allBudgetItems);
          } else {
            debug.log('📍 selectedGrantあり、選択された助成金でフィルター');
            // selectedGrantがある場合も同じフィルター処理を適用
            budgetItems = getFilteredBudgetItems(allBudgetItems);
          }
          debug.log('🔍 フィルター後のbudgetItems:', budgetItems.length, '件');
          debug.log('🔍 フィルター後の使用額情報:', budgetItems.map(item => ({
            name: item.name,
            usedAmount: item.usedAmount
          })));
        } catch (filterError) {
          console.error('❌ getFilteredBudgetItemsでエラー:', filterError);
          budgetItems = allBudgetItems; // エラー時は全件表示
        }
        
        // 予算項目更新後にスケジュール取得を実行
        if (budgetItems.length > 0) {
          await handleScheduleLoad();
        }
        
        // 月列を生成（ただし既にデータがロード済みの場合のみ）
        if (grants && grants.length > 0) {
          monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
          debug.log('予算項目ロード後のmonthColumns:', monthColumns.length, '件');
        }
        
        // テーブルデータを更新（重要：この処理が抜けていた）
        debug.log('🔍 テーブル更新前チェック:', {
          budgetItemsLength: budgetItems.length,
          allBudgetItemsLength: allBudgetItems.length,
          selectedGrant: !!selectedGrant
        });
      } else {
        error = data.error || '予算項目の取得に失敗しました';
      }
    } catch (err) {
      error = '予算項目の読み込み中にエラーが発生しました';
      console.error('Load all budget items error:', err);
    }
  }

  function openGrantForm(grant?: Grant) {
    if (grant) {
      grantForm = {
        ...grant,
        startDate: formatDateForInput(grant.startDate),
        endDate: formatDateForInput(grant.endDate)
      };
    } else {
      grantForm = { status: 'active' };
    }
    showGrantForm = true;
  }

  async function openBudgetItemForm(budgetItem?: BudgetItem) {
    budgetItemForm = budgetItem ? { ...budgetItem } : {};
    
    if (budgetItem?.id) {
      // 既存項目の場合、スケジュールデータを読み込み
      await loadBudgetItemSchedule(budgetItem.id);
    } else {
      // 新規作成時の処理
      // フィルターされた助成金があれば自動選択
      if (selectedGrant) {
        budgetItemForm.grantId = selectedGrant.id;
        
        // 選択された助成金があれば全月をデフォルトでチェック
        if (availableMonths.length > 0) {
          selectedMonths = new Set(availableMonths.map(m => getMonthKey(m.year, m.month)));
        } else {
          selectedMonths.clear();
        }
      } else {
        selectedMonths.clear();
      }
    }
    
    showBudgetItemForm = true;
  }

  async function loadBudgetItemSchedule(budgetItemId: number) {
    try {
      const response = await fetch(`${base}/api/budget-items/${budgetItemId}/schedule`);
      if (response.ok) {
        const data = await response.json();
        selectedMonths = new Set(data.schedules.map((s: any) => getMonthKey(s.year, s.month)));
      }
    } catch (err) {
      debug.log('スケジュールデータなし:', err);
      selectedMonths.clear();
    }
  }

  // saveGrant関数はGrantFormコンポーネントに移動

  // 削除関数
  function openDeleteConfirm(type: 'grant' | 'budgetItem', item: any, grantId?: number) {
    deleteTarget = {
      type,
      id: item.id,
      grantId,
      name: item.name
    };
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
    deleteTarget = null;
    deleteLoading = false;
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    
    deleteLoading = true;
    try {
      const apiBase = base || '/budget2';
      let url = '';
      
      if (deleteTarget.type === 'grant') {
        url = `${apiBase}/api/grants/${deleteTarget.id}`;
      } else {
        url = `${apiBase}/api/grants/${deleteTarget.grantId}/budget-items/${deleteTarget.id}`;
      }
      
      const response = await fetch(url, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 成功時の処理
        if (deleteTarget.type === 'grant') {
          await loadGrants();
          // 削除した助成金が選択されていた場合は選択を解除
          if (selectedGrant && selectedGrant.id === deleteTarget.id) {
            selectedGrant = null;
            budgetItems = getFilteredBudgetItems(allBudgetItems);
          }
        } else {
          // 予算項目削除の場合
          await loadAllBudgetItems();
          if (selectedGrant) {
            // 選択中の助成金がある場合は再フィルタリング
            const filtered = allBudgetItems.filter(item => item.grantId === selectedGrant.id);
            budgetItems = getFilteredBudgetItems(filtered);
          } else {
            budgetItems = getFilteredBudgetItems(allBudgetItems);
          }
          // テーブル更新はBudgetItemTableコンポーネント内で自動実行
        }
        
        closeDeleteConfirm();
        error = ''; // エラーメッセージをクリア
      } else {
        error = data.error || '削除に失敗しました';
        deleteLoading = false;
      }
    } catch (err) {
      error = '削除処理中にエラーが発生しました';
      console.error('Delete error:', err);
      deleteLoading = false;
    }
  }

  // saveBudgetItemとsaveBudgetItemSchedule関数はBudgetItemFormコンポーネントに移動

  // 複数条件ソート機能
  let sortCriteria: Array<{field: string, direction: 'asc' | 'desc', priority: number}> = [];

  // Tabulator関連の変数（BudgetItemTableコンポーネントに移動）
  let monthColumns: Array<{year: number, month: number, label: string}> = [];

  // カテゴリ管理
  let availableCategories: string[] = [];
  // showCategoryDropdownはBudgetItemFormコンポーネントに移動

  // 月別スケジュール管理
  let availableMonths: Array<{year: number, month: number, label: string}> = [];
  let selectedMonths: Set<string> = new Set(); // "2025-04" 形式

  // 月割り予算額の計算（リアクティブ）
  $: monthlyBudget = budgetItemForm && budgetItemForm.budgetedAmount && selectedMonths.size > 0 
    ? Math.floor(budgetItemForm.budgetedAmount / selectedMonths.size)
    : 0;
  
  // 既存の予算項目からカテゴリを取得
  function updateAvailableCategories() {
    const categories = new Set<string>();
    budgetItems.forEach(item => {
      if (item.category && item.category.trim()) {
        categories.add(item.category.trim());
      }
    });
    availableCategories = Array.from(categories).sort();
  }
  
  // 予算項目更新時の統合処理（カテゴリ更新・テーブル更新）
  let budgetItemsUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastBudgetItemsLength = 0;
  let lastBudgetItemsIds = '';
  
  function handleBudgetItemsUpdate() {
    const currentIds = budgetItems.map(item => item.id).sort().join(',');
    const lengthChanged = budgetItems.length !== lastBudgetItemsLength;
    const idsChanged = currentIds !== lastBudgetItemsIds;
    
    debug.log('📊 handleBudgetItemsUpdate:', {
      budgetItemsLength: budgetItems.length,
      lengthChanged,
      idsChanged,
      currentIds: currentIds.substring(0, 50) + (currentIds.length > 50 ? '...' : ''),
      lastIds: lastBudgetItemsIds.substring(0, 50) + (lastBudgetItemsIds.length > 50 ? '...' : '')
    });
    
    if (budgetItems.length > 0 && (lengthChanged || idsChanged)) {
      lastBudgetItemsLength = budgetItems.length;
      lastBudgetItemsIds = currentIds;
      
      if (budgetItemsUpdateTimeout) clearTimeout(budgetItemsUpdateTimeout);
      budgetItemsUpdateTimeout = setTimeout(() => {
        // カテゴリ更新
        if (lengthChanged) {
          debug.log('📊 カテゴリ更新実行 (lengthChanged)');
          updateAvailableCategories();
        }
        // IDが変更された場合はスケジュール取得
        if (idsChanged) {
          debug.log('📊 スケジュール取得実行 (idsChanged)');
          handleScheduleLoad();
        }
        // テーブル更新処理は別の関数で実行
        debug.log('📊 テーブル更新実行');
        // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
      }, 200);
    }
  }
  
  // リアクティブ無効化 - 無限ループを防ぐため
  // $: handleBudgetItemsUpdate();

  // リアクティブステートメント無効化 - 無限ループ防止
  // 終了済みフィルター変更時の処理
  // $: if (showCompletedGrants !== undefined && allBudgetItems.length > 0) {
  //   debug.log('終了済みフィルター変更:', showCompletedGrants);
  //   refreshBudgetItems().catch(console.error);
  // }

  // 報告済みフィルター変更時の処理  
  // $: if (showReportedGrants !== undefined && allBudgetItems.length > 0) {
  //   debug.log('報告済みフィルター変更:', showReportedGrants);
  //   refreshBudgetItems().catch(console.error);
  // }

  // 選択助成金変更時の処理
  // $: if (selectedGrant !== undefined && allBudgetItems.length > 0) {
  //   debug.log('選択助成金変更:', selectedGrant?.name);
  //   refreshBudgetItems().catch(console.error);
  // }

  async function refreshBudgetItems() {
    debug.log('🔄 refreshBudgetItems実行:', {
      selectedGrant: selectedGrant?.name,
      allBudgetItemsLength: allBudgetItems.length
    });
    
    if (selectedGrant) {
      budgetItems = getFilteredBudgetItems(allBudgetItems.filter(item => item.grantId === selectedGrant.id));
    } else {
      budgetItems = getFilteredBudgetItems(allBudgetItems);
    }
    
    // フィルター後の予算項目についてスケジュール取得
    if (budgetItems.length > 0) {
      await handleScheduleLoad();
    }
    debug.log('🔄 フィルター後予算項目数:', budgetItems.length);
    
    // フィルター後のテーブル更新
    if (budgetItems.length > 0) {
      debug.log('🔄 フィルター後のテーブル更新実行');
      // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
    }
  }
  
  // selectCategoryとfilterCategories関数はBudgetItemFormコンポーネントに移動
  // handleClickOutside関数もBudgetItemFormコンポーネントに移動済み

  // 助成金期間から利用可能な月を生成（7日以上の月のみ）
  function generateAvailableMonths(grant: any) {
    if (!grant?.startDate || !grant?.endDate) {
      availableMonths = [];
      return;
    }

    const startDate = new Date(grant.startDate);
    const endDate = new Date(grant.endDate);
    const months = [];

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      
      // その月に何日間あるか計算
      let monthStart = new Date(year, month - 1, 1);
      let monthEnd = new Date(year, month, 0); // 月末日
      
      // 開始月の場合、実際の開始日から計算
      if (year === startDate.getFullYear() && month === startDate.getMonth() + 1) {
        monthStart = startDate;
      }
      
      // 終了月の場合、実際の終了日まで計算
      if (year === endDate.getFullYear() && month === endDate.getMonth() + 1) {
        monthEnd = endDate;
      }
      
      // 日数を計算（両端含む）
      const daysInMonth = Math.floor((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // 7日以上ある月のみ追加
      if (daysInMonth >= 7) {
        months.push({
          year,
          month,
          label: `${year.toString().slice(-2)}/${month.toString().padStart(2, '0')}`
        });
      }
      
      current.setMonth(current.getMonth() + 1);
    }

    availableMonths = months;
  }

  // 選択中の助成金が変更された時に利用可能月を更新
  $: if (selectedGrant) {
    generateAvailableMonths(selectedGrant);
    // 新規作成時（既存データがない場合）は全月をデフォルトでチェック  
    if (!budgetItemForm.id && availableMonths.length > 0) {
      selectedMonths = new Set(availableMonths.map(m => getMonthKey(m.year, m.month)));
    }
  }

  function toggleMonth(yearMonth: string) {
    if (selectedMonths.has(yearMonth)) {
      selectedMonths.delete(yearMonth);
    } else {
      selectedMonths.add(yearMonth);
    }
    selectedMonths = new Set(selectedMonths); // リアクティブ更新
  }

  function getMonthKey(year: number, month: number): string {
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  function selectAllMonths() {
    selectedMonths = new Set(availableMonths.map(m => getMonthKey(m.year, m.month)));
  }

  function clearAllMonths() {
    selectedMonths = new Set();
  }

  // 予算項目の選択月を表示用に取得
  let budgetItemSchedules: Map<number, {months: string[], scheduleData: Map<string, {monthlyBudget: number}>}> = new Map(); // budgetItemId -> {months: [], scheduleData: Map<monthKey, {monthlyBudget}>}
  let schedulesLoaded = false; // スケジュール読み込み完了フラグ

  async function loadBudgetItemSchedules() {
    debug.log('📅 スケジュール取得開始:', budgetItems.length, '件');
    schedulesLoaded = false;
    const newSchedules = new Map();
    
    for (const item of budgetItems) {
      try {
        debug.log(`📅 項目ID${item.id}のスケジュール取得中...`);
        const response = await fetch(`${base}/api/budget-items/${item.id}/schedule`);
        debug.log(`📅 項目ID${item.id}のレスポンス:`, response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          debug.log(`📅 項目ID${item.id}のデータ:`, data);
          
          if (data.success && data.schedules.length > 0) {
            const months = data.schedules.map(s => `${s.year.toString().slice(-2)}/${s.month.toString().padStart(2, '0')}`);
            const scheduleData = new Map();
            
            // 各月のスケジュールデータをMapに保存
            data.schedules.forEach(s => {
              const monthKey = `${s.year.toString().slice(-2)}/${s.month.toString().padStart(2, '0')}`;
              debug.log(`🗓️ 項目ID${item.id}のスケジュールデータ保存:`, {
                originalYear: s.year,
                originalMonth: s.month,
                monthKey,
                monthlyBudget: s.monthlyBudget
              });
              scheduleData.set(monthKey, {
                monthlyBudget: s.monthlyBudget || 0
              });
            });
            
            newSchedules.set(item.id, {
              months,
              scheduleData
            });
            debug.log(`📅 項目ID${item.id}のスケジュール設定:`, months, 'monthlyBudget:', Array.from(scheduleData.entries()));
          } else {
            debug.log(`📅 項目ID${item.id}はスケジュールデータなし`);
          }
        } else {
          console.warn(`📅 項目ID${item.id}のスケジュール取得失敗:`, response.status);
        }
      } catch (err) {
        console.error(`📅 項目ID${item.id}のスケジュール取得エラー:`, err);
      }
    }
    
    // 一度だけMapを更新（リアクティブ更新を最小化）
    budgetItemSchedules = new Map(newSchedules);
    schedulesLoaded = true; // 読み込み完了をマーク
    debug.log('📅 スケジュールデータ読み込み完了:', budgetItemSchedules.size, '件');
    debug.log('📅 budgetItemSchedulesの内容:', Array.from(budgetItemSchedules.entries()));
    debug.log('📅 newSchedulesの内容:', Array.from(newSchedules.entries()));
    debug.log('📅 schedulesLoadedフラグ:', schedulesLoaded);
    
    // スケジュール取得完了後に月列生成とテーブル更新を実行
    setTimeout(() => {
      debug.log('📅 スケジュール取得後の月列とテーブル更新実行');
      // 月列を再生成（スケジュールデータに基づいて）
      debug.log('📅 月列生成前の状態:', {
        monthColumnsLength: monthColumns.length,
        schedulesLoaded,
        grantsLength: grants.length,
        budgetItemsLength: budgetItems.length
      });
      
      monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
      debug.log('📅 スケジュール取得後の月列生成完了:', monthColumns.length, '件');
      debug.log('📅 生成された月列:', monthColumns);
      
      // フィルター範囲を自動調整
      adjustFilterRangeToData();
      // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
    }, 100);
  }

  // スケジュール取得処理（統合版：handleBudgetItemsUpdate内で実行）
  let scheduleLoadTimeout: ReturnType<typeof setTimeout> | null = null;
  
  async function handleScheduleLoad() {
    debug.log('📅 handleScheduleLoad実行 - スケジュール取得開始');
    await loadBudgetItemSchedules();
    debug.log('📅 handleScheduleLoad完了 - スケジュール取得完了');
  }
  
  function toggleSort(field: string) {
    const existingIndex = sortCriteria.findIndex(s => s.field === field);
    
    if (existingIndex >= 0) {
      // 既存の条件がある場合は方向を切り替え
      const existing = sortCriteria[existingIndex];
      if (existing.direction === 'asc') {
        existing.direction = 'desc';
      } else {
        // 降順から再度クリックで削除
        sortCriteria.splice(existingIndex, 1);
      }
    } else {
      // 新しい条件を追加
      const newPriority = sortCriteria.length > 0 ? Math.max(...sortCriteria.map(s => s.priority)) + 1 : 1;
      sortCriteria.push({
        field,
        direction: 'asc',
        priority: newPriority
      });
    }
    
    // 優先度順にソート条件を並び替え
    sortCriteria.sort((a, b) => a.priority - b.priority);
    
    // Svelteのリアクティブ更新のために新しい配列を作成
    sortCriteria = [...sortCriteria];
    
    sortBudgetItems();
  }
  
  function sortBudgetItems() {
    if (sortCriteria.length === 0) return;
    
    budgetItems.sort((a, b) => {
      for (const criterion of sortCriteria) {
        let aValue: any, bValue: any;
        
        switch (criterion.field) {
          case 'grantName':
            aValue = (a.grantName || '').toLowerCase();
            bValue = (b.grantName || '').toLowerCase();
            break;
          case 'name':
            aValue = (a.name || '').toLowerCase();
            bValue = (b.name || '').toLowerCase();
            break;
          case 'category':
            aValue = (a.category || '').toLowerCase();
            bValue = (b.category || '').toLowerCase();
            break;
          case 'budgetedAmount':
            aValue = a.budgetedAmount || 0;
            bValue = b.budgetedAmount || 0;
            break;
          case 'usedAmount':
            aValue = a.usedAmount || 0;
            bValue = b.usedAmount || 0;
            break;
          case 'remainingAmount':
            aValue = (a.budgetedAmount || 0) - (a.usedAmount || 0);
            bValue = (b.budgetedAmount || 0) - (b.usedAmount || 0);
            break;
          default:
            continue;
        }
        
        if (aValue < bValue) return criterion.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return criterion.direction === 'asc' ? 1 : -1;
        // 同じ値の場合は次の条件で比較
      }
      return 0;
    });
    
    budgetItems = [...budgetItems]; // リアクティブ更新
  }

  // テーブル更新（BudgetItemTableコンポーネントで処理）
  
  // リアクティブな関数として定義
  $: getSortIcon = (field: string) => {
    const criterion = sortCriteria.find(s => s.field === field);
    if (!criterion) return '↕';
    
    const icon = criterion.direction === 'asc' ? '▲' : '▼';
    return `${icon}${criterion.priority}`;
  };
  
  $: getSortClass = (field: string) => {
    const criterion = sortCriteria.find(s => s.field === field);
    if (criterion) {
      return 'bg-blue-100 text-blue-800';
    }
    return '';
  };
  
  function clearSort() {
    sortCriteria = [];
    // データを元の順序に戻す（サーバーから再読み込み）
    if (selectedGrant) {
      loadBudgetItems(selectedGrant.id);
    }
  }

  function formatAmount(amount?: number, includeYen: boolean = true): string {
    if (amount == null || amount === undefined) return includeYen ? '¥0' : '0';
    const formatted = amount.toLocaleString();
    return includeYen ? `¥${formatted}` : formatted;
  }






  // ISO文字列をYYYY-MM-DD形式に変換（HTML input[type="date"]用）
  function formatDateForInput(dateString?: string): string {
    if (!dateString) return '';
    return dateString.split('T')[0]; // '2025-04-01T00:00:00.000Z' -> '2025-04-01'
  }

  // YYYY-MM-DD形式をISO文字列に変換（API送信用）
  function formatDateForAPI(dateString?: string): string | undefined {
    if (!dateString) return undefined;
    return dateString; // input[type="date"]は既にYYYY-MM-DD形式なのでそのまま
  }

  function calculateProgress(used?: number, total?: number): number {
    if (!total || total === 0) return 0;
    return Math.round((used || 0) / total * 100);
  }

  // 終了済み助成金の年度フィルタリング
  function getFilteredCompletedGrants(grants: Grant[]): Grant[] {
    const completedGrants = grants.filter(g => g.status === 'completed');
    
    if (!filterYear) {
      return completedGrants;
    }
    
    return completedGrants.filter(grant => {
      if (!grant.endDate) return false;
      const endYear = new Date(grant.endDate).getFullYear();
      return endYear.toString() === filterYear;
    });
  }

  // 報告済み助成金の年度フィルタリング
  function getFilteredReportedGrants(grants: Grant[]): Grant[] {
    const reportedGrants = grants.filter(g => g.status === 'applied');
    
    if (!filterYear) {
      return reportedGrants;
    }
    
    return reportedGrants.filter(grant => {
      if (!grant.endDate) return false;
      const endYear = new Date(grant.endDate).getFullYear();
      return endYear.toString() === filterYear;
    });
  }

  // 利用可能な年度を取得
  function getAvailableYears(grants: Grant[]): string[] {
    const years = new Set<string>();
    grants
      .filter(g => g.status === 'completed' || g.status === 'applied')
      .forEach(grant => {
        if (grant.endDate) {
          const year = new Date(grant.endDate).getFullYear().toString();
          years.add(year);
        }
      });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)); // 新しい年順
  }

  // 表示用の月列を生成（表示中の予算項目に関連する助成金のみから生成）
  function generateMonthColumns(grantsData: Grant[], selectedGrantData: Grant | null, currentBudgetItems: any[]): Array<{year: number, month: number, label: string}> {
    debug.log('generateMonthColumns called, grants.length:', grantsData?.length, 'budgetItems.length:', currentBudgetItems?.length);
    debug.log('grantsData:', grantsData);
    debug.log('currentBudgetItems:', currentBudgetItems);
    
    if (selectedGrantData) {
      // 選択された助成金の期間から生成
      debug.log('Using selectedGrant:', selectedGrantData.name);
      return generateMonthsFromGrant(selectedGrantData);
    }
    
    // データがまだロードされていない場合は空の配列を返す
    if (!grantsData || grantsData.length === 0) {
      debug.log('No grants data, returning empty months');
      return [];
    }
    
    if (!currentBudgetItems) {
      debug.log('No budget items data, returning empty months');
      return [];
    }
    
    // 暫定：全ての進行中の助成金から月列を生成
    const displayedGrantIds = new Set(grantsData.filter(g => g.status === 'active').map(g => g.id));
    debug.log('Using all active grants for month generation:', Array.from(displayedGrantIds));
    
    if (displayedGrantIds.size === 0) {
      debug.log('No displayed grant IDs, returning empty months');
      return [];
    }
    
    // 関連する助成金の期間のみを統合
    const allMonths = new Set<string>();
    grantsData.forEach(grant => {
      debug.log('Checking grant:', grant.id, grant.name, 'startDate:', grant.startDate, 'endDate:', grant.endDate, 'inDisplayed:', displayedGrantIds.has(grant.id));
      if (displayedGrantIds.has(grant.id) && grant.startDate && grant.endDate) {
        debug.log('Processing grant for months:', grant.name, 'startDate:', grant.startDate, 'endDate:', grant.endDate);
        const months = generateMonthsFromGrant(grant);
        debug.log('Generated months for grant:', months);
        months.forEach(m => allMonths.add(`${m.year}-${m.month}`));
      }
    });
    
    debug.log('Generated months count:', allMonths.size);
    debug.log('All months:', Array.from(allMonths));
    
    return Array.from(allMonths)
      .sort((a, b) => {
        const [aYear, aMonth] = a.split('-');
        const [bYear, bMonth] = b.split('-');
        const aDate = new Date(parseInt(aYear), parseInt(aMonth) - 1);
        const bDate = new Date(parseInt(bYear), parseInt(bMonth) - 1);
        return aDate.getTime() - bDate.getTime();
      })
      .map(monthKey => {
        const [year, month] = monthKey.split('-');
        return {
          year: parseInt(year),
          month: parseInt(month),
          label: `${year.slice(-2)}/${month.padStart(2, '0')}`
        };
      });
  }

  function generateMonthsFromGrant(grant: Grant): Array<{year: number, month: number, label: string}> {
    if (!grant.startDate || !grant.endDate) return [];
    
    const startDate = new Date(grant.startDate);
    const endDate = new Date(grant.endDate);
    const months = [];

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      
      // その月に何日間あるか計算
      let monthStart = new Date(year, month - 1, 1);
      let monthEnd = new Date(year, month, 0); // 月末日
      
      // 開始月の場合、実際の開始日から計算
      if (year === startDate.getFullYear() && month === startDate.getMonth() + 1) {
        monthStart = startDate;
      }
      
      // 終了月の場合、実際の終了日まで計算  
      if (year === endDate.getFullYear() && month === endDate.getMonth() + 1) {
        monthEnd = endDate;
      }
      
      // 日数を計算（両端含む）
      const daysInMonth = Math.floor((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // 7日以上ある月のみ追加
      if (daysInMonth >= 7) {
        months.push({
          year,
          month,
          label: `${year.toString().slice(-2)}/${month.toString().padStart(2, '0')}`
        });
      }
      
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  // 予算項目の月割り金額を計算
  function getMonthlyAmount(item: any, targetYear: number, targetMonth: number): number {
    const schedules = budgetItemSchedules.get(item.id);
    const monthKey = `${targetYear.toString().slice(-2)}/${targetMonth.toString().padStart(2, '0')}`;
    
    debug.log(`💰 getMonthlyAmount呼び出し: 項目ID${item.id} ${monthKey}月`, {
      schedules,
      budgetedAmount: item.budgetedAmount,
      schedulesLoaded,
      budgetItemSchedulesSize: budgetItemSchedules.size,
      schedulesExists: !!schedules,
      schedulesMonthsExists: !!schedules?.months,
      scheduleDataExists: !!schedules?.scheduleData,
      schedulesMonths: schedules?.months,
      scheduleDataKeys: schedules?.scheduleData ? Array.from(schedules.scheduleData.keys()) : 'N/A'
    });
    
    if (!item.budgetedAmount) {
      debug.log(`💰 項目ID${item.id}は予算額が0のため金額0`);
      return 0;
    }
    
    // スケジュールデータがある場合は、それに基づいて計算
    if (schedules && schedules.months && schedules.months.length > 0) {
      const hasSchedule = schedules.months.includes(monthKey);
      
      debug.log(`💰 項目ID${item.id}のスケジュール判定:`, {
        monthKey,
        hasSchedule,
        months: schedules.months,
        schedulesLength: schedules.months.length
      });
      
      if (!hasSchedule) {
        debug.log(`💰 項目ID${item.id} ${monthKey}月はスケジュール対象外のため金額0`);
        return 0;
      }
      
      // 保存されたmonthlyBudgetを使用（fallbackとして計算）
      const scheduleData = schedules.scheduleData?.get(monthKey);
      debug.log(`🔍 項目ID${item.id} ${monthKey}月のscheduleData確認:`, {
        scheduleData,
        monthlyBudget: scheduleData?.monthlyBudget,
        schedulesHasScheduleData: !!schedules.scheduleData,
        scheduleDataType: typeof schedules.scheduleData,
        scheduleDataSize: schedules.scheduleData?.size
      });
      
      const monthlyAmount = scheduleData?.monthlyBudget || 
        (schedules.months.length > 0 ? Math.round(item.budgetedAmount / schedules.months.length) : 0);
      
      debug.log(`💰 項目ID${item.id} ${monthKey}月の金額: ${monthlyAmount} (保存値: ${scheduleData?.monthlyBudget || 'なし'}, 総額: ${item.budgetedAmount}, 対象月数: ${schedules.months.length})`);
      return monthlyAmount;
    }
    
    // スケジュールデータがない場合は、助成金期間全体で均等配分
    if (!schedulesLoaded) {
      // スケジュールデータがまだ読み込まれていない場合は、初期表示として均等配分を表示
      const grant = grants.find(g => g.id === item.grantId);
      if (grant && grant.startDate && grant.endDate) {
        const grantMonths = generateMonthsFromGrant(grant);
        const targetMonthKey = `${targetYear.toString().slice(-2)}/${targetMonth.toString().padStart(2, '0')}`;
        const isInGrantPeriod = grantMonths.some(m => 
          `${m.year.toString().slice(-2)}/${m.month.toString().padStart(2, '0')}` === targetMonthKey
        );
        
        if (isInGrantPeriod && grantMonths.length > 0) {
          const monthlyAmount = Math.round(item.budgetedAmount / grantMonths.length);
          debug.log(`項目ID${item.id} ${targetMonthKey}月の金額(均等配分): ${monthlyAmount}`);
          return monthlyAmount;
        }
      }
    }
    
    // デフォルトは0
    debug.log(`項目ID${item.id}のスケジュールデータなし、金額表示なし`);
    return 0;
  }

  // 月列更新処理（デバウンス付き）
  let monthColumnsTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastMonthColumnsState = {
    grantsLength: 0,
    selectedGrantId: 0,
    budgetItemsIds: ''
  };
  
  function updateMonthColumns() {
    const currentState = {
      grantsLength: grants?.length || 0,
      selectedGrantId: selectedGrant?.id || 0,
      budgetItemsIds: budgetItems.map(item => item.id).sort().join(',')
    };
    
    // 状態が変わった場合のみ更新
    const stateChanged = 
      currentState.grantsLength !== lastMonthColumnsState.grantsLength ||
      currentState.selectedGrantId !== lastMonthColumnsState.selectedGrantId ||
      currentState.budgetItemsIds !== lastMonthColumnsState.budgetItemsIds;
    
    if (!stateChanged) return;
    
    lastMonthColumnsState = currentState;
    
    // 既存のタイマーをクリア
    if (monthColumnsTimeout) {
      clearTimeout(monthColumnsTimeout);
    }
    
    monthColumnsTimeout = setTimeout(() => {
      debug.log('📅 月列更新:', {
        grants: grants?.length,
        selectedGrant: selectedGrant?.name,
        budgetItems: budgetItems.length
      });
      
      const newMonthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
      if (JSON.stringify(monthColumns) !== JSON.stringify(newMonthColumns)) {
        monthColumns = newMonthColumns;
        debug.log('月列が変更されました:', monthColumns.length, '個の月');
        // テーブル更新処理はBudgetItemTableコンポーネント内で自動実行
      }
      
      monthColumnsTimeout = null;
    }, 150);
  }
  
  $: updateMonthColumns();
  $: debug.log('selectedGrant:', selectedGrant);

  // monthColumnsとスケジュール更新は統合された関数で処理

  // インポート機能
  function openImportModal() {
    importFile = null;
    importPreview = [];
    importError = '';
    importProgress = 0;
    isImporting = false;
    showImportModal = true;
  }

  function downloadSampleCSV() {
    if (importType === 'grants') {
      // 助成金ファイルのサンプル
      const sampleData = `助成金名,助成金コード,総額,開始日,終了日,ステータス
"WAM補助金","WAM2025","7000000","2025-04-01","2026-03-31","進行中"
"赤い羽根助成金","AKA2025","2000000","2025-06-01","2026-05-31","進行中"`;
      
      const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sample_grants.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // 予算項目ファイルのサンプル
      const sampleData = `助成金コード,予算項目名,予算額,カテゴリ,備考
"WAM2025","人件費","3000000","人件費","職員給与・賞与"
"WAM2025","消耗品費","500000","消耗品","事務用品等"
"AKA2025","活動費","1500000","活動費","イベント開催費用"`;
      
      const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sample_budget_items.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) {
      importFile = null;
      importPreview = [];
      return;
    }

    if (!file.name.endsWith('.csv')) {
      importError = 'CSVファイルを選択してください';
      return;
    }

    importFile = file;
    importError = '';
    parseCSVFile(file);
  }

  async function parseCSVFile(file: File) {
    try {
      const text = await file.text();
      debug.log('ファイル内容:', text);
      const lines = text.split('\n').filter(line => line.trim());
      debug.log('行数:', lines.length);
      
      if (lines.length < 2) {
        importError = 'CSVファイルにデータが含まれていません';
        return;
      }

      debug.log('ヘッダー行:', lines[0]);

      // ヘッダー行をスキップして解析
      const dataLines = lines.slice(1);
      const preview = [];

      if (importType === 'grants') {
        // 助成金CSVの解析
        for (const line of dataLines) {
          const columns = parseCSVLine(line);
          debug.log('CSV行:', line);
          debug.log('解析されたカラム数:', columns.length, 'カラム内容:', columns);
          
          if (columns.length >= 6) {
            const grant = {
              name: columns[0]?.trim() || '',
              grantCode: columns[1]?.trim() || null,
              totalAmount: parseAmount(columns[2]),
              startDate: parseDate(columns[3]),
              endDate: parseDate(columns[4]),
              status: parseStatus(columns[5])
            };
            preview.push(grant);
          } else {
            console.warn('カラム数不足でスキップ:', line);
          }
        }
      } else {
        // 予算項目CSVの解析
        for (const line of dataLines) {
          const columns = parseCSVLine(line);
          debug.log('CSV行:', line);
          debug.log('解析されたカラム数:', columns.length, 'カラム内容:', columns);
          
          if (columns.length >= 3) {
            const budgetItem = {
              grantCode: columns[0]?.trim() || '',
              name: columns[1]?.trim() || '',
              budgetedAmount: parseAmount(columns[2]),
              category: columns[3]?.trim() || null,
              note: columns[4]?.trim() || null
            };
            preview.push(budgetItem);
          } else {
            console.warn('カラム数不足でスキップ:', line);
          }
        }
      }

      importPreview = preview;
      debug.log('Import preview:', importPreview);
      
    } catch (err) {
      importError = 'CSVファイルの解析に失敗しました: ' + (err instanceof Error ? err.message : String(err));
      console.error('CSV parse error:', err);
    }
  }

  // CSV処理関数は grants-helpers.ts に移動済み

  async function createFullMonthSchedule(budgetItemId: number, grant: any) {
    try {
      if (!grant.startDate || !grant.endDate) {
        console.warn('助成金の期間が設定されていないため、月別スケジュールをスキップします');
        return;
      }

      // 助成金の期間内の全ての月を生成
      const months = generateMonthsFromGrant(grant);
      const schedules = months.map(month => ({
        year: month.year,
        month: month.month,
        isActive: true
      }));

      const response = await fetch(`${base}/api/budget-items/${budgetItemId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules })
      });

      if (!response.ok) {
        console.warn(`予算項目ID${budgetItemId}の月別スケジュール作成に失敗`);
      } else {
        debug.log(`予算項目ID${budgetItemId}に${schedules.length}ヶ月のスケジュールを作成しました`);
      }
    } catch (err) {
      console.error('月別スケジュール作成エラー:', err);
    }
  }

  async function executeImport() {
    if (!importPreview.length) return;

    isImporting = true;
    importError = '';
    importProgress = 0;

    try {
      if (importType === 'grants') {
        // 助成金のインポート
        for (let i = 0; i < importPreview.length; i++) {
          const grantData = importPreview[i];
          
          const grantResponse = await fetch(`${base}/api/grants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: grantData.name,
              grantCode: grantData.grantCode,
              totalAmount: grantData.totalAmount,
              startDate: grantData.startDate,
              endDate: grantData.endDate,
              status: grantData.status
            })
          });

          const grantResult = await grantResponse.json();
          if (!grantResult.success) {
            throw new Error(`助成金「${grantData.name}」の作成に失敗: ${grantResult.error}`);
          }

          importProgress = Math.round(((i + 1) / importPreview.length) * 100);
        }
      } else {
        // 予算項目のインポート
        for (let i = 0; i < importPreview.length; i++) {
          const budgetItemData = importPreview[i];
          
          // 助成金コードから助成金IDを取得
          const grant = grants.find(g => g.grantCode === budgetItemData.grantCode);
          if (!grant) {
            console.warn(`助成金コード「${budgetItemData.grantCode}」に対応する助成金が見つかりません`);
            continue;
          }

          const budgetResponse = await fetch(`${base}/api/grants/${grant.id}/budget-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: budgetItemData.name,
              budgetedAmount: budgetItemData.budgetedAmount,
              category: budgetItemData.category,
              note: budgetItemData.note
            })
          });

          const budgetResult = await budgetResponse.json();
          if (!budgetResult.success) {
            console.warn(`予算項目「${budgetItemData.name}」の作成に失敗: ${budgetResult.error}`);
          } else if (budgetResult.budgetItem?.id) {
            // 助成金の期間に合わせて全ての月を自動選択してスケジュールを作成
            await createFullMonthSchedule(budgetResult.budgetItem.id, grant);
          }

          importProgress = Math.round(((i + 1) / importPreview.length) * 100);
        }
      }

      showImportModal = false;
      await loadGrants();
      await loadAllBudgetItems();
      
    } catch (err) {
      importError = err instanceof Error ? err.message : String(err);
    } finally {
      isImporting = false;
    }
  }

</script>

<svelte:head>
  <title>助成金管理 - nagaiku budget</title>
</svelte:head>

<div class="w-full max-w-none">
  
  <div class="flex justify-between items-center mb-3">
    <h1 class="text-3xl font-bold text-gray-900">助成金管理</h1>
    <div class="flex items-center gap-3">
      <button 
        on:click={openImportModal}
        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
        </svg>
        インポート
      </button>
      <button 
        on:click={() => openGrantForm()}
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        新規助成金
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {error}
    </div>
  {/if}

  <!-- 上部: 助成金一覧 -->
  <div class="bg-white shadow rounded-lg mb-1">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">助成金一覧</h2>
        
        <!-- フィルターコントロール -->
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="showCompleted" 
              bind:checked={showCompletedGrants}
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label for="showCompleted" class="text-sm font-medium text-gray-700">
              終了済みを表示
            </label>
          </div>
          
          <div class="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="showReported" 
              bind:checked={showReportedGrants}
              class="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
            />
            <label for="showReported" class="text-sm font-medium text-gray-700">
              報告済みを表示
            </label>
          </div>
          
          {#if (showCompletedGrants || showReportedGrants) && getAvailableYears(grants).length > 0}
            <div class="flex items-center gap-2">
              <label for="yearFilter" class="text-sm text-gray-600">年度:</label>
              <select 
                id="yearFilter"
                bind:value={filterYear}
                class="text-sm border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value="">全て</option>
                {#each getAvailableYears(grants) as year}
                  <option value={year}>{year}年</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <div class="p-6">
      
      {#if loading}
        <div class="flex justify-center items-center h-32">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      {:else if grants.length === 0}
        <div class="text-center text-gray-500 py-8">
          <p>助成金が登録されていません</p>
          <button 
            on:click={() => openGrantForm()}
            class="mt-2 text-blue-600 hover:text-blue-800"
          >
            最初の助成金を作成
          </button>
        </div>
      {:else}
        <!-- 稼働中の助成金（水平スクロール） -->
        {#if grants.filter(g => g.status === 'active').length > 0}
          <div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {#each grants.filter(g => g.status === 'active') as grant}
                <GrantCard
                  {grant}
                  isSelected={selectedGrant?.id === grant.id}
                  {statusLabels}
                  {statusColors}
                  on:select={() => selectGrant(grant)}
                  on:edit={() => openGrantForm(grant)}
                  on:delete={() => openDeleteConfirm('grant', grant)}
                />
              {/each}
            </div>
          </div>
        {/if}

        <!-- 終了済みの助成金 -->
        {#if showCompletedGrants}
          {@const filteredCompletedGrants = getFilteredCompletedGrants(grants)}
          {#if filteredCompletedGrants.length > 0}
            <div class="mb-4">
              <h3 class="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <div class="w-2 h-2 bg-yellow-400 rounded-full"></div>
                終了済み（報告未完了）
                <span class="text-xs bg-yellow-200 px-2 py-0.5 rounded-full">
                  {filteredCompletedGrants.length}件
                </span>
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each filteredCompletedGrants as grant}
                  <GrantCard
                    {grant}
                    isSelected={selectedGrant?.id === grant.id}
                    {statusLabels}
                    {statusColors}
                    opacity="opacity-75"
                    on:select={() => selectGrant(grant)}
                    on:edit={() => openGrantForm(grant)}
                    on:delete={() => openDeleteConfirm('grant', grant)}
                  />
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        <!-- 報告済みの助成金 -->
        {#if showReportedGrants}
          {@const filteredReportedGrants = getFilteredReportedGrants(grants)}
          {#if filteredReportedGrants.length > 0}
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                報告済み（確定）
                <span class="text-xs bg-green-200 px-2 py-0.5 rounded-full">
                  {filteredReportedGrants.length}件
                </span>
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each filteredReportedGrants as grant}
                  <GrantCard
                    {grant}
                    isSelected={selectedGrant?.id === grant.id}
                    {statusLabels}
                    {statusColors}
                    opacity="opacity-60"
                    on:select={() => selectGrant(grant)}
                    on:edit={() => openGrantForm(grant)}
                    on:delete={() => openDeleteConfirm('grant', grant)}
                  />
                {/each}
              </div>
            </div>
          {/if}
        {/if}
      {/if}
    </div>

  </div>

  <!-- 下部: 予算項目管理 -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-4">
          <h2 class="text-xl font-semibold">予算項目</h2>
          <button 
            on:click={() => openBudgetItemForm()}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            追加
          </button>
        </div>
        
        <div class="flex items-center gap-6">
          {#if selectedGrant}
            <div class="text-right">
              <p class="text-sm text-gray-600">
                <span class="font-medium text-blue-600">{selectedGrant.name}</span> で絞り込み中
                <button 
                  on:click={() => selectGrant(selectedGrant)}
                  class="ml-2 text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  解除
                </button>
              </p>
            </div>
          {/if}
          
        </div>
      </div>
    </div>
    
    <div class="p-1 sm:p-2">
          
          <!-- ソートリセットボタン -->
          {#if budgetItems.length > 0 && sortCriteria.length > 0}
            <div class="mb-3 text-right">
              <button 
                on:click={clearSort}
                class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 border rounded-md transition-colors"
              >
                ソートをリセット
              </button>
            </div>
          {/if}
          
          <div class="mb-4 flex justify-between items-center">
            <div class="text-sm text-gray-600">
              {budgetItems.length}件の予算項目（月別情報も表示、左の列は固定済み）
            </div>
          </div>

          {#if budgetItems.length === 0}
            <div class="text-center text-gray-500 py-8">
              <div class="mb-4">
                <svg class="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
              <p class="text-lg font-medium text-gray-600 mb-2">予算項目がありません</p>
              <p class="text-sm text-gray-500 mb-4">上の「追加」ボタンから最初の予算項目を作成してください</p>
            </div>
          {:else}
            <!-- 月データ表示設定 -->
            <div class="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 class="text-sm font-medium text-gray-700 mb-3">月データ表示設定</h4>
              
              <!-- 表示項目選択 -->
              <div class="flex flex-wrap gap-4 mb-4">
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    bind:checked={showMonthlyBudget}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-600">予算額</span>
                </label>
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    bind:checked={showMonthlyUsed}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-600">使用額</span>
                </label>
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    bind:checked={showMonthlyRemaining}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-600">残額</span>
                </label>
              </div>
              
              <!-- 月絞り込み設定 -->
              <div class="border-t pt-3">
                <h5 class="text-xs font-medium text-gray-600 mb-2">表示月範囲</h5>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">開始</label>
                    <div class="flex gap-1">
                      <select bind:value={monthFilterStartYear} class="text-xs border rounded px-2 py-1 w-16">
                        <option value={2023}>2023</option>
                        <option value={2024}>2024</option>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                      </select>
                      <select bind:value={monthFilterStartMonth} class="text-xs border rounded px-2 py-1 w-12">
                        {#each Array.from({length: 12}, (_, i) => i + 1) as month}
                          <option value={month}>{month}</option>
                        {/each}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">終了</label>
                    <div class="flex gap-1">
                      <select bind:value={monthFilterEndYear} class="text-xs border rounded px-2 py-1 w-16">
                        <option value={2023}>2023</option>
                        <option value={2024}>2024</option>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                      </select>
                      <select bind:value={monthFilterEndMonth} class="text-xs border rounded px-2 py-1 w-12">
                        {#each Array.from({length: 12}, (_, i) => i + 1) as month}
                          <option value={month}>{month}</option>
                        {/each}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
            
            <div class="budget-table-container">
              <BudgetItemTable
                {budgetItems}
                {grants}
                {selectedGrant}
                {showMonthlyBudget}
                {showMonthlyUsed}
                {showMonthlyRemaining}
                {monthFilterStartYear}
                {monthFilterStartMonth}
                {monthFilterEndYear}
                {monthFilterEndMonth}
                {budgetItemSchedules}
                {schedulesLoaded}
                on:edit={(e) => openBudgetItemForm(e.detail.item)}
                on:delete={(e) => openDeleteConfirm('budgetItem', e.detail.item, e.detail.item.grantId)}
              />
            </div>
          {/if}
        </div>
    </div>
  </div>

<!-- 助成金作成・編集モーダル -->
<GrantFormComponent
  show={showGrantForm}
  bind:grantForm
  on:save={async () => {
    showGrantForm = false;
    await loadGrants();
    await loadAllBudgetItems();
    // 絞り込み状態を維持
    if (selectedGrant) {
      budgetItems = getFilteredBudgetItems(allBudgetItems.filter(item => item.grantId === selectedGrant.id));
    } else {
      budgetItems = getFilteredBudgetItems(allBudgetItems);
    }
  }}
  on:close={() => showGrantForm = false}
/>

<!-- 予算項目作成・編集モーダル -->
<BudgetItemFormComponent
  show={showBudgetItemForm}
  bind:budgetItemForm
  {grants}
  {budgetItems}
  bind:selectedMonths
  on:save={async () => {
    showBudgetItemForm = false;
    await loadAllBudgetItems();
    // 絞り込み状態を維持
    if (selectedGrant) {
      budgetItems = getFilteredBudgetItems(allBudgetItems.filter(item => item.grantId === selectedGrant.id));
    } else {
      budgetItems = getFilteredBudgetItems(allBudgetItems);
    }
    // 予算項目更新後のテーブル更新
    if (budgetItems.length > 0) {
      debug.log('🔄 予算項目保存後のテーブル更新実行');
    }
  }}
  on:close={() => showBudgetItemForm = false}
/>

<!-- インポートモーダル -->
{#if showImportModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-medium text-gray-900 mb-4">助成金データインポート</h3>
      
      {#if !isImporting}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">インポートタイプ</label>
          <div class="flex gap-4 mb-4">
            <label class="flex items-center">
              <input 
                type="radio" 
                bind:group={importType} 
                value="grants"
                class="mr-2"
                on:change={() => { importFile = null; importPreview = []; importError = ''; }}
              />
              助成金
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                bind:group={importType} 
                value="budgetItems"
                class="mr-2"
                on:change={() => { importFile = null; importPreview = []; importError = ''; }}
              />
              予算項目
            </label>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">CSVファイルを選択</label>
          <input 
            type="file" 
            accept=".csv"
            on:change={handleFileSelect}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div class="mt-2 flex justify-between items-center">
            <p class="text-sm text-gray-500">
              {#if importType === 'grants'}
                助成金CSV形式: 助成金名, 助成金コード, 総額, 開始日, 終了日, ステータス
              {:else}
                予算項目CSV形式: 助成金コード, 予算項目名, 予算額, カテゴリ, 備考
              {/if}
            </p>
            <button 
              type="button"
              on:click={downloadSampleCSV}
              class="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              サンプルCSVダウンロード
            </button>
          </div>
        </div>

        {#if importError}
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {importError}
          </div>
        {/if}

        {#if importPreview.length > 0}
          <div class="mb-6">
            <h4 class="text-md font-medium text-gray-800 mb-3">
              インポートプレビュー ({importPreview.length}件の{importType === 'grants' ? '助成金' : '予算項目'})
            </h4>
            <div class="max-h-96 overflow-y-auto border border-gray-200 rounded">
              {#if importType === 'grants'}
                {#each importPreview as grant, index}
                  <div class="p-4 border-b border-gray-100 {index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
                    <div class="flex justify-between items-start mb-2">
                      <div>
                        <h5 class="font-medium text-gray-900">
                          {grant.grantCode ? `[${grant.grantCode}] ` : ''}{grant.name}
                        </h5>
                        <div class="text-sm text-gray-600">
                          {grant.startDate || '開始日未設定'} 〜 {grant.endDate || '終了日未設定'} | 
                          {formatAmount(grant.totalAmount)} | 
                          {statusLabels[grant.status]}
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              {:else}
                {#each importPreview as budgetItem, index}
                  <div class="p-4 border-b border-gray-100 {index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
                    <div class="flex justify-between items-start mb-2">
                      <div>
                        <h5 class="font-medium text-gray-900">
                          [{budgetItem.grantCode}] {budgetItem.name}
                        </h5>
                        <div class="text-sm text-gray-600">
                          {formatAmount(budgetItem.budgetedAmount)}
                          {budgetItem.category ? ` | ${budgetItem.category}` : ''}
                          {budgetItem.note ? ` | ${budgetItem.note}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}

        <div class="flex justify-end space-x-3">
          <button 
            type="button"
            on:click={() => showImportModal = false}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            キャンセル
          </button>
          {#if importPreview.length > 0}
            <button 
              type="button"
              on:click={executeImport}
              class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
            >
              インポート実行
            </button>
          {/if}
        </div>
      {:else}
        <div class="text-center py-8">
          <div class="mb-4">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg class="w-8 h-8 text-green-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </div>
          </div>
          <h4 class="text-lg font-medium text-gray-900 mb-2">インポート中...</h4>
          <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div class="bg-green-600 h-2 rounded-full transition-all duration-300" style="width: {importProgress}%"></div>
          </div>
          <p class="text-sm text-gray-600">{importProgress}% 完了</p>
          
          {#if importError}
            <div class="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {importError}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- デバッグ情報コンポーネント -->

<!-- 削除確認ダイアログ -->
<DeleteConfirmDialog 
  open={showDeleteConfirm}
  title="削除確認"
  itemName={deleteTarget?.name || ''}
  itemType={deleteTarget?.type === 'grant' ? '助成金' : '予算項目'}
  relatedDataWarning={deleteTarget?.type === 'grant' 
    ? '関連する予算項目、割当データ、月割りスケジュールもすべて削除されます。'
    : '関連する割当データ、月割りスケジュールもすべて削除されます。'
  }
  loading={deleteLoading}
  on:cancel={closeDeleteConfirm}
  on:confirm={handleDeleteConfirm}
/>

<style>
  /* ページ全体のスクロール設定 */
  :global(html, body) {
    overflow-y: auto !important;
    height: 100%;
  }

  .budget-table-container {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: visible;
    width: 100%;
    max-width: none;
    min-height: 400px;
  }

  /* レスポンシブ対応：大きい画面での調整 */
  @media (min-width: 1400px) {
    .budget-table-container {
      min-height: calc(100vh - 180px);
    }
  }

  @media (min-width: 1920px) {
    .budget-table-container {
      min-height: calc(100vh - 150px);
    }
  }
  
  /* wx-svelte-gridのカスタムスタイル */
  :global(.tabulator-table) {
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  :global(.tabulator .tabulator-header) {
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
    font-weight: 600;
    font-size: 0.875rem;
  }
  
  :global(.tabulator .tabulator-col) {
    background: #f9fafb;
  }
  
  :global(.tabulator .tabulator-cell) {
    border-right: 1px solid #f3f4f6;
    padding: 4px 8px;
    font-size: 0.875rem;
    vertical-align: top;
    line-height: 1.2;
  }
  
  :global(.tabulator .tabulator-row) {
    min-height: 60px;
    height: 60px;
  }

  :global(.tabulator .tabulator-row:hover) {
    background: #f9fafb !important;
  }
  
  :global(.tabulator .tabulator-row.tabulator-row-odd) {
    background: #ffffff;
  }
  
  :global(.tabulator .tabulator-row.tabulator-row-even) {
    background: #fafafa;
  }
  
  /* 固定列のスタイル */
  :global(.tabulator .tabulator-frozen) {
    border-right: 2px solid #d1d5db !important;
    background: #f8fafc !important;
  }
  
  /* 操作ボタンのスタイル */
  :global(.tabulator button) {
    background: none;
    border: none;
    color: #2563eb;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  :global(.tabulator button:hover) {
    background: #dbeafe;
    color: #1d4ed8;
  }
</style>