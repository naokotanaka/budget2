<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { getPeriodColor, getAmountColor } from '$lib/utils/color-rules';
  import { TabulatorFull as Tabulator } from 'tabulator-tables';
  import type { ColumnDefinition } from 'tabulator-tables';
  import 'tabulator-tables/dist/css/tabulator.min.css';
  import SimpleMonthCheckboxes from '$lib/components/SimpleMonthCheckboxes.svelte';
  import DebugInfo from '$lib/components/DebugInfo.svelte';

  interface Grant {
    id: number;
    name: string;
    grantCode?: string;
    totalAmount?: number;
    startDate?: string;
    endDate?: string;
    status: 'in_progress' | 'completed' | 'reported';
    budgetItemsCount?: number;
    usedAmount?: number;
  }

  interface BudgetItem {
    id: number;
    name: string;
    category?: string;
    budgetedAmount?: number;
    usedAmount?: number;
    note?: string;
  }

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
  let showMonthlyBudget = true;  // 予算額表示
  let showMonthlyUsed = true;    // 使用額表示
  let showMonthlyRemaining = true; // 残額表示
  
  // 月データ表示制御をwindowオブジェクトに設定（フォーマッター内からアクセス可能にする）
  $: {
    if (typeof window !== 'undefined') {
      (window as any).monthDisplaySettings = {
        showMonthlyBudget,
        showMonthlyUsed,
        showMonthlyRemaining
      };
    }
  }

  // 新規・編集用フォームデータ
  let grantForm: Partial<Grant> = {};
  let budgetItemForm: Partial<BudgetItem> = {};

  const statusLabels = {
    in_progress: '進行中',
    completed: '終了',
    reported: '報告済み'
  };

  const statusColors = {
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-yellow-100 text-yellow-800',
    reported: 'bg-green-100 text-green-800'
  };

  onMount(async () => {
    console.log('🚀 onMount開始');
    await loadGrants();
    console.log('🚀 助成金ロード完了');
    await loadAllBudgetItems();
    console.log('🚀 予算項目ロード完了');
    
    // 複数回にわたって初期化を確実に実行
    const initializeComplete = () => {
      console.log('🚀 初期化最終段階:', {
        grants: grants.length,
        budgetItems: budgetItems.length,
        monthColumns: monthColumns.length,
        tableElement: !!tableElement
      });
      
      if (grants.length > 0 && budgetItems.length > 0) {
        // 月列生成
        if (monthColumns.length === 0) {
          monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
          console.log('🔄 初期monthColumns生成完了:', monthColumns.length);
        }
        
        // スケジュール取得強制実行
        if (budgetItems.length > 0) {
          console.log('🔄 初期スケジュール取得開始');
          handleScheduleLoad();
        }
        
        // テーブル初期化
        if (tableElement && monthColumns.length > 0) {
          console.log('🔄 初期テーブル初期化開始');
          handleTableUpdate();
        } else if (!tableElement) {
          console.log('⚠️ tableElement が見つかりません、再試行します');
          // DOM要素がまだ準備できていない場合、少し待ってから再試行
          setTimeout(initializeComplete, 100);
        }
      }
    };

    // 複数のタイミングで初期化を試行
    setTimeout(initializeComplete, 50);
    setTimeout(initializeComplete, 200);
    setTimeout(initializeComplete, 500);
    
    // 外クリックでドロップダウンを閉じる
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      // テーブルのクリーンアップ
      if (table) {
        table.destroy();
        table = null;
      }
    };
  });

  // 月列とbudgetItemsのリアクティブ更新（無限ループ防止付き）
  $: if (grants.length > 0 && budgetItems.length > 0) {
    console.log('🔄 月列・テーブル更新条件チェック:', {
      grants: grants.length,
      budgetItems: budgetItems.length,
      monthColumns: monthColumns.length
    });
    
    // monthColumnsが0の場合のみ自動生成
    if (monthColumns.length === 0) {
      console.log('🔄 月列が未生成、自動生成開始');
      monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
      console.log('🔄 月列生成完了:', monthColumns.length, '件');
    }
  }
  
  // 月データ表示設定変更処理を関数として定義
  let lastDisplaySettings = { showMonthlyBudget: true, showMonthlyUsed: true, showMonthlyRemaining: true };
  
  function handleDisplaySettingsChange() {
    const currentSettings = { showMonthlyBudget, showMonthlyUsed, showMonthlyRemaining };
    const changed = JSON.stringify(currentSettings) !== JSON.stringify(lastDisplaySettings);
    
    if (changed && table) {
      console.log('🔄 月データ表示設定変更、再描画:', currentSettings);
      lastDisplaySettings = { ...currentSettings };
      table.redraw(true);
    }
  }
  
  // 表示設定の変更を監視
  $: {
    showMonthlyBudget, showMonthlyUsed, showMonthlyRemaining;
    if (table) {
      // 少し遅延させて処理
      setTimeout(handleDisplaySettingsChange, 10);
    }
  }
  
  // テーブル要素が準備できたらテーブル初期化を実行  
  $: if (tableElement && budgetItems.length > 0 && monthColumns.length > 0) {
    console.log('🔄 テーブル要素準備完了、初期化開始:', {
      tableElement: !!tableElement,
      budgetItems: budgetItems.length,
      monthColumns: monthColumns.length,
      tableExists: !!table,
      tableInitialized: table?.initialized
    });
    
    // テーブルがまだ初期化されていない場合のみ
    if (!table || !table.initialized) {
      handleTableUpdate();
    }
  }

  async function loadGrants() {
    loading = true;
    try {
      const url = `${base}/api/grants`;
      console.log('🔍 Fetching grants from URL:', url);
      console.log('🔍 base path:', base);
      const response = await fetch(url);
      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response OK:', response.ok);
      const data = await response.json();
      console.log('🔍 Response data:', data);
      
      if (data.success) {
        grants = data.grants || [];
        console.log('助成金取得完了:', grants.length, '件');
        
        // 月列を生成（ただし予算項目が既にロード済みの場合のみ）
        if (budgetItems.length > 0) {
          monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
          console.log('助成金ロード後のmonthColumns:', monthColumns.length, '件');
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
    if (selectedGrant?.id === grant.id) {
      // 同じ助成金をクリックした場合は絞り込みを解除
      selectedGrant = null;
      budgetItems = getFilteredBudgetItems(allBudgetItems);
    } else {
      // 助成金で絞り込み
      selectedGrant = grant;
      budgetItems = getFilteredBudgetItems(allBudgetItems.filter(item => item.grantId === grant.id));
    }
  }

  // 終了・報告ステータスを除外するフィルター関数
  function getFilteredBudgetItems(items: any[]) {
    console.log('getFilteredBudgetItems - 入力:', items.length, '件');
    console.log('最初の3件のデータ:', items.slice(0, 3));
    
    // 🚨 一時的にフィルタリングを無効化してテスト
    console.log('⚠️ フィルタリングを一時的に無効化中 - 全項目を返します');
    return items;
    
    const filtered = items.filter(item => {
      const status = item.grantStatus || item.grant?.status;
      console.log(`項目${item.id}(${item.name}) - grantStatus: ${item.grantStatus}, grant.status: ${item.grant?.status}, 判定status: ${status}`);
      
      // ステータスが未定義の場合は表示（デバッグ用）
      if (!status) {
        console.log(`項目${item.id}(${item.name}) - ステータス未定義、表示`);
        return true;
      }
      
      // 基本表示: 進行中のみ
      if (status === 'in_progress') {
        console.log(`項目${item.id}(${item.name}) - 進行中、表示`);
        return true;
      }
      
      // 終了済み表示がONの場合、終了ステータスも表示
      if (showCompletedGrants && status === 'completed') {
        console.log(`項目${item.id}(${item.name}) - 終了済み表示ON、表示`);
        return true;
      }
      
      // 報告済み表示がONの場合、報告済みステータスも表示
      if (showReportedGrants && status === 'reported') {
        console.log(`項目${item.id}(${item.name}) - 報告済み表示ON、表示`);
        return true;
      }
      
      console.log(`項目${item.id}(${item.name}) - 条件に合致せず、非表示`);
      return false;
    });
    
    console.log('getFilteredBudgetItems - 出力:', filtered.length, '件');
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
    console.log('🔍 loadAllBudgetItems開始');
    try {
      const response = await fetch(`${base}/api/budget-items`);
      console.log('🔍 APIレスポンス受信:', response.status, response.statusText);
      const data = await response.json();
      console.log('🔍 APIデータ解析:', data.success, data.budgetItems?.length);
      
      if (data.success) {
        allBudgetItems = data.budgetItems || [];
        console.log('全予算項目取得完了:', allBudgetItems.length, '件');
        console.log('全予算項目の例（最初の3件）:', allBudgetItems.slice(0, 3));
        
        // 初期表示は全項目（終了・報告ステータス除く）
        if (!selectedGrant) {
          console.log('🔍 初期フィルター処理開始:', {
            selectedGrant: selectedGrant,
            showCompletedGrants: showCompletedGrants,
            showReportedGrants: showReportedGrants
          });
          // 初期フィルター処理を有効化
          budgetItems = getFilteredBudgetItems(allBudgetItems);
          console.log('🔍 初期フィルター処理完了:', budgetItems.length, '件');
          
          // 予算項目更新後にスケジュール取得を実行
          if (budgetItems.length > 0) {
            await handleScheduleLoad();
          }
        }
        console.log('フィルタ後予算項目:', budgetItems.length, '件');
        console.log('予算項目の例（最初の3件）:', budgetItems.slice(0, 3));
        
        // 月列を生成（ただし既にデータがロード済みの場合のみ）
        if (grants.length > 0) {
          monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
          console.log('予算項目ロード後のmonthColumns:', monthColumns.length, '件');
        }
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
      grantForm = { status: 'in_progress' };
    }
    showGrantForm = true;
  }

  async function openBudgetItemForm(budgetItem?: BudgetItem) {
    budgetItemForm = budgetItem ? { ...budgetItem } : {};
    
    if (budgetItem?.id) {
      // 既存項目の場合、スケジュールデータを読み込み
      await loadBudgetItemSchedule(budgetItem.id);
    } else {
      // 新規作成時は、選択された助成金があれば全月をデフォルトでチェック
      if (selectedGrant && availableMonths.length > 0) {
        selectedMonths = new Set(availableMonths.map(m => getMonthKey(m.year, m.month)));
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
      console.log('スケジュールデータなし:', err);
      selectedMonths.clear();
    }
  }

  async function saveGrant() {
    try {
      const url = grantForm.id ? `${base}/api/grants/${grantForm.id}` : `${base}/api/grants`;
      const method = grantForm.id ? 'PUT' : 'POST';
      
      // 日付フィールドを適切な形式に変換してから送信
      const formData = {
        ...grantForm,
        startDate: formatDateForAPI(grantForm.startDate),
        endDate: formatDateForAPI(grantForm.endDate)
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showGrantForm = false;
        await loadGrants();
      } else {
        error = data.error || '助成金の保存に失敗しました';
      }
    } catch (err) {
      error = '助成金の保存中にエラーが発生しました';
      console.error('Save grant error:', err);
    }
  }

  async function saveBudgetItem() {
    if (!budgetItemForm.grantId) {
      error = '助成金を選択してください';
      return;
    }
    
    try {
      const url = budgetItemForm.id ? 
        `${base}/api/grants/${budgetItemForm.grantId}/budget-items/${budgetItemForm.id}` : 
        `${base}/api/grants/${budgetItemForm.grantId}/budget-items`;
      const method = budgetItemForm.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetItemForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // スケジュールデータも保存
        if (data.budgetItem?.id) {
          await saveBudgetItemSchedule(data.budgetItem.id);
        }
        
        showBudgetItemForm = false;
        await loadAllBudgetItems();
        // 絞り込み状態を維持
        if (selectedGrant) {
          budgetItems = getFilteredBudgetItems(allBudgetItems.filter(item => item.grantId === selectedGrant.id));
        } else {
          budgetItems = getFilteredBudgetItems(allBudgetItems);
        }
      } else {
        error = data.error || '予算項目の保存に失敗しました';
      }
    } catch (err) {
      error = '予算項目の保存中にエラーが発生しました';
      console.error('Save budget item error:', err);
    }
  }

  async function saveBudgetItemSchedule(budgetItemId: number) {
    try {
      const schedules = Array.from(selectedMonths).map(monthKey => {
        const [year, month] = monthKey.split('-');
        return {
          year: parseInt(year),
          month: parseInt(month),
          isActive: true
        };
      });

      const response = await fetch(`${base}/api/budget-items/${budgetItemId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules })
      });

      if (!response.ok) {
        console.error('スケジュール保存失敗');
      }
    } catch (err) {
      console.error('スケジュール保存エラー:', err);
    }
  }

  // 複数条件ソート機能
  let sortCriteria: Array<{field: string, direction: 'asc' | 'desc', priority: number}> = [];

  // wx-svelte-grid関連
  // Tabulator用の変数
  let tableElement: HTMLDivElement;
  let table: Tabulator | null = null;
  let columns: ColumnDefinition[] = [];
  let baseColumns: ColumnDefinition[] = [];
  let tableData: any[] = [];
  let monthColumns: Array<{year: number, month: number, label: string}> = [];
  let isTableInitializing = false;

  // カテゴリ管理
  let availableCategories: string[] = [];
  let showCategoryDropdown = false;

  // 月別スケジュール管理
  let availableMonths: Array<{year: number, month: number, label: string}> = [];
  let selectedMonths: Set<string> = new Set(); // "2025-04" 形式
  
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
    
    console.log('📊 handleBudgetItemsUpdate:', {
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
          console.log('📊 カテゴリ更新実行 (lengthChanged)');
          updateAvailableCategories();
        }
        // IDが変更された場合はスケジュール取得
        if (idsChanged) {
          console.log('📊 スケジュール取得実行 (idsChanged)');
          handleScheduleLoad();
        }
        // テーブル更新処理は別の関数で実行
        console.log('📊 テーブル更新実行');
        handleTableUpdate();
      }, 200);
    }
  }
  
  $: handleBudgetItemsUpdate();

  // 終了済みフィルター変更時の処理
  $: if (showCompletedGrants !== undefined && allBudgetItems.length > 0) {
    console.log('終了済みフィルター変更:', showCompletedGrants);
    refreshBudgetItems().catch(console.error);
  }

  // 報告済みフィルター変更時の処理  
  $: if (showReportedGrants !== undefined && allBudgetItems.length > 0) {
    console.log('報告済みフィルター変更:', showReportedGrants);
    refreshBudgetItems().catch(console.error);
  }

  // 選択助成金変更時の処理
  $: if (selectedGrant !== undefined && allBudgetItems.length > 0) {
    console.log('選択助成金変更:', selectedGrant?.name);
    refreshBudgetItems().catch(console.error);
  }

  async function refreshBudgetItems() {
    console.log('🔄 refreshBudgetItems実行:', {
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
    console.log('🔄 フィルター後予算項目数:', budgetItems.length);
  }
  
  function selectCategory(category: string) {
    budgetItemForm.category = category;
    showCategoryDropdown = false;
  }
  
  function filterCategories(input: string) {
    if (!input) return availableCategories;
    return availableCategories.filter(cat => 
      cat.toLowerCase().includes(input.toLowerCase())
    );
  }
  
  // ドロップダウン外クリックで閉じる
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.category-dropdown')) {
      showCategoryDropdown = false;
    }
  }

  // 助成金期間から利用可能な月を生成
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
      months.push({
        year,
        month,
        label: `${year.toString().slice(-2)}/${month.toString().padStart(2, '0')}`
      });
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
  let budgetItemSchedules = new Map(); // budgetItemId -> schedules
  let schedulesLoaded = false; // スケジュール読み込み完了フラグ

  async function loadBudgetItemSchedules() {
    console.log('📅 スケジュール取得開始:', budgetItems.length, '件');
    schedulesLoaded = false;
    const newSchedules = new Map();
    
    for (const item of budgetItems) {
      try {
        console.log(`📅 項目ID${item.id}のスケジュール取得中...`);
        const response = await fetch(`${base}/api/budget-items/${item.id}/schedule`);
        console.log(`📅 項目ID${item.id}のレスポンス:`, response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`📅 項目ID${item.id}のデータ:`, data);
          
          if (data.success && data.schedules.length > 0) {
            const months = data.schedules.map(s => `${s.year.toString().slice(-2)}/${s.month.toString().padStart(2, '0')}`);
            newSchedules.set(item.id, months);
            console.log(`📅 項目ID${item.id}のスケジュール設定:`, months);
          } else {
            console.log(`📅 項目ID${item.id}はスケジュールデータなし`);
          }
        } else {
          console.warn(`📅 項目ID${item.id}のスケジュール取得失敗:`, response.status);
        }
      } catch (err) {
        console.error(`📅 項目ID${item.id}のスケジュール取得エラー:`, err);
      }
    }
    
    // 一度だけMapを更新（リアクティブ更新を最小化）
    budgetItemSchedules = newSchedules;
    schedulesLoaded = true; // 読み込み完了をマーク
    console.log('📅 スケジュールデータ読み込み完了:', budgetItemSchedules.size, '件', Array.from(budgetItemSchedules.entries()));
    
    // スケジュール取得完了後に月列生成とテーブル更新を実行
    setTimeout(() => {
      console.log('📅 スケジュール取得後の月列とテーブル更新実行');
      // 月列を再生成（スケジュールデータに基づいて）
      console.log('📅 月列生成前の状態:', {
        monthColumnsLength: monthColumns.length,
        schedulesLoaded,
        grantsLength: grants.length,
        budgetItemsLength: budgetItems.length
      });
      
      monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
      console.log('📅 スケジュール取得後の月列生成完了:', monthColumns.length, '件');
      console.log('📅 生成された月列:', monthColumns);
      handleTableUpdate();
    }, 100);
  }

  // スケジュール取得処理（統合版：handleBudgetItemsUpdate内で実行）
  let scheduleLoadTimeout: ReturnType<typeof setTimeout> | null = null;
  
  async function handleScheduleLoad() {
    console.log('📅 handleScheduleLoad呼び出し:', budgetItems.length, '件');
    
    if (budgetItems.length === 0) {
      console.log('📅 予算項目が0件のためスケジュール取得をスキップ');
      return;
    }
    
    // 既存のタイマーをクリア
    if (scheduleLoadTimeout) {
      console.log('📅 既存のスケジュールタイマーをクリア');
      clearTimeout(scheduleLoadTimeout);
    }
    
    // デバウンス処理で重複実行を防止
    scheduleLoadTimeout = setTimeout(async () => {
      console.log('📅 デバウンス後のスケジュール取得開始:', budgetItems.length, '件');
      await loadBudgetItemSchedules();
      scheduleLoadTimeout = null;
    }, 500);
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

  // 統合されたテーブル更新処理
  let tableUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastTableState = {
    budgetItemsIds: '',
    monthColumnsLength: 0,
    schedulesLoaded: false
  };
  
  function handleTableUpdate() {
    console.log('🔧 handleTableUpdate 呼び出し:', {
      tableElement: !!tableElement,
      loading: loading,
      budgetItems: budgetItems.length,
      monthColumns: monthColumns.length
    });
    
    if (!tableElement) {
      console.log('⚠️ tableElement が見つかりません');
      return;
    }
    
    if (loading) {
      console.log('⚠️ ローディング中のためスキップ');
      return;
    }
    
    if (budgetItems.length === 0) {
      console.log('⚠️ 予算項目が0件のためスキップ');
      return;
    }
    
    const currentState = {
      budgetItemsIds: budgetItems.map(item => item.id).sort().join(','),
      monthColumnsLength: monthColumns.length,
      schedulesLoaded
    };
    
    // 状態が変わった場合のみ更新
    const stateChanged = 
      currentState.budgetItemsIds !== lastTableState.budgetItemsIds ||
      currentState.monthColumnsLength !== lastTableState.monthColumnsLength ||
      currentState.schedulesLoaded !== lastTableState.schedulesLoaded;
    
    if (!stateChanged) {
      return;
    }
    
    lastTableState = currentState;
    
    // 既存のタイマーをクリア
    if (tableUpdateTimeout) {
      clearTimeout(tableUpdateTimeout);
    }
    
    // デバウンス処理でテーブル更新
    tableUpdateTimeout = setTimeout(() => {
      console.log('🔄 統合テーブル更新:', {
        budgetItems: budgetItems.length,
        monthColumns: monthColumns.length,
        schedulesLoaded
      });
      
      try {
        initializeTableColumns();
        prepareTableData();
        updateTable();
      } catch (error) {
        console.error('テーブル更新エラー:', error);
        // エラー時は再初期化を試行
        initializeTable();
      }
      
      tableUpdateTimeout = null;
    }, 300);
  }
  
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
    if (!amount) return includeYen ? '¥0' : '0';
    const formatted = amount.toLocaleString();
    return includeYen ? `¥${formatted}` : formatted;
  }

  // Tabulatorの列定義を初期化
  function initializeTableColumns() {
    // 基本列を固定で定義（毎回同じ内容）
    const fixedBaseColumns = [
      {
        title: "助成金",
        field: "grantName",
        frozen: true,
        minWidth: 120,
        width: 180,
        widthGrow: 1,
        sorter: "string"
      },
      {
        title: "項目名", 
        field: "name",
        frozen: true,
        width: 220,
        minWidth: 150,
        widthGrow: 2,
        sorter: "string"
      },
      {
        title: "カテゴリ",
        field: "category",
        width: 120,
        minWidth: 100,
        widthGrow: 0.5,
        sorter: "string"
      },
      {
        title: "予算額",
        field: "budgetedAmount",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => formatAmount(cell.getValue())
      },
      {
        title: "使用額", 
        field: "usedAmount",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => formatAmount(cell.getValue())
      },
      {
        title: "残額",
        field: "remainingAmount",
        width: 130,
        minWidth: 110,
        widthGrow: 0.8,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => {
          const value = cell.getValue();
          const color = value < 0 ? 'red' : 'green';
          return `<span style="color: ${color}; font-weight: 600;">${formatAmount(value)}</span>`;
        }
      }
    ];
    
    // 基本列を設定（固定）
    baseColumns = [...fixedBaseColumns];
    
    // 月列を動的に構築
    const monthColumnDefs = [];
    console.log('🔧 initializeTableColumns - 月列追加処理:', {
      monthColumnsLength: monthColumns?.length || 0,
      monthColumns: monthColumns, // 全ての月列を表示
      monthColumnsFirst3: monthColumns?.slice(0, 3)
    });
    
    if (monthColumns && monthColumns.length > 0) {
      console.log('🔧 月列を順次追加中...');
      monthColumns.forEach((monthCol, index) => {
        const columnDef = {
          title: monthCol.label,
          field: `month_${monthCol.year}_${monthCol.month}`,
          width: 90,
          minWidth: 80,
          maxWidth: 110,
          hozAlign: "right",
          formatter: (cell) => {
            const monthlyBudget = cell.getValue(); // これが実際の月予算額（スケジュール設定値）
            
            // 現在の年月を取得
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1; // 0ベースなので+1
            
            // 対象月が過去・現在・未来かを判定
            const targetYear = monthCol.year;
            const targetMonth = monthCol.month;
            const isCurrentOrPast = 
              targetYear < currentYear || 
              (targetYear === currentYear && targetMonth <= currentMonth);
            
            // 使用額の表示ルール
            let monthlyUsed;
            let usedDisplay;
            if (isCurrentOrPast) {
              monthlyUsed = 0; // 実際は実データを取得予定
              usedDisplay = monthlyUsed === 0 ? '0' : formatAmount(monthlyUsed, false);
            } else {
              monthlyUsed = null; // 未来の月
              usedDisplay = '-';
            }
            
            // 残額の計算と表示
            let remainingDisplay;
            if (isCurrentOrPast) {
              const monthlyRemaining = monthlyBudget - (monthlyUsed || 0);
              remainingDisplay = formatAmount(monthlyRemaining, false);
            } else {
              remainingDisplay = '-';
            }
            
            // 表示項目を制御（windowオブジェクトから動的に設定を取得）
            const settings = (window as any).monthDisplaySettings || {
              showMonthlyBudget: true,
              showMonthlyUsed: true,
              showMonthlyRemaining: true
            };
            const items = [];
            if (settings.showMonthlyBudget) {
              items.push(`<div style="background-color: #f8fafc; padding: 1px 3px; border-radius: 2px;">${monthlyBudget > 0 ? formatAmount(monthlyBudget, false) : '-'}</div>`);
            }
            if (settings.showMonthlyUsed) {
              items.push(`<div style="background-color: #eff6ff; padding: 1px 3px; border-radius: 2px;">${usedDisplay}</div>`);
            }
            if (settings.showMonthlyRemaining) {
              items.push(`<div style="background-color: ${isCurrentOrPast && monthlyBudget > 0 ? (monthlyBudget - (monthlyUsed || 0) < 0 ? '#fef2f2' : '#f0fdf4') : '#f9f9f9'}; padding: 1px 3px; border-radius: 2px; font-weight: 600;">${remainingDisplay}</div>`);
            }
            
            if (items.length === 0) {
              return '<div style="text-align: center; color: #9ca3af; font-size: 11px;">-</div>';
            }
            
            return `
              <div style="display: flex; flex-direction: column; gap: 1px; font-size: 11px;">
                ${items.join('')}
              </div>
            `;
          }
        };
        monthColumnDefs.push(columnDef);
        console.log(`🔧 月列${index + 1}追加:`, columnDef.title, columnDef.field);
      });
      console.log('🔧 月列構築完了:', monthColumnDefs.length, '個');
    }
    
    // 操作列を追加
    const actionColumn = {
      title: "操作",
      field: "actions",
      width: 80,
      hozAlign: "center",
      formatter: () => `<button style="color: #2563eb; cursor: pointer;">編集</button>`,
      cellClick: (e, cell) => {
        const rowData = cell.getRow().getData();
        const item = budgetItems.find(i => i.id === rowData.id);
        if (item) {
          openBudgetItemForm(item);
        }
      }
    };

    // 最終的な列定義を構築：基本列 + 月列 + 操作列
    columns = [...baseColumns, ...monthColumnDefs, actionColumn];
    console.log('🔧 最終的なcolumns設定完了:', {
      baseColumnsLength: baseColumns.length,
      monthColumnDefsLength: monthColumnDefs.length,
      totalColumnsLength: columns.length,
      baseColumnTitles: baseColumns.map(c => c.title),
      monthColumnTitles: monthColumnDefs.map(c => c.title),
      allColumnTitles: columns.map(c => c.title)
    });
  }

  // Tabulatorテーブルデータの準備
  function prepareTableData() {
    console.log('prepareTableData開始 - budgetItems:', budgetItems.length, 'monthColumns:', monthColumns.length, 'schedulesLoaded:', schedulesLoaded);
    
    // 元のbudgetItemsのデータ構造を確認
    console.log('🔍 元のbudgetItems[0]:', budgetItems[0]);
    
    tableData = budgetItems.map(item => {
      const remaining = (item.budgetedAmount || 0) - (item.usedAmount || 0);
      const baseData = {
        ...item,
        remainingAmount: remaining,
        actions: '' // Tabulatorのformatterで処理
      };
      
      console.log(`📋 項目${item.name}のbaseData:`, {
        id: baseData.id,
        name: baseData.name,
        grantName: baseData.grantName,
        category: baseData.category,
        budgetedAmount: baseData.budgetedAmount,
        usedAmount: baseData.usedAmount,
        remainingAmount: baseData.remainingAmount,
        '🔍 基本列フィールド存在確認': {
          hasGrantName: 'grantName' in baseData,
          hasName: 'name' in baseData,
          hasCategory: 'category' in baseData,
          hasBudgetedAmount: 'budgetedAmount' in baseData
        }
      });
      
      // 月別データを追加
      if (monthColumns && monthColumns.length > 0) {
        const monthlyData = monthColumns.reduce((acc, monthCol) => {
          const monthAmount = getMonthlyAmount(item, monthCol.year, monthCol.month);
          acc[`month_${monthCol.year}_${monthCol.month}`] = monthAmount;
          return acc;
        }, {});
        Object.assign(baseData, monthlyData);
        
        console.log(`項目${item.name}の月別データ:`, monthlyData);
        console.log(`🎯 最終データ構造 - 項目${item.name}:`, {
          keys: Object.keys(Object.assign(baseData, monthlyData)),
          baseFields: ['id', 'name', 'grantName', 'category', 'budgetedAmount', 'usedAmount', 'remainingAmount'].filter(key => key in Object.assign(baseData, monthlyData)),
          monthFields: Object.keys(monthlyData),
          actualValues: {
            id: Object.assign(baseData, monthlyData).id,
            name: Object.assign(baseData, monthlyData).name,
            grantName: Object.assign(baseData, monthlyData).grantName,
            category: Object.assign(baseData, monthlyData).category,
            budgetedAmount: Object.assign(baseData, monthlyData).budgetedAmount
          }
        });
      }
      
      return baseData;
    });
    
    console.log('prepareTableData完了 - tableData length:', tableData.length);
    console.log('📋 最初のテーブルデータサンプル:', tableData[0]);
    console.log('📋 テーブルデータの全フィールド:', tableData[0] ? Object.keys(tableData[0]) : 'データなし');
  }

  // Tabulatorテーブルの初期化と更新
  function initializeTable() {
    if (isTableInitializing) {
      console.log('Table initialization already in progress, skipping');
      return;
    }

    isTableInitializing = true;
    
    if (table) {
      table.destroy();
      table = null;
    }
    
    if (!tableElement) {
      console.warn('Table element not found');
      isTableInitializing = false;
      return;
    }

    if (columns.length === 0) {
      console.warn('No columns defined for table');
      isTableInitializing = false;
      return;
    }
    
    try {
      // 基本列を確実に保持した列定義を使用
      const initColumns = baseColumns.length > 0 ? baseColumns : columns;
      
      console.log('🏗️ initializeTable: テーブル作成開始', {
        baseColumnsLength: baseColumns.length,
        columnsLength: initColumns.length,
        columnTitles: initColumns.map(c => c.title),
        tableDataLength: tableData.length,
        baseColumns: initColumns.filter(c => !c.title.includes('/')).length,
        monthColumns: initColumns.filter(c => c.title.includes('/')).length
      });
      
      console.log('📊 テーブル作成直前 - データ確認:', {
        tableDataCount: tableData.length,
        firstRowData: tableData[0],
        columnsCount: initColumns.length,
        baseColumnsCount: initColumns.filter(c => !c.title.includes('/')).length
      });
      
      table = new Tabulator(tableElement, {
        data: tableData,
        columns: initColumns,
        layout: "fitDataFill",
        responsiveLayout: false,
        height: "calc(100vh - 200px)",
        pagination: "local",
        paginationSize: window.innerHeight > 900 ? 150 : 100,
        paginationSizeSelector: [50, 100, 150, 200],
        movableColumns: true,
        resizableRows: false,
        resizableColumns: true,
        selectable: 1,
        scrollToColumnPosition: "left",
        scrollToColumnVisibility: "visible",
        reactiveData: true,
        virtualDomVert: true
      });

      // テーブル初期化完了を待つ
      table.on("tableBuilt", function() {
        console.log("Tabulator table built successfully");
        isTableInitializing = false;
      });

      table.on("tableBuiltFailed", function(error) {
        console.error("Tabulator table build failed:", error);
        isTableInitializing = false;
      });

    } catch (error) {
      console.error('Error initializing Tabulator table:', error);
      isTableInitializing = false;
      table = null;
    }
  }

  function updateTable() {
    if (!tableElement) {
      console.warn('Table element not available for update');
      return;
    }

    if (isTableInitializing) {
      console.log('Table is initializing, deferring update');
      setTimeout(() => updateTable(), 200);
      return;
    }

    if (table && table.initialized) {
      try {
        // 現在のcolumnsをそのまま使用（基本列は既に保護済み）
        const completeColumns = columns;
        
        console.log('🔧 updateTable: 完全な列定義で更新実行', {
          baseColumnsCount: baseColumns.filter(col => !col.title.includes('/')).length,
          monthColumnsCount: baseColumns.filter(col => col.title.includes('/')).length,
          totalColumns: completeColumns.length,
          baseColumnTitles: completeColumns.filter(col => !col.title.includes('/')).map(c => c.title),
          monthColumnTitles: completeColumns.filter(col => col.title.includes('/')).map(c => c.title)
        });
        
        // Tabulatorテーブルの現在の列を確認
        console.log('📊 現在のテーブル列状態:', {
          currentColumns: table.getColumns().map(col => col.getDefinition().title),
          setColumnsTarget: completeColumns.map(c => c.title)
        });
        
        // 列定義を確実に更新してからデータを更新
        table.setColumns(completeColumns);
        
        console.log('🔧 updateTable: データ更新実行', {
          tableDataLength: tableData.length,
          sampleData: tableData[0]
        });
        table.setData(tableData);
        
        // データ更新後の列状態を確認
        setTimeout(() => {
          console.log('📊 データ更新後のテーブル列状態:', {
            finalColumns: table.getColumns().map(col => col.getDefinition().title),
            visibleColumns: table.getColumns().filter(col => col.isVisible()).map(col => col.getDefinition().title)
          });
        }, 100);
      } catch (error) {
        console.error('Error updating table:', error);
        // エラーが発生した場合は再初期化
        initializeTable();
      }
    } else {
      initializeTable();
    }
  }

  // onMountでテーブル要素の準備
  onMount(() => {
    // 初期化はbudgetItemsが読み込まれた後に実行
  });

  // テーブル更新は統合されたhandleTableUpdate関数で処理

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
    const reportedGrants = grants.filter(g => g.status === 'reported');
    
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
      .filter(g => g.status === 'completed' || g.status === 'reported')
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
    console.log('generateMonthColumns called, grants.length:', grantsData?.length, 'budgetItems.length:', currentBudgetItems?.length);
    console.log('grantsData:', grantsData);
    console.log('currentBudgetItems:', currentBudgetItems);
    
    if (selectedGrantData) {
      // 選択された助成金の期間から生成
      console.log('Using selectedGrant:', selectedGrantData.name);
      return generateMonthsFromGrant(selectedGrantData);
    }
    
    // データがまだロードされていない場合は空の配列を返す
    if (!grantsData || grantsData.length === 0) {
      console.log('No grants data, returning empty months');
      return [];
    }
    
    if (!currentBudgetItems) {
      console.log('No budget items data, returning empty months');
      return [];
    }
    
    // 暫定：全ての進行中の助成金から月列を生成
    const displayedGrantIds = new Set(grantsData.filter(g => g.status === 'in_progress').map(g => g.id));
    console.log('Using all active grants for month generation:', Array.from(displayedGrantIds));
    
    if (displayedGrantIds.size === 0) {
      console.log('No displayed grant IDs, returning empty months');
      return [];
    }
    
    // 関連する助成金の期間のみを統合
    const allMonths = new Set<string>();
    grantsData.forEach(grant => {
      console.log('Checking grant:', grant.id, grant.name, 'startDate:', grant.startDate, 'endDate:', grant.endDate, 'inDisplayed:', displayedGrantIds.has(grant.id));
      if (displayedGrantIds.has(grant.id) && grant.startDate && grant.endDate) {
        console.log('Processing grant for months:', grant.name, 'startDate:', grant.startDate, 'endDate:', grant.endDate);
        const months = generateMonthsFromGrant(grant);
        console.log('Generated months for grant:', months);
        months.forEach(m => allMonths.add(`${m.year}-${m.month}`));
      }
    });
    
    console.log('Generated months count:', allMonths.size);
    console.log('All months:', Array.from(allMonths));
    
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
      months.push({
        year,
        month,
        label: `${year.toString().slice(-2)}/${month.toString().padStart(2, '0')}`
      });
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  // 予算項目の月割り金額を計算
  function getMonthlyAmount(item: any, targetYear: number, targetMonth: number): number {
    const schedules = budgetItemSchedules.get(item.id);
    const monthKey = `${targetYear.toString().slice(-2)}/${targetMonth.toString().padStart(2, '0')}`;
    
    console.log(`💰 getMonthlyAmount呼び出し: 項目ID${item.id} ${monthKey}月`, {
      schedules,
      budgetedAmount: item.budgetedAmount,
      schedulesLoaded,
      budgetItemSchedulesSize: budgetItemSchedules.size
    });
    
    if (!item.budgetedAmount) {
      console.log(`💰 項目ID${item.id}は予算額が0のため金額0`);
      return 0;
    }
    
    // スケジュールデータがある場合は、それに基づいて計算
    if (schedules && schedules.length > 0) {
      const hasSchedule = schedules.includes(monthKey);
      
      console.log(`💰 項目ID${item.id}のスケジュール判定:`, {
        monthKey,
        hasSchedule,
        schedules,
        schedulesLength: schedules.length
      });
      
      if (!hasSchedule) {
        console.log(`💰 項目ID${item.id} ${monthKey}月はスケジュール対象外のため金額0`);
        return 0;
      }
      
      // 設定された月数で予算額を割る
      const totalMonths = schedules.length;
      const monthlyAmount = totalMonths > 0 ? Math.round(item.budgetedAmount / totalMonths) : 0;
      
      console.log(`💰 項目ID${item.id} ${monthKey}月の金額: ${monthlyAmount} (総額: ${item.budgetedAmount}, 対象月数: ${totalMonths})`);
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
          console.log(`項目ID${item.id} ${targetMonthKey}月の金額(均等配分): ${monthlyAmount}`);
          return monthlyAmount;
        }
      }
    }
    
    // デフォルトは0
    console.log(`項目ID${item.id}のスケジュールデータなし、金額表示なし`);
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
      console.log('📅 月列更新:', {
        grants: grants?.length,
        selectedGrant: selectedGrant?.name,
        budgetItems: budgetItems.length
      });
      
      const newMonthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
      if (JSON.stringify(monthColumns) !== JSON.stringify(newMonthColumns)) {
        monthColumns = newMonthColumns;
        console.log('月列が変更されました:', monthColumns.length, '個の月');
        // テーブル更新を実行
        handleTableUpdate();
      }
      
      monthColumnsTimeout = null;
    }, 150);
  }
  
  $: updateMonthColumns();
  $: console.log('selectedGrant:', selectedGrant);

  // monthColumnsとスケジュール更新は統合されたhandleTableUpdate関数で処理

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
      console.log('ファイル内容:', text);
      const lines = text.split('\n').filter(line => line.trim());
      console.log('行数:', lines.length);
      
      if (lines.length < 2) {
        importError = 'CSVファイルにデータが含まれていません';
        return;
      }

      console.log('ヘッダー行:', lines[0]);

      // ヘッダー行をスキップして解析
      const dataLines = lines.slice(1);
      const preview = [];

      if (importType === 'grants') {
        // 助成金CSVの解析
        for (const line of dataLines) {
          const columns = parseCSVLine(line);
          console.log('CSV行:', line);
          console.log('解析されたカラム数:', columns.length, 'カラム内容:', columns);
          
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
          console.log('CSV行:', line);
          console.log('解析されたカラム数:', columns.length, 'カラム内容:', columns);
          
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
      console.log('Import preview:', importPreview);
      
    } catch (err) {
      importError = 'CSVファイルの解析に失敗しました: ' + (err instanceof Error ? err.message : String(err));
      console.error('CSV parse error:', err);
    }
  }

  function parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        // ダブルクォートの処理
        if (inQuotes && line[i + 1] === '"') {
          // エスケープされたクォート
          current += '"';
          i++; // 次のクォートをスキップ
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    // 引用符で囲まれている場合は引用符を除去
    return result.map(field => {
      if (field.startsWith('"') && field.endsWith('"')) {
        return field.slice(1, -1);
      }
      return field;
    });
  }

  function parseAmount(value: string): number | null {
    if (!value?.trim()) return null;
    const cleaned = value.replace(/[¥,]/g, '');
    const parsed = parseInt(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  function parseDate(value: string): string | null {
    if (!value?.trim()) return null;
    
    // YYYY/MM/DD または YYYY-MM-DD 形式を ISO 形式に変換
    const dateStr = value.trim().replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    return null;
  }

  function parseStatus(value: string): 'in_progress' | 'completed' | 'reported' {
    const trimmed = value?.trim() || '';
    switch (trimmed) {
      case '終了':
      case 'completed':
        return 'completed';
      case '報告済み':
      case 'reported':
        return 'reported';
      default:
        return 'in_progress';
    }
  }

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
        console.log(`予算項目ID${budgetItemId}に${schedules.length}ヶ月のスケジュールを作成しました`);
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
        {#if grants.filter(g => g.status === 'in_progress').length > 0}
          <div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {#each grants.filter(g => g.status === 'in_progress') as grant}
                <div 
                  class="border rounded-lg px-3 py-3 hover:shadow-md transition-shadow {selectedGrant?.id === grant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} relative group"
                >
                  <div 
                    class="cursor-pointer"
                    on:click={() => selectGrant(grant)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && selectGrant(grant)}
                  >
                    <!-- 1行目: 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
                    <div class="flex justify-between items-start mb-2">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        <h3 class="font-semibold text-sm truncate">{grant.name}</h3>
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <span class="px-1.5 py-0.5 rounded text-xs font-medium {statusColors[grant.status]}">
                          {statusLabels[grant.status]}
                        </span>
                        <button 
                          on:click|stopPropagation={() => openGrantForm(grant)}
                          class="px-2 py-1 hover:bg-gray-200 rounded text-xs text-gray-500 hover:text-gray-700"
                        >
                          編集
                        </button>
                      </div>
                    </div>

                    <!-- 2行目: 助成金コード + ID -->
                    <div class="mb-2 flex items-center gap-2">
                      {#if grant.grantCode}
                        <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          {grant.grantCode}
                        </span>
                      {/if}
                      <span class="text-xs text-gray-500">
                        ID: {grant.id}
                      </span>
                    </div>
                    <!-- 3行目: 期間 + 予算額 -->
                    <div class="flex justify-between items-center mb-2 text-xs">
                      <div class="{getPeriodColor(grant.endDate)}">
                        {#if grant.startDate && grant.endDate}
                          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
                        {:else}
                          期間未設定
                        {/if}
                      </div>
                      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
                    </div>

                    <!-- 4行目: 使用額 + 残額 -->
                    <div class="flex justify-between items-center text-xs">
                      <div class="text-gray-600">
                        使用済: {formatAmount(grant.usedAmount || 0)}
                      </div>
                      <div class="font-medium {getAmountColor((grant.totalAmount || 0) - (grant.usedAmount || 0), null, grant.endDate)}">
                        残額: {formatAmount((grant.totalAmount || 0) - (grant.usedAmount || 0))}
                      </div>
                    </div>
                  </div>
                </div>
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
                <div 
                  class="border rounded-lg px-3 py-3 hover:shadow-md transition-shadow {selectedGrant?.id === grant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} opacity-75 relative group"
                >
                  <div 
                    class="cursor-pointer"
                    on:click={() => selectGrant(grant)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && selectGrant(grant)}
                  >
                    <!-- 1行目: 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
                    <div class="flex justify-between items-start mb-2">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        <h3 class="font-semibold text-sm truncate">{grant.name}</h3>
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <span class="px-1.5 py-0.5 rounded text-xs font-medium {statusColors[grant.status]}">
                          {statusLabels[grant.status]}
                        </span>
                        <button 
                          on:click|stopPropagation={() => openGrantForm(grant)}
                          class="px-2 py-1 hover:bg-gray-200 rounded text-xs text-gray-500 hover:text-gray-700"
                        >
                          編集
                        </button>
                      </div>
                    </div>

                    <!-- 2行目: 助成金コード + ID -->
                    <div class="mb-2 flex items-center gap-2">
                      {#if grant.grantCode}
                        <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          {grant.grantCode}
                        </span>
                      {/if}
                      <span class="text-xs text-gray-500">
                        ID: {grant.id}
                      </span>
                    </div>
                    <!-- 3行目: 期間 + 予算額 -->
                    <div class="flex justify-between items-center mb-2 text-xs">
                      <div class="{getPeriodColor(grant.endDate)}">
                        {#if grant.startDate && grant.endDate}
                          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
                        {:else}
                          期間未設定
                        {/if}
                      </div>
                      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
                    </div>

                    <!-- 4行目: 使用額 + 残額 -->
                    <div class="flex justify-between items-center text-xs">
                      <div class="text-gray-600">
                        使用済: {formatAmount(grant.usedAmount || 0)}
                      </div>
                      <div class="font-medium {getAmountColor((grant.totalAmount || 0) - (grant.usedAmount || 0), null, grant.endDate)}">
                        残額: {formatAmount((grant.totalAmount || 0) - (grant.usedAmount || 0))}
                      </div>
                    </div>
                  </div>
                </div>
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
                <div 
                  class="border rounded-lg px-3 py-3 hover:shadow-md transition-shadow {selectedGrant?.id === grant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} opacity-60 relative group"
                >
                  <div 
                    class="cursor-pointer"
                    on:click={() => selectGrant(grant)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && selectGrant(grant)}
                  >
                    <!-- 1行目: 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
                    <div class="flex justify-between items-start mb-2">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        <h3 class="font-semibold text-sm truncate">{grant.name}</h3>
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <span class="px-1.5 py-0.5 rounded text-xs font-medium {statusColors[grant.status]}">
                          {statusLabels[grant.status]}
                        </span>
                        <button 
                          on:click|stopPropagation={() => openGrantForm(grant)}
                          class="px-2 py-1 hover:bg-gray-200 rounded text-xs text-gray-500 hover:text-gray-700"
                        >
                          編集
                        </button>
                      </div>
                    </div>

                    <!-- 2行目: 助成金コード + ID -->
                    <div class="mb-2 flex items-center gap-2">
                      {#if grant.grantCode}
                        <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          {grant.grantCode}
                        </span>
                      {/if}
                      <span class="text-xs text-gray-500">
                        ID: {grant.id}
                      </span>
                    </div>
                    <!-- 3行目: 期間 + 予算額 -->
                    <div class="flex justify-between items-center mb-2 text-xs">
                      <div class="{getPeriodColor(grant.endDate)}">
                        {#if grant.startDate && grant.endDate}
                          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
                        {:else}
                          期間未設定
                        {/if}
                      </div>
                      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
                    </div>

                    <!-- 4行目: 使用額 + 残額 -->
                    <div class="flex justify-between items-center text-xs">
                      <div class="text-gray-600">
                        使用済: {formatAmount(grant.usedAmount || 0)}
                      </div>
                      <div class="font-medium {getAmountColor((grant.totalAmount || 0) - (grant.usedAmount || 0), null, grant.endDate)}">
                        残額: {formatAmount((grant.totalAmount || 0) - (grant.usedAmount || 0))}
                      </div>
                    </div>
                  </div>
                </div>
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
          
          {#if budgetItems.length > 0}
            <div class="text-right">
              <p class="text-sm text-gray-600">予算合計 ({budgetItems.length}件)</p>
              <p class="text-lg font-bold text-blue-600">
                {formatAmount(budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0))}
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
              <h4 class="text-sm font-medium text-gray-700 mb-2">月データ表示設定</h4>
              <div class="flex flex-wrap gap-4">
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
            </div>
            
            <div class="budget-table-container overflow-x-auto">
              <div bind:this={tableElement} class="tabulator-table min-w-full"></div>
            </div>
          {/if}
        </div>
    </div>
  </div>

<!-- 助成金作成・編集モーダル -->
{#if showGrantForm}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        {grantForm.id ? '助成金編集' : '新規助成金作成'}
      </h3>
      
      <form on:submit|preventDefault={saveGrant}>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">助成金名 *</label>
          <input 
            type="text" 
            bind:value={grantForm.name}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: WAM補助金"
          />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">助成金コード</label>
          <input 
            type="text" 
            bind:value={grantForm.grantCode}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: WAM2025"
          />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">総額（円）</label>
          <input 
            type="number" 
            bind:value={grantForm.totalAmount}
            min="0"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="7000000"
          />
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">開始日</label>
            <input 
              type="date" 
              bind:value={grantForm.startDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">終了日</label>
            <input 
              type="date" 
              bind:value={grantForm.endDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">ステータス</label>
          <select 
            bind:value={grantForm.status}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="in_progress">進行中</option>
            <option value="completed">終了</option>
            <option value="reported">報告済み</option>
          </select>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button 
            type="button"
            on:click={() => showGrantForm = false}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            キャンセル
          </button>
          <button 
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 予算項目作成・編集モーダル -->
{#if showBudgetItemForm}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        {budgetItemForm.id ? '予算項目編集' : '新規予算項目作成'}
      </h3>
      
      <form on:submit|preventDefault={saveBudgetItem}>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">助成金 *</label>
          <select 
            bind:value={budgetItemForm.grantId}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">助成金を選択してください</option>
            {#each grants as grant}
              <option value={grant.id}>
                {grant.grantCode ? `[${grant.grantCode}] ` : ''}{grant.name} ({statusLabels[grant.status]})
              </option>
            {/each}
          </select>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">項目名 *</label>
          <input 
            type="text" 
            bind:value={budgetItemForm.name}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 消耗品費"
          />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
          <div class="relative category-dropdown">
            <input 
              type="text" 
              bind:value={budgetItemForm.category}
              on:focus={() => showCategoryDropdown = true}
              on:input={() => showCategoryDropdown = true}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 消耗品（入力またはドロップダウンから選択）"
            />
            
            {#if showCategoryDropdown && availableCategories.length > 0}
              <div class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {#each filterCategories(budgetItemForm.category || '') as category}
                  <button
                    type="button"
                    class="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    on:click={() => selectCategory(category)}
                  >
                    {category}
                  </button>
                {/each}
                
                {#if filterCategories(budgetItemForm.category || '').length === 0 && budgetItemForm.category}
                  <div class="px-3 py-2 text-gray-500 text-sm">
                    「{budgetItemForm.category}」で新規作成
                  </div>
                {/if}
              </div>
            {/if}
            
            {#if availableCategories.length === 0}
              <div class="mt-1 text-xs text-gray-500">
                新しいカテゴリを入力してください
              </div>
            {/if}
          </div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">予算額（円）</label>
          <input 
            type="number" 
            bind:value={budgetItemForm.budgetedAmount}
            min="0"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="498000"
          />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">備考</label>
          <textarea 
            bind:value={budgetItemForm.note}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="備考や説明を入力"
          ></textarea>
        </div>

        <!-- 月別スケジュール選択 -->
        {#if budgetItemForm.grantId}
          {@const formGrant = grants.find(g => g.id === parseInt(budgetItemForm.grantId))}
          {#if formGrant && formGrant.startDate && formGrant.endDate}
            {@const formAvailableMonths = generateMonthsFromGrant(formGrant)}
            {#if formAvailableMonths.length > 0}
              {@const availableMonthKeys = formAvailableMonths.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`)}
              <SimpleMonthCheckboxes
                availableMonths={availableMonthKeys}
                selectedMonths={Array.from(selectedMonths)}
                title="利用予定月"
                on:change={(e) => {
                  selectedMonths = new Set(e.detail);
                }}
              />
            {:else}
              <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p class="text-sm text-yellow-800">
                  選択された助成金の期間が設定されていないため、月別スケジュールを選択できません。
                </p>
              </div>
            {/if}
          {:else}
            <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p class="text-sm text-yellow-800">
                選択された助成金の期間が設定されていないため、月別スケジュールを選択できません。
              </p>
            </div>
          {/if}
        {/if}
        
        <div class="flex justify-end space-x-3">
          <button 
            type="button"
            on:click={() => showBudgetItemForm = false}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            キャンセル
          </button>
          <button 
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

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
<DebugInfo />

<style>
  .budget-table-container {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
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