<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { getPeriodColor, getAmountColor } from '$lib/utils/color-rules';
  import { TabulatorFull as Tabulator } from 'tabulator-tables';
  import type { ColumnDefinition } from 'tabulator-tables';
  import 'tabulator-tables/dist/css/tabulator.min.css';
  import MonthSelector from '$lib/components/MonthSelector.svelte';
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

  onMount(() => {
    loadGrants();
    loadAllBudgetItems();
    
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
        console.log('助成金データロード完了:', grants.length, '件');
        // 月列を強制的に再生成
        monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
        console.log('強制更新後のmonthColumns:', monthColumns);
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
    return items.filter(item => {
      const status = item.grantStatus || item.grant?.status;
      
      // 基本表示: 進行中のみ
      if (status === 'in_progress') return true;
      
      // 終了済み表示がONの場合、終了ステータスも表示
      if (showCompletedGrants && status === 'completed') return true;
      
      // 報告済み表示がONの場合、報告済みステータスも表示
      if (showReportedGrants && status === 'reported') return true;
      
      return false;
    });
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
    try {
      const response = await fetch(`${base}/api/budget-items`);
      const data = await response.json();
      
      if (data.success) {
        allBudgetItems = data.budgetItems || [];
        // 初期表示は全項目（終了・報告ステータス除く）
        if (!selectedGrant) {
          budgetItems = getFilteredBudgetItems(allBudgetItems);
        }
        console.log('全予算項目取得完了:', allBudgetItems.length, '件');
        // 月列を強制的に再生成（データロード完了時）
        monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
        console.log('予算項目ロード後のmonthColumns:', monthColumns);
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
  
  // 予算項目が変更された時にカテゴリを更新
  $: if (budgetItems.length > 0) {
    updateAvailableCategories();
  }

  // 終了済みフィルター変更時の処理
  $: if (showCompletedGrants !== undefined && allBudgetItems.length > 0) {
    console.log('終了済みフィルター変更:', showCompletedGrants);
    refreshBudgetItems();
  }

  // 報告済みフィルター変更時の処理  
  $: if (showReportedGrants !== undefined && allBudgetItems.length > 0) {
    console.log('報告済みフィルター変更:', showReportedGrants);
    refreshBudgetItems();
  }

  // 選択助成金変更時の処理
  $: if (selectedGrant !== undefined && allBudgetItems.length > 0) {
    console.log('選択助成金変更:', selectedGrant?.name);
    refreshBudgetItems();
  }

  function refreshBudgetItems() {
    if (selectedGrant) {
      budgetItems = getFilteredBudgetItems(allBudgetItems.filter(item => item.grantId === selectedGrant.id));
    } else {
      budgetItems = getFilteredBudgetItems(allBudgetItems);
    }
    console.log('フィルター後予算項目数:', budgetItems.length);
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

  async function loadBudgetItemSchedules() {
    budgetItemSchedules.clear();
    
    for (const item of budgetItems) {
      try {
        const response = await fetch(`${base}/api/budget-items/${item.id}/schedule`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.schedules.length > 0) {
            const months = data.schedules.map(s => `${s.year.toString().slice(-2)}/${s.month.toString().padStart(2, '0')}`);
            budgetItemSchedules.set(item.id, months);
          }
        }
      } catch (err) {
        // スケジュールデータがない場合は無視
      }
    }
    budgetItemSchedules = new Map(budgetItemSchedules); // リアクティブ更新
  }

  // 予算項目が変更されたときにスケジュールを読み込み
  $: if (budgetItems.length > 0) {
    loadBudgetItemSchedules();
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

  // グリッドの初期化と更新（データが実際に存在し、DOM要素が準備できたときのみ）
  $: if (budgetItems.length > 0 && tableElement && columns.length > 0) {
    console.log('Updating table with data:', budgetItems.length, 'items');
    initializeTableColumns();
    prepareTableData();
    updateTable();
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

  function formatAmount(amount?: number): string {
    if (!amount) return '¥0';
    return `¥${amount.toLocaleString()}`;
  }

  // Tabulatorの列定義を初期化
  function initializeTableColumns() {
    const baseColumns: ColumnDefinition[] = [
      {
        title: "助成金",
        field: "grantName",
        frozen: true,
        width: 180,
        sorter: "string"
      },
      {
        title: "項目名", 
        field: "name",
        frozen: true,
        width: 200,
        sorter: "string"
      },
      {
        title: "カテゴリ",
        field: "category",
        width: 120,
        sorter: "string"
      },
      {
        title: "予算額",
        field: "budgetedAmount",
        width: 120,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => formatAmount(cell.getValue())
      },
      {
        title: "使用額", 
        field: "usedAmount",
        width: 120,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => formatAmount(cell.getValue())
      },
      {
        title: "残額",
        field: "remainingAmount",
        width: 120,
        sorter: "number",
        hozAlign: "right",
        formatter: (cell) => {
          const value = cell.getValue();
          const color = value < 0 ? 'red' : 'green';
          return `<span style="color: ${color}; font-weight: 600;">${formatAmount(value)}</span>`;
        }
      }
    ];

    // 月列を常に表示（列固定により水平スクロールで対応）
    if (monthColumns && monthColumns.length > 0) {
      monthColumns.forEach(monthCol => {
        baseColumns.push({
          title: monthCol.label,
          field: `month_${monthCol.year}_${monthCol.month}`,
          width: 100,
          hozAlign: "center",
          formatter: (cell) => {
            const value = cell.getValue();
            return value > 0 ? formatAmount(value) : '-';
          }
        });
      });
    }

    baseColumns.push({
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
    });

    columns = baseColumns;
  }

  // Tabulatorテーブルデータの準備
  function prepareTableData() {
    tableData = budgetItems.map(item => {
      const remaining = (item.budgetedAmount || 0) - (item.usedAmount || 0);
      return {
        ...item,
        remainingAmount: remaining,
        actions: '', // Tabulatorのformatterで処理
        ...(monthColumns && monthColumns.length > 0 ? monthColumns.reduce((acc, monthCol) => {
          const monthAmount = getMonthlyAmount(item, monthCol.year, monthCol.month);
          acc[`month_${monthCol.year}_${monthCol.month}`] = monthAmount;
          return acc;
        }, {}) : {})
      };
    });
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
      table = new Tabulator(tableElement, {
        data: tableData,
        columns: columns,
        layout: "fitColumns",
        responsiveLayout: "hide",
        pagination: "local",
        paginationSize: 50,
        paginationSizeSelector: [25, 50, 100],
        movableColumns: true,
        resizableRows: false,
        selectable: 1,
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
        table.setColumns(columns);
        table.setData(tableData);
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

  // budgetItemsが更新されたときにTabulatorを更新（条件を厳格化）
  $: if (budgetItems.length > 0 && tableElement && !loading) {
    console.log('Budget items changed, updating table');
    initializeTableColumns();
    prepareTableData();
    updateTable();
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
    if (!schedules || !item.budgetedAmount) return 0;
    
    // その月がスケジュールに含まれているかチェック
    const monthKey = `${targetYear.toString().slice(-2)}/${targetMonth.toString().padStart(2, '0')}`;
    const hasSchedule = schedules.includes(monthKey);
    
    if (!hasSchedule) return 0;
    
    // 設定された月数で予算額を割る
    const totalMonths = schedules.length;
    return totalMonths > 0 ? Math.round(item.budgetedAmount / totalMonths) : 0;
  }

  // リアクティブに月列を更新（grants, budgetItems, selectedGrantが変更されたときに再実行）
  $: {
    console.log('Reactive update - grants.length:', grants?.length, 'budgetItems.length:', budgetItems?.length);
    monthColumns = generateMonthColumns(grants, selectedGrant, budgetItems);
    console.log('Updated monthColumns:', monthColumns);
  }
  $: console.log('selectedGrant:', selectedGrant);

  // monthColumnsが更新された時にテーブルを再初期化
  $: if (monthColumns.length > 0 && budgetItems.length > 0 && tableElement && !loading) {
    console.log('⚡ monthColumns updated - reinitializing table with', monthColumns.length, 'months');
    // テーブルの完全な再初期化が必要な場合
    setTimeout(() => {
      initializeTableColumns();
      prepareTableData();
      updateTable();
    }, 100); // DOMの更新を待つ
  }

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

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-6">
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
  <div class="bg-white shadow rounded-lg mb-2">
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
            <div class="flex gap-4 overflow-x-auto" style="height: 200px;">
              {#each grants.filter(g => g.status === 'in_progress') as grant}
                <div 
                  class="border rounded-lg px-3 py-2 hover:shadow-md transition-shadow {selectedGrant?.id === grant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} flex-shrink-0 w-80 h-24 relative group"
                >
                  <div 
                    class="cursor-pointer h-full"
                    on:click={() => selectGrant(grant)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && selectGrant(grant)}
                  >
                    <!-- 1行目: 助成金コード + 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
                    <div class="flex justify-between items-start mb-1">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        {#if grant.grantCode}
                          <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {grant.grantCode}
                          </span>
                        {/if}
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

                    <!-- 2行目: 期間 + 予算額 -->
                    <div class="flex justify-between items-center mb-1 text-xs">
                      <div class="{getPeriodColor(grant.endDate)}">
                        {#if grant.startDate && grant.endDate}
                          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
                        {:else}
                          期間未設定
                        {/if}
                      </div>
                      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
                    </div>

                    <!-- 3行目: 使用額 + 残額 -->
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
              <div class="flex gap-4 overflow-x-auto" style="height: 200px;">
                {#each filteredCompletedGrants as grant}
                <div 
                  class="border rounded-lg px-3 py-2 hover:shadow-md transition-shadow {selectedGrant?.id === grant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} opacity-75 flex-shrink-0 w-80 h-24 relative group"
                >
                  <div 
                    class="cursor-pointer h-full"
                    on:click={() => selectGrant(grant)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && selectGrant(grant)}
                  >
                    <!-- 1行目: 助成金コード + 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
                    <div class="flex justify-between items-start mb-1">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        {#if grant.grantCode}
                          <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {grant.grantCode}
                          </span>
                        {/if}
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

                    <!-- 2行目: 期間 + 予算額 -->
                    <div class="flex justify-between items-center mb-1 text-xs">
                      <div class="{getPeriodColor(grant.endDate)}">
                        {#if grant.startDate && grant.endDate}
                          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
                        {:else}
                          期間未設定
                        {/if}
                      </div>
                      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
                    </div>

                    <!-- 3行目: 使用額 + 残額 -->
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
              <div class="flex gap-4 overflow-x-auto" style="height: 200px;">
                {#each filteredReportedGrants as grant}
                <div 
                  class="border rounded-lg px-3 py-2 hover:shadow-md transition-shadow {selectedGrant?.id === grant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} opacity-60 flex-shrink-0 w-80 h-24 relative group"
                >
                  <div 
                    class="cursor-pointer h-full"
                    on:click={() => selectGrant(grant)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && selectGrant(grant)}
                  >
                    <!-- 1行目: 助成金コード + 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
                    <div class="flex justify-between items-start mb-1">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        {#if grant.grantCode}
                          <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {grant.grantCode}
                          </span>
                        {/if}
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

                    <!-- 2行目: 期間 + 予算額 -->
                    <div class="flex justify-between items-center mb-1 text-xs">
                      <div class="{getPeriodColor(grant.endDate)}">
                        {#if grant.startDate && grant.endDate}
                          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
                        {:else}
                          期間未設定
                        {/if}
                      </div>
                      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
                    </div>

                    <!-- 3行目: 使用額 + 残額 -->
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
    
    <div class="p-4">
          
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
            <div class="budget-table-container">
              <div bind:this={tableElement} class="tabulator-table"></div>
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

        <!-- 月別スケジュール選択 - デバッグ版 -->
        <div class="mb-6 p-4 border-2 border-red-500 bg-red-50">
          <h3 class="text-red-800 font-bold mb-2">🔴 MonthSelector テスト</h3>
          <p class="text-red-700 mb-2">grants.length: {grants.length}</p>
          <p class="text-red-700 mb-2">selectedMonths.size: {selectedMonths.size}</p>
          
          <MonthSelector 
            {grants}
            selectedMonths={Array.from(selectedMonths)}
            title="利用予定月（テスト版）"
            showGrouping={true}
            on:change={(e) => {
              console.log("MonthSelector change event:", e.detail);
              selectedMonths = new Set(e.detail);
            }}
          />
          <p class="text-sm text-red-600 mt-2 font-bold">↑ 新しいMonthSelectorコンポーネントが表示されているはずです</p>
        </div>

        <!-- 従来の条件付き表示（バックアップ用・削除予定） -->
        {#if false && budgetItemForm.grantId}
          {@const formGrant = grants.find(g => g.id === parseInt(budgetItemForm.grantId))}
          {#if formGrant && formGrant.startDate && formGrant.endDate}
            {@const formAvailableMonths = generateMonthsFromGrant(formGrant)}
            {#if formAvailableMonths.length > 0}
              <!-- 旧UI（使用されない） -->
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
        {:else}
          <!-- 旧メッセージ（使用されない） -->
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
    padding: 8px 12px;
    font-size: 0.875rem;
    vertical-align: middle;
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