<script lang="ts">
  import type { PageData } from './$types';
  import { writable } from 'svelte/store';
  import { invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { AllocationSplit, BudgetItem, Grant, Transaction } from '$lib/types/models';
  import type { SerializedGrant, SerializedBudgetItem, SerializedTransaction } from '$lib/types/serialized';
  import SimpleFilterPreset from '$lib/components/SimpleFilterPreset.svelte';
  import { safeGetItem, safeSetItem } from '$lib/utils/storageUtils';
  import { FILTER_STATE_STORAGE_KEY } from '$lib/types/presets';
  
  // プリセットコンポーネントへの参照
  let presetComponent: SimpleFilterPreset;
  
  export let data: PageData;
  
  // 定数
  const LEFT_PANE_WIDTH = 300; // px
  const DEFAULT_BUDGET_STATUS = 'active';
  const DEFAULT_TRANSACTION_STATUS = 'all';
  
  // 型定義
  interface BudgetItemWithGrant extends SerializedBudgetItem {
    grant?: SerializedGrant;
    grantName: string;
    grantStatus: string;
    grantStartDate: string;
    grantEndDate: string;
    remaining: number;
    allocatedAmount?: number;
    schedules?: Array<{ month: number; year: number; monthlyBudget?: number | null }>;
  }
  
  interface TransactionRow {
    id: string;
    date: string;
    journalNumber: string;
    description: string;
    detailDescription: string;
    amount: number;
    allocatedAmount: number;
    unallocatedAmount: number;
    allocationStatus: 'unallocated' | 'partial' | 'full';
    allocationCount: number;
    allocations: Array<AllocationSplit & { 
      budgetItem: SerializedBudgetItem & { grant: SerializedGrant } 
    }>;
    supplier: string;
    department: string;
    account: string;
    memo: string;
    tags: string;
    item: string;
    receiptIds: string[];
    dateObj: Date;
    primaryGrantName: string;
    primaryBudgetItemName: string;
    detailId: string | null;
    freeDealId: string | null;
  }
  
  interface SortField {
    field: string;
    direction: 'asc' | 'desc';
  }
  
  interface AllocationFormData {
    budgetItemId: string;
    amount: string;
    note: string;
  }
  
  // ペイン表示状態の管理
  let showLeftPane = true;
  let showRightPane = false;
  
  // 選択状態の管理（単一選択に変更）
  let selectedBudgetItem: BudgetItemWithGrant | null = null;
  let selectedTransaction: TransactionRow | null = null;
  let selectedAllocationIds: Set<string> = new Set(); // 選択された割当ID
  let isDeleting = false; // 削除処理中フラグ
  let checkedTransactions = new Set<string>();
  
  // キーボードショートカット用の行選択状態
  let selectedRowIndex = -1;
  
  // 左ペインフィルター状態
  let budgetItemStatusFilter = DEFAULT_BUDGET_STATUS;
  let budgetItemGrantFilter = '';
  let budgetItemCategoryFilter = '';
  
  // 月別残額表示用の状態
  let selectedMonth = new Date().toISOString().slice(0, 7); // YYYY-MM形式
  let showMonthlyBalance = false;
  let filterByMonthlyBudget = false; // 選択月の予算がある項目のみ表示

  // WAM CSV出力フィルター用の状態
  let wamFilterGrantId = '';
  let wamFilterYearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM形式
  
  // 左ペインソート状態（複数ソート対応）
  let sortFields: SortField[] = [{field: 'grantName', direction: 'asc'}];
  
  // 取引ソート状態（複数ソート対応）
  let transactionSortFields: SortField[] = [{field: 'date', direction: 'desc'}];
  
  // 後方互換性のためのgetter（削除予定）
  $: transactionSortField = transactionSortFields.length > 0 ? transactionSortFields[0].field : 'date';
  $: transactionSortDirection = transactionSortFields.length > 0 ? transactionSortFields[0].direction : 'desc';
  
  // ページネーション状態
  let currentPage = 1;
  let itemsPerPage = 100;
  let pageInputValue = '1';
  
  // 後方互換性のためのgetter
  $: sortField = sortFields.length > 0 ? sortFields[0].field : 'grantName';
  $: sortDirection = sortFields.length > 0 ? sortFields[0].direction : 'asc';
  
  // フィルター状態（廃止予定）
  let filterStatus = DEFAULT_TRANSACTION_STATUS;
  let filterGrant = ''; // 助成金フィルター（廃止予定）
  let searchQuery = ''; // 検索（廃止予定）
  let startDate = ''; // 開始日（廃止予定）
  let endDate = ''; // 終了日（廃止予定）
  
  // ヘッダーフィルター状態（初期値は後で設定）
  // 助成金の日付範囲から初期値を計算
  function getDefaultDateRange() {
    if (data.grants && data.grants.length > 0) {
      // active（実施中）とcompleted（終了）の助成金のみ対象
      const validGrants = data.grants.filter(g => 
        (g.status === 'active' || g.status === 'completed') && 
        g.startDate && g.endDate
      );
      
      if (validGrants.length > 0) {
        const startDates = validGrants.map(g => new Date(g.startDate!));
        const endDates = validGrants.map(g => new Date(g.endDate!));
        
        const earliestStart = new Date(Math.min(...startDates.map(d => d.getTime())));
        const latestEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
        
        return {
          startDate: earliestStart.toISOString().split('T')[0],
          endDate: latestEnd.toISOString().split('T')[0]
        };
      }
    }
    return { startDate: '', endDate: '' };
  }
  
  const defaultDates = getDefaultDateRange();
  
  let headerFilters = {
    primaryGrantName: '',
    primaryBudgetItemName: '',
    account: '',
    department: '',
    supplier: '',
    item: '',
    description: '',
    detailDescription: '',
    memo: '',
    tags: '',
    minAmount: '',
    maxAmount: '',
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate
  };
  

  
  // チェックボックス式フィルター状態
  let checkboxFilters = {
    allocationStatus: new Set(['unallocated', 'partial', 'full']),
    account: new Set(),
    department: new Set(),
    supplier: new Set(),
    item: new Set(),
    primaryGrantName: new Set(),
    primaryBudgetItemName: new Set()
  };
  
  // チェックボックスフィルターの表示状態
  let showCheckboxFilter = {
    allocationStatus: false,
    account: false,
    department: false,
    supplier: false,
    item: false,
    primaryGrantName: false,
    primaryBudgetItemName: false
  };
  
  // 検索とヒントの表示状態
  let showSearch = false;
  let showHints = false;

  // Shift+クリック範囲選択用の状態管理
  let lastClickedGrantIndex = -1;
  let lastClickedBudgetItemIndex = -1;
  let lastClickedTransactionIndex = -1;
  
  // フィルターの一意な値を取得
  $: uniqueValues = {
    account: [...new Set(transactionData.map(t => t.account).filter(v => v))],
    department: [...new Set(transactionData.map(t => t.department).filter(v => v))],
    supplier: [...new Set(transactionData.map(t => t.supplier).filter(v => v))],
    item: [...new Set(transactionData.map(t => t.item).filter(v => v))],
    primaryGrantName: (() => {
      // 左ペインに表示されている助成金名のリストを取得
      const leftPaneGrantNames = new Set(filteredBudgetItems.map(item => item.grantName));
      
      // transactionDataから助成金名を取得し、左ペインに表示されているもののみに限定
      const values = [...new Set(transactionData.map(t => t.primaryGrantName).filter(v => v && leftPaneGrantNames.has(v)))];
      // 未割当の取引があるかチェック（助成金が割り当てられていない取引）
      const hasUnassigned = transactionData.some(t => 
        !t.allocations || 
        t.allocations.length === 0 || 
        t.allocations.every(allocation => !allocation.budgetItem.grant)
      );
      return hasUnassigned ? ['- (未割当)', ...values] : values;
    })(),
    primaryBudgetItemName: (() => {
      // 選択された助成金でフィルタリング
      const selectedGrants = checkboxFilters.primaryGrantName;
      
      // 選択された助成金に属する予算項目を取得
      let values;
      if (selectedGrants.size > 0 && !selectedGrants.has('- (未割当)')) {
        // 助成金が選択されている場合、その助成金に属する予算項目のみ
        values = [...new Set(
          transactionData
            .filter(t => t.primaryGrantName && selectedGrants.has(t.primaryGrantName))
            .map(t => t.primaryBudgetItemName)
            .filter(v => v)
        )];
      } else {
        // 助成金が選択されていない、または「未割当」が含まれる場合は全て表示
        values = [...new Set(transactionData.map(t => t.primaryBudgetItemName).filter(v => v))];
      }
      // 未割当の取引があるかチェック（予算項目が全く割り当てられていない取引）
      const hasUnassigned = transactionData.some(t => 
        !t.allocations || 
        t.allocations.length === 0
      );
      return hasUnassigned ? ['- (未割当)', ...values] : values;
    })()
  };
  
  // 初期化フラグ
  let isInitialized = false;
  let isRestoringState = false; // 状態復元中フラグ
  let isStateRestored = false;  // 状態復元完了フラグ
  let isMounted = false; // マウント完了フラグ
  
  // 初期化時にチェックボックスフィルターを設定（一度だけ実行）
  $: if (!isInitialized && uniqueValues.account.length > 0) {
    checkboxFilters.account = new Set(uniqueValues.account);
    checkboxFilters.department = new Set(uniqueValues.department);
    checkboxFilters.supplier = new Set(uniqueValues.supplier);
    checkboxFilters.item = new Set(uniqueValues.item);
    checkboxFilters.primaryGrantName = new Set(uniqueValues.primaryGrantName);
    checkboxFilters.primaryBudgetItemName = new Set(uniqueValues.primaryBudgetItemName);
    isInitialized = true;
  }
  
  // 初期化完了後に状態復元を実行（一度だけ）
  $: if (isInitialized && !isStateRestored && browser && isMounted) {
    loadFilterState();
    isStateRestored = true;
  }
  
  // プリセット状態
  
  // モーダル状態
  // モーダル削除のため、この変数は不要
  // let showAllocationModal = false;
  
  // 右ペインの状態管理（新規追加）
  let rightPaneMode: 'view' | 'create' | 'edit' = 'view';
  let allocationForm: AllocationFormData = {
    budgetItemId: '',
    amount: '',
    note: ''
  };
  let editingAllocation: (AllocationSplit & { 
    budgetItem: SerializedBudgetItem & { grant: SerializedGrant } 
  }) | null = null;
  
  // ユーティリティ関数
  function formatDate(date: string | Date | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ja-JP');
  }
  
  function formatShortDate(date: string | Date | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ja-JP').slice(2).replace(/\//g, '/');
  }
  
  function formatCurrency(amount: number): string {
    return `¥${amount.toLocaleString()}`;
  }
  
  // 月別残額を計算する関数
  function calculateMonthlyBalance(budgetItem: BudgetItemWithGrant, month: string) {
    // monthはYYYY-MM形式
    const [year, monthNum] = month.split('-').map(Number);
    
    // 該当月の予算額を取得（schedulesフィールドから実際の月額を取得）
    const monthSchedule = budgetItem.schedules?.find(
      (schedule: any) => schedule.year === year && schedule.month === monthNum
    );
    
    // schedulesから月別予算額を取得（monthlyBudgetフィールド）、なければ0
    const monthlyBudget = monthSchedule?.monthlyBudget || 0;
    
    // 該当月の割当済み額を計算
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0, 23, 59, 59);
    
    // data.allocationsを使用して該当月の割当額を計算
    const monthlyAllocations = (data.allocations || [])
      .filter((alloc: any) => {
        if (alloc.budgetItemId !== budgetItem.id) return false;
        // transactionの日付を取得
        const transaction = data.transactions.find((t: any) => t.id === alloc.transactionId);
        if (!transaction) return false;
        const allocDate = new Date(transaction.date);
        const isInMonth = allocDate >= monthStart && allocDate <= monthEnd;
        
        // デバッグ: 人件費の6月データを詳しく見る
        if (budgetItem.name === '人件費' && month === '2025-06' && isInMonth) {
          console.log('Found 6月 allocation for 人件費:', {
            alloc,
            transaction,
            date: transaction.date,
            allocDate: allocDate.toISOString(),
            monthStart: monthStart.toISOString(),
            monthEnd: monthEnd.toISOString()
          });
        }
        
        return isInMonth;
      });
    
    const monthlyAllocated = monthlyAllocations.reduce((sum: number, alloc: any) => sum + alloc.amount, 0);
    
    // デバッグ: 賃金（職員）の割当を確認
    if (budgetItem.id === 16 && (month === '2025-06' || month === '2025-07' || month === '2025-08')) {
      console.log(`[月残額計算] ${budgetItem.name} - ${month}`, {
        budgetItemId: budgetItem.id,
        monthlyBudget,
        monthlyAllocationsCount: monthlyAllocations.length,
        monthlyAllocated,
        remaining: monthlyBudget - monthlyAllocated,
        sampleAllocations: monthlyAllocations.slice(0, 2)
      });
    }
    
  
    
    return {
      budget: monthlyBudget,
      allocated: monthlyAllocated,
      remaining: monthlyBudget - monthlyAllocated
    };
  }
  
  // 全予算項目の月別合計を計算
  function calculateMonthlyTotals(month: string) {
    let totalBudget = 0;
    let totalAllocated = 0;
    
    // sortedBudgetItemsが存在しない場合はデフォルト値を返す
    if (!sortedBudgetItems || sortedBudgetItems.length === 0) {
      return {
        budget: 0,
        allocated: 0,
        remaining: 0
      };
    }
    
    sortedBudgetItems.forEach(item => {
      const balance = calculateMonthlyBalance(item, month);
      totalBudget += balance.budget;
      totalAllocated += balance.allocated;
    });
    
    return {
      budget: totalBudget,
      allocated: totalAllocated,
      remaining: totalBudget - totalAllocated
    };
  }
  
  function cleanBudgetItemName(name: string): string {
    // 予算項目名から月表記を削除（例: "項目名(4月)" → "項目名"）
    return name.replace(/\([^)]*月[^)]*\)/g, '').trim();
  }
  
  // 予算項目データの準備（フラットテーブル用）
  $: budgetItemsWithGrant = data.budgetItems.map(item => {
    const grant = data.grants.find(g => g.id === item.grantId);
    // 割当額の合計を計算（リアルタイム更新）
    const allocatedAmount = data.allocations
      .filter(alloc => alloc.budgetItemId === item.id)
      .reduce((sum, alloc) => sum + alloc.amount, 0);
    const remaining = (item.budgetedAmount || 0) - allocatedAmount;
    
    return {
      ...item,
      name: cleanBudgetItemName(item.name),
      grant,
      grantName: grant?.name || '',
      grantStatus: grant?.status || DEFAULT_BUDGET_STATUS,
      grantStartDate: formatDate(grant?.startDate),
      grantEndDate: formatDate(grant?.endDate),
      remaining: remaining
    } as unknown as BudgetItemWithGrant;
  });

  // 左ペインフィルター適用
  $: filteredBudgetItems = budgetItemsWithGrant.filter(item => {
    // ステータスフィルター（デフォルト: 進行中のみ）
    if (budgetItemStatusFilter !== 'all' && item.grantStatus !== budgetItemStatusFilter) return false;
    
    // 助成金フィルター
    if (budgetItemGrantFilter && !item.grantName.toLowerCase().includes(budgetItemGrantFilter.toLowerCase())) return false;
    
    // カテゴリフィルター
    if (budgetItemCategoryFilter && (!item.category || !item.category.toLowerCase().includes(budgetItemCategoryFilter.toLowerCase()))) return false;
    
    // 月予算フィルター（選択月の予算がある項目のみ）
    if (showMonthlyBalance && filterByMonthlyBudget && selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      
      // 該当月のスケジュールを探し、金額が0より大きいかチェック
      const monthSchedule = item.schedules?.find(
        (schedule: any) => schedule.year === year && schedule.month === month
      );
      
      // monthlyBudgetフィールドをチェック
      const hasMonthlyBudget = monthSchedule && (monthSchedule as any).monthlyBudget && (monthSchedule as any).monthlyBudget > 0;
      
      if (!hasMonthlyBudget) return false;
    }
    
    return true;
  });

  // 助成金選択時の助成期間プリセット自動登録
  $: if (selectedBudgetItem && presetComponent && selectedBudgetItem.grantStartDate && selectedBudgetItem.grantEndDate) {
    // Register grant period preset using the component's method
    // The component will handle date format conversion internally
    presetComponent.registerGrantPeriodPreset(
      selectedBudgetItem.grantName,
      selectedBudgetItem.grantStartDate,
      selectedBudgetItem.grantEndDate
    );
  }

  // 左ペインソート適用（複数ソート対応）
  $: sortedBudgetItems = [...filteredBudgetItems].sort((a, b) => {
    for (const sortConfig of sortFields) {
      let aValue, bValue;
      
      switch (sortConfig.field) {
        case 'grantName':
          aValue = a.grantName;
          bValue = b.grantName;
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'category':
          aValue = a.category || '';
          bValue = b.category || '';
          break;
        case 'remaining':
          aValue = a.remaining;
          bValue = b.remaining;
          break;
        case 'grantStatus':
          aValue = a.grantStatus;
          bValue = b.grantStatus;
          break;
        case 'grantStartDate':
          aValue = a.grant?.startDate || '';
          bValue = b.grant?.startDate || '';
          break;
        case 'grantEndDate':
          aValue = a.grant?.endDate || '';
          bValue = b.grant?.endDate || '';
          break;
        default:
          continue;
      }
      
      let result = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        result = aValue.localeCompare(bValue);
      } else {
        result = Number(aValue || 0) - Number(bValue || 0);
      }
      
      if (result !== 0) {
        return sortConfig.direction === 'asc' ? result : -result;
      }
    }
    return 0;
  });

  // 取引ソート関数（複数ソート対応）
  function handleTransactionSort(field: string, event?: MouseEvent) {
    const isShiftPressed = event?.shiftKey || false;
    
    if (isShiftPressed) {
      // Shiftキー押下時：複数ソート（追加・更新、最大3つまで）
      const newFields = [...transactionSortFields]; // イミュータブル更新
      const existingIndex = newFields.findIndex(s => s.field === field);
      
      if (existingIndex >= 0) {
        // 既存のソート条件を更新（方向を反転）
        newFields[existingIndex] = {
          ...newFields[existingIndex],
          direction: newFields[existingIndex].direction === 'asc' ? 'desc' : 'asc'
        };
      } else if (newFields.length < 3) {
        // 新しいソート条件を追加（最大3つまで）
        const defaultDirection = field === 'date' ? 'desc' : 'asc';
        newFields.push({ field, direction: defaultDirection });
      }
      
      transactionSortFields = newFields;
    } else {
      // 通常クリック：単一ソート（リセット）
      const existingField = transactionSortFields.find(s => s.field === field);
      const defaultDirection = field === 'date' ? 'desc' : 'asc';
      
      if (existingField) {
        // 同じフィールドの場合は方向を反転
        transactionSortFields = [{ 
          field, 
          direction: existingField.direction === 'asc' ? 'desc' : 'asc' 
        }];
      } else {
        // 新しいフィールドの場合はデフォルト方向で開始
        transactionSortFields = [{ field, direction: defaultDirection }];
      }
    }
    
    // ソート変更時に状態を保存
    saveFilterState();
  }

  // ソート関数（複数ソート対応）
  function handleSort(field: string, event?: MouseEvent) {
    const isShiftPressed = event?.shiftKey || false;
    
    if (isShiftPressed) {
      // Shiftキー押下時：複数ソート（追加・更新）
      const existingIndex = sortFields.findIndex(s => s.field === field);
      
      if (existingIndex >= 0) {
        // 既存のソート条件を更新（方向を反転）
        const existing = sortFields[existingIndex];
        sortFields[existingIndex] = {
          field,
          direction: existing.direction === 'asc' ? 'desc' : 'asc'
        };
      } else {
        // 新しいソート条件を追加
        sortFields.push({ field, direction: 'asc' });
      }
      sortFields = sortFields; // リアクティブ更新
    } else {
      // 通常クリック：単一ソート（リセット）
      const existingField = sortFields.find(s => s.field === field);
      
      if (existingField) {
        // 同じフィールドの場合は方向を反転
        sortFields = [{ field, direction: existingField.direction === 'asc' ? 'desc' : 'asc' }];
      } else {
        // 新しいフィールドの場合は昇順で開始
        sortFields = [{ field, direction: 'asc' }];
      }
    }
  }

  // ステータス表示用関数
  function getStatusLabel(status: string): string {
    switch (status) {
      case 'active': return '進行中';
      case 'completed': return '完了';
      case 'applied': return '申請中';
      case 'reported': return '報告済';
      default: return status;
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'badge-success';
      case 'completed': return 'badge-neutral';
      case 'applied': return 'badge-warning';
      case 'reported': return 'badge-info';
      default: return 'badge-ghost';
    }
  }

  // 取引データの準備（一度だけ実行）
  let transactionData = data.transactions.map(transaction => {
    // 最大割当額の助成金と予算項目を特定
    let primaryGrantName = '';
    let primaryBudgetItemName = '';
    if (transaction.allocations && transaction.allocations.length > 0) {
      const maxAllocation = transaction.allocations.reduce((max, alloc) => 
        alloc.amount > max.amount ? alloc : max
      );
      primaryGrantName = maxAllocation.budgetItem.grant.name || '';
      primaryBudgetItemName = maxAllocation.budgetItem.name || '';
    }

    return {
      id: transaction.id,
      date: formatDate(transaction.date),
      journalNumber: transaction.journalNumber.toString(),
      description: transaction.description || '',
      detailDescription: transaction.detailDescription || '',
      amount: transaction.amount,
      allocatedAmount: transaction.allocatedAmount,
      unallocatedAmount: transaction.unallocatedAmount,
      allocationStatus: transaction.allocationStatus,
      allocationCount: transaction.allocations.length,
      allocations: transaction.allocations,
      supplier: transaction.supplier || '',
      department: transaction.department || '',
      account: transaction.account || '',
      tags: transaction.tags || '',
      item: transaction.item || '',
      receiptIds: (() => {
        if (!transaction.receiptIds) return [];
        if (typeof transaction.receiptIds === 'string') {
          try {
            return JSON.parse(transaction.receiptIds);
          } catch {
            // Failed to parse receiptIds, return empty array
            return [];
          }
        }
        return Array.isArray(transaction.receiptIds) ? transaction.receiptIds : [];
      })(),
      dateObj: new Date(transaction.date),
      primaryGrantName: primaryGrantName,
      primaryBudgetItemName: primaryBudgetItemName,
      detailId: transaction.detailId || null,
      freeDealId: transaction.freeDealId || null
    };
  });
  
  // 金額と日付の範囲を計算して初期値を設定
  $: if (transactionData.length > 0) {
    // 金額の初期値設定
    if (!headerFilters.minAmount && !headerFilters.maxAmount) {
      const amounts = transactionData.map(t => t.amount).filter(a => a != null && !isNaN(a));
      if (amounts.length > 0) {
        headerFilters.minAmount = Math.min(...amounts).toString();
        headerFilters.maxAmount = Math.max(...amounts).toString();
      }
    }
    
    // 日付の初期値設定
    if (!headerFilters.startDate && !headerFilters.endDate) {
      const dates = transactionData.map(t => t.dateObj).filter(d => d instanceof Date && !isNaN(d.getTime()));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        headerFilters.startDate = minDate.toISOString().split('T')[0];
        headerFilters.endDate = maxDate.toISOString().split('T')[0];
      }
    }
  }
  
  // データ更新時の処理（invalidateAll等による更新時のみ）
  let prevTransactions = data.transactions;
  $: if (data.transactions && data.transactions !== prevTransactions) {
    prevTransactions = data.transactions;
    transactionData = data.transactions.map(transaction => {
      // 最大割当額の助成金と予算項目を特定
      let primaryGrantName = '';
      let primaryBudgetItemName = '';
      if (transaction.allocations && transaction.allocations.length > 0) {
        const maxAllocation = transaction.allocations.reduce((max, alloc) => 
          alloc.amount > max.amount ? alloc : max
        );
        primaryGrantName = maxAllocation.budgetItem.grant.name || '';
        primaryBudgetItemName = maxAllocation.budgetItem.name || '';
      }

      return {
        id: transaction.id,
        date: formatDate(transaction.date),
        journalNumber: transaction.journalNumber.toString(),
        description: transaction.description || '',
        detailDescription: transaction.detailDescription || '',
        amount: transaction.amount,
        allocatedAmount: transaction.allocatedAmount,
        unallocatedAmount: transaction.unallocatedAmount,
        allocationStatus: transaction.allocationStatus,
        allocationCount: transaction.allocations.length,
        allocations: transaction.allocations,
        supplier: transaction.supplier || '',
        department: transaction.department || '',
        account: transaction.account || '',
        tags: transaction.tags || '',
        item: transaction.item || '',
        receiptIds: (() => {
          if (!transaction.receiptIds) return [];
          if (typeof transaction.receiptIds === 'string') {
            try {
              return JSON.parse(transaction.receiptIds);
            } catch {
              // Failed to parse receiptIds, return empty array
              return [];
            }
          }
          return Array.isArray(transaction.receiptIds) ? transaction.receiptIds : [];
        })(),
        dateObj: new Date(transaction.date),
        primaryGrantName: primaryGrantName,
        primaryBudgetItemName: primaryBudgetItemName,
        detailId: transaction.detailId || null,
        freeDealId: transaction.freeDealId || null
      };
    });
  }
  
  // チェックされた取引の合計額
  $: checkedTotal = Array.from(checkedTransactions).reduce((sum, id) => {
    const transaction = transactionData.find(t => t.id === id);
    return sum + (transaction?.amount || 0);
  }, 0);
  
  // 期間フィルター用のキャッシュ
  let startDateObj: Date | null = null;
  let endDateObj: Date | null = null;
  $: startDateObj = startDate ? new Date(startDate) : null;
  $: endDateObj = endDate ? new Date(endDate) : null;
  
  // フィルタリング処理（ヘッダーフィルター対応）
  $: filteredTransactionData = transactionData.filter(row => {
    // 既存のフィルター
    if (filterStatus === 'allocated' && row.allocationStatus !== 'full') return false;
    if (filterStatus === 'unallocated' && row.allocationStatus !== 'unallocated') return false;
    if (filterStatus === 'partial' && row.allocationStatus !== 'partial') return false;
    
    if (filterGrant && !row.allocations.some(alloc => alloc.budgetItem.grantId.toString() === filterGrant)) return false;
    
    if (startDateObj && row.dateObj < startDateObj) return false;
    if (endDateObj && row.dateObj > endDateObj) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchText = (
        row.description.toLowerCase() + ' ' +
        row.detailDescription.toLowerCase() + ' ' +
        row.supplier.toLowerCase() + ' ' +
        row.journalNumber + ' ' +
        row.account.toLowerCase()
      );
      if (!searchText.includes(query)) return false;
    }
    
    // ヘッダーフィルター（テキスト）
    if (headerFilters.primaryGrantName && !row.primaryGrantName.toLowerCase().includes(headerFilters.primaryGrantName.toLowerCase())) return false;
    if (headerFilters.primaryBudgetItemName && !row.primaryBudgetItemName.toLowerCase().includes(headerFilters.primaryBudgetItemName.toLowerCase())) return false;
    if (headerFilters.account && !row.account.toLowerCase().includes(headerFilters.account.toLowerCase())) return false;
    if (headerFilters.department && !row.department.toLowerCase().includes(headerFilters.department.toLowerCase())) return false;
    if (headerFilters.supplier && !row.supplier.toLowerCase().includes(headerFilters.supplier.toLowerCase())) return false;
    if (headerFilters.item && !row.item.toLowerCase().includes(headerFilters.item.toLowerCase())) return false;
    if (headerFilters.description && !row.description.toLowerCase().includes(headerFilters.description.toLowerCase())) return false;
    if (headerFilters.detailDescription && !row.detailDescription.toLowerCase().includes(headerFilters.detailDescription.toLowerCase())) return false;
    if (headerFilters.tags && !row.tags.toLowerCase().includes(headerFilters.tags.toLowerCase())) return false;
    
    // ヘッダーフィルター（金額範囲）
    if (headerFilters.minAmount && row.amount < parseFloat(headerFilters.minAmount)) return false;
    if (headerFilters.maxAmount && row.amount > parseFloat(headerFilters.maxAmount)) return false;
    
    // ヘッダーフィルター（日付範囲）
    if (headerFilters.startDate && row.dateObj < new Date(headerFilters.startDate)) return false;
    if (headerFilters.endDate && row.dateObj > new Date(headerFilters.endDate)) return false;
    
    // チェックボックスフィルター
    if (!checkboxFilters.allocationStatus.has(row.allocationStatus)) return false;
    if (row.account && !checkboxFilters.account.has(row.account)) return false;
    if (row.department && !checkboxFilters.department.has(row.department)) return false;
    if (row.supplier && !checkboxFilters.supplier.has(row.supplier)) return false;
    if (row.item && !checkboxFilters.item.has(row.item)) return false;
    // 助成金フィルター（未割当オプション対応）
    const isUnassignedGrant = !row.allocations || 
                              row.allocations.length === 0 || 
                              !row.primaryGrantName;
    
    if (checkboxFilters.primaryGrantName.size > 0) {
      // 何かしらの助成金が選択されている場合
      if (isUnassignedGrant) {
        // 未割当の取引の場合
        if (!checkboxFilters.primaryGrantName.has('- (未割当)')) return false;
      } else {
        // 割当済みの取引の場合
        if (!checkboxFilters.primaryGrantName.has(row.primaryGrantName)) return false;
      }
    }
    
    // 予算項目フィルター（未割当オプション対応）
    const isUnassignedBudget = !row.allocations || 
                               row.allocations.length === 0 || 
                               !row.primaryBudgetItemName;
    
    if (checkboxFilters.primaryBudgetItemName.size > 0) {
      // 何かしらの予算項目が選択されている場合
      if (isUnassignedBudget) {
        // 未割当の取引の場合
        if (!checkboxFilters.primaryBudgetItemName.has('- (未割当)')) return false;
      } else {
        // 割当済みの取引の場合
        if (!checkboxFilters.primaryBudgetItemName.has(row.primaryBudgetItemName)) return false;
      }
    }
    
    return true;
  });

  // ソート処理（複数ソート対応）
  $: sortedTransactionData = [...filteredTransactionData].sort((a, b) => {
    for (const sortConfig of transactionSortFields) {
      let result = 0;
      
      switch (sortConfig.field) {
        case 'date':
          result = a.dateObj.getTime() - b.dateObj.getTime();
          break;
        case 'amount':
        case 'allocatedAmount':
          result = a[sortConfig.field] - b[sortConfig.field];
          break;
        case 'primaryGrantName':
          // 助成金名でソート（空文字は最後に）
          const aGrant = a.primaryGrantName || '';
          const bGrant = b.primaryGrantName || '';
          if (!aGrant && bGrant) result = 1;
          else if (aGrant && !bGrant) result = -1;
          else result = aGrant.localeCompare(bGrant, 'ja');
          break;
        case 'primaryBudgetItemName':
          // 予算項目名でソート（空文字は最後に）
          const aBudget = a.primaryBudgetItemName || '';
          const bBudget = b.primaryBudgetItemName || '';
          if (!aBudget && bBudget) result = 1;
          else if (aBudget && !bBudget) result = -1;
          else result = aBudget.localeCompare(bBudget, 'ja');
          break;
        case 'account':
        case 'department':
        case 'supplier':
        case 'item':
          const aStr = a[sortConfig.field] || '';
          const bStr = b[sortConfig.field] || '';
          result = aStr.localeCompare(bStr);
          break;
        default:
          continue;
      }
      
      if (result !== 0) {
        return sortConfig.direction === 'asc' ? result : -result;
      }
    }
    return 0;
  });
  
  // ページネーション計算
  $: totalPages = Math.ceil(sortedTransactionData.length / itemsPerPage);
  $: startIndex = (currentPage - 1) * itemsPerPage;
  $: endIndex = Math.min(startIndex + itemsPerPage, sortedTransactionData.length);
  $: paginatedTransactionData = sortedTransactionData.slice(startIndex, endIndex);
  
  // フィルターやソートが変更されたらページを1に戻す（復元中・初期化中は除く）
  $: if (!isRestoringState && isInitialized && (filterStatus || filterGrant || searchQuery || startDate || endDate || transactionSortFields)) {
    currentPage = 1;
    pageInputValue = '1';
  }
  
  // ページ変更時のスクロール処理
  function scrollToTableTop() {
    const tableContainer = document.querySelector('.flex-1.overflow-auto.bg-white');
    if (tableContainer) {
      tableContainer.scrollTop = 0;
    }
  }
  
  // ページ変更関数
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      pageInputValue = page.toString();
      scrollToTableTop();
    }
  }
  
  function goToFirstPage() {
    goToPage(1);
  }
  
  function goToLastPage() {
    goToPage(totalPages);
  }
  
  function goToPreviousPage() {
    goToPage(currentPage - 1);
  }
  
  function goToNextPage() {
    goToPage(currentPage + 1);
  }
  
  function handlePageInput() {
    const page = parseInt(pageInputValue);
    if (!isNaN(page)) {
      goToPage(page);
    } else {
      pageInputValue = currentPage.toString();
    }
  }
  
  function handleItemsPerPageChange() {
    currentPage = 1;
    pageInputValue = '1';
    scrollToTableTop();
  }

  
  // フィルター適用後の合計額（メモ化）
  $: filteredTotal = sortedTransactionData.reduce((sum, row) => sum + row.amount, 0);
  
  // 割当状況のラベル
  function getAllocationStatusLabel(status: string): string {
    switch (status) {
      case 'unallocated': return '未割当';
      case 'partial': return '部分割当';
      case 'full': return '完全割当';
      default: return '';
    }
  }
  
  // 割当状況の色
  function getAllocationStatusColor(status: string): string {
    switch (status) {
      case 'unallocated': return 'badge-error';
      case 'partial': return 'badge-warning';
      case 'full': return 'badge-success';
      default: return 'badge-ghost';
    }
  }
  
  // 割当作成フォームを開く
  function openAllocationForm(transaction: TransactionRow) {
    // selectedTransactionは既に設定済み（右ペインは選択済みの取引に対して動作）
    selectedAllocationIds.clear(); // 選択状態をクリア
    selectedAllocationIds = selectedAllocationIds; // リアクティブ更新
    rightPaneMode = 'create';
    allocationForm = {
      budgetItemId: '',
      amount: transaction.unallocatedAmount.toString(),
      note: ''
    };
    editingAllocation = null;
  }
  
  // 割当編集フォームを開く
  function editAllocation(allocation: AllocationSplit & { 
    budgetItem: BudgetItem & { grant: Grant } 
  }) {
    console.log('editAllocation called with:', allocation);
    console.log('budgetItemId:', allocation.budgetItemId);
    editingAllocation = allocation as any;
    allocationForm = {
      budgetItemId: allocation.budgetItemId.toString(),
      amount: allocation.amount.toString(),
      note: allocation.note || ''
    };
    console.log('allocationForm after setting:', allocationForm);
    rightPaneMode = 'edit';
  }
  
  // 割当フォームを閉じる
  function closeAllocationForm() {
    rightPaneMode = 'view';
    // selectedTransactionは維持（右ペインの詳細表示は継続）
    editingAllocation = null;
    allocationForm = {
      budgetItemId: '',
      amount: '',
      note: ''
    };
  }
  
  // 残額を自動入力
  function setRemainingAmount() {
    console.log('setRemainingAmount called');
    console.log('selectedTransaction:', selectedTransaction);
    
    if (selectedTransaction) {
      // TransactionRow型として扱い、unallocatedAmountを取得
      const txRow = selectedTransaction as TransactionRow;
      console.log('Transaction as TransactionRow:', {
        id: txRow.id,
        amount: txRow.amount,
        allocatedAmount: txRow.allocatedAmount,
        unallocatedAmount: txRow.unallocatedAmount
      });
      
      // unallocatedAmountを優先的に使用
      if (txRow.unallocatedAmount !== undefined && txRow.unallocatedAmount !== null && txRow.unallocatedAmount >= 0) {
        allocationForm.amount = txRow.unallocatedAmount.toString();
        console.log('Set amount from unallocatedAmount:', allocationForm.amount);
      } else {
        // フォールバック計算（念のため）
        const total = txRow.amount || 0;
        const allocated = txRow.allocatedAmount || 0;
        const remaining = Math.max(0, total - allocated);
        allocationForm.amount = remaining.toString();
        console.log('Fallback calculation - total:', total, 'allocated:', allocated, 'remaining:', remaining);
      }
    } else {
      console.log('No selected transaction');
      allocationForm.amount = '0';
    }
  }
  
  // 予算項目の表示名を取得
  function getBudgetItemDisplayName(budgetItem: BudgetItem): string {
    const grant = data.grants.find(g => g.id === budgetItem.grantId);
    return `${grant?.name || ''} - ${budgetItem.name}`;
  }
  
  // 一括割当フォーム状態
  let bulkAllocationFormRef: HTMLFormElement | null = null;
  
  // 一括割当処理（SvelteKit標準パターン）
  function handleBulkAllocation() {
    if (!selectedBudgetItem || checkedTransactions.size === 0) return;
    
    // hidden フォームを送信してSvelteKitのCSRF保護を活用
    if (bulkAllocationFormRef) {
      bulkAllocationFormRef.requestSubmit();
    }
  }
  
  // 一括割当フォーム送信後の処理
  function handleBulkAllocationResult() {
    return async ({ result, update }: { result: { type: string; data?: any }, update: () => Promise<void> }) => {
      if (result.type === 'success') {
        // 成功時の処理
        const allocatedCount = result.data?.allocatedCount || checkedTransactions.size;
        checkedTransactions.clear();
        checkedTransactions = checkedTransactions;
        
        // ページデータを再読み込み
        await update();
        await invalidateAll();
        
        // データの再取得を強制
        data = data;
        
        // 予算項目の残額を強制的に再計算
        budgetItemsWithGrant = data.budgetItems.map(item => {
          const grant = data.grants.find(g => g.id === item.grantId);
          const allocatedAmount = data.allocations
            .filter(alloc => alloc.budgetItemId === item.id)
            .reduce((sum, alloc) => sum + alloc.amount, 0);
          const remaining = (item.budgetedAmount || 0) - allocatedAmount;
          
          return {
            ...item,
            name: cleanBudgetItemName(item.name),
            grant,
            grantName: grant?.name || '',
            grantStatus: grant?.status || DEFAULT_BUDGET_STATUS,
            grantStartDate: formatDate(grant?.startDate),
            grantEndDate: formatDate(grant?.endDate),
            remaining,
            allocatedAmount,
            schedules: item.schedules || []
          };
        }) as unknown as BudgetItemWithGrant[];
        
        // 選択中の予算項目を再選択
        if (selectedBudgetItem) {
          selectedBudgetItem = budgetItemsWithGrant.find(item => item.id === selectedBudgetItem!.id) || null;
        }
        
        // アラート削除（静かに完了）
      } else if (result.type === 'failure') {
        const message = result.data?.message || '一括割当に失敗しました';
        alert(message);
        await update();
      }
    };
  }
  
  
  // 割当削除
  // 一括削除処理
  async function bulkDeleteAllocations() {
    const selectedIds = Array.from(selectedAllocationIds);
    if (selectedIds.length === 0) {
      alert('削除する割当を選択してください');
      return;
    }
    
    if (!confirm(`${selectedIds.length}件の割当を削除しますか？
この操作は取り消せません。`)) {
      return;
    }
    
    isDeleting = true;
    const formData = new FormData();
    formData.append('allocationIds', JSON.stringify(selectedIds));
    
    try {
      const response = await fetch('?/bulkDeleteAllocations', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (response.ok) {
        await invalidateAll();
        selectedAllocationIds.clear();
        selectedAllocationIds = selectedAllocationIds; // リアクティブ更新
      } else {
        const result = await response.json();
        alert(`削除に失敗しました: ${result.message || 'エラーが発生しました'}`);
      }
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除中にエラーが発生しました');
    } finally {
      isDeleting = false;
    }
  }

  async function deleteAllocation(allocationId: string) {
    if (!confirm('この割当を削除しますか？')) return;
    
    const formData = new FormData();
    formData.append('allocationId', allocationId);
    
    const response = await fetch('?/deleteAllocation', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': 'https://nagaiku.top',
        'Referer': 'https://nagaiku.top/budget2/transaction-allocations'
      }
    });
    
    if (response.ok) {
      await invalidateAll();
      
      // 予算項目の残額を強制的に再計算
      budgetItemsWithGrant = data.budgetItems.map(item => {
        const grant = data.grants.find(g => g.id === item.grantId);
        const allocatedAmount = data.allocations
          .filter(alloc => alloc.budgetItemId === item.id)
          .reduce((sum, alloc) => sum + alloc.amount, 0);
        const remaining = (item.budgetedAmount || 0) - allocatedAmount;
        
        return {
          ...item,
          name: cleanBudgetItemName(item.name),
          grant,
          grantName: grant?.name || '',
          grantStatus: grant?.status || DEFAULT_BUDGET_STATUS,
          grantStartDate: formatDate(grant?.startDate),
          grantEndDate: formatDate(grant?.endDate),
          remaining,
          allocatedAmount,
          schedules: item.schedules || []
        };
      }) as unknown as BudgetItemWithGrant[];
      
      // 選択した取引の情報を更新
      if (selectedTransaction) {
        const updatedTransaction = transactionData.find(t => t.id === selectedTransaction!.id);
        if (updatedTransaction) {
          selectedTransaction = updatedTransaction as any;
        }
      }
      // 選択中の予算項目を再選択して残額を更新
      if (selectedBudgetItem) {
        selectedBudgetItem = budgetItemsWithGrant.find(item => item.id === selectedBudgetItem!.id) || null;
      }
    }
  }
  
  // フォーム送信後の処理
  function handleFormResult() {
    return async ({ result, update }: { result: { type: string }, update: () => Promise<void> }) => {
      if (result.type === 'success') {
        closeAllocationForm();
        await update();
        
        // 予算項目の残額を強制的に再計算
        budgetItemsWithGrant = data.budgetItems.map(item => {
          const grant = data.grants.find(g => g.id === item.grantId);
          const allocatedAmount = data.allocations
            .filter(alloc => alloc.budgetItemId === item.id)
            .reduce((sum, alloc) => sum + alloc.amount, 0);
          const remaining = (item.budgetedAmount || 0) - allocatedAmount;
          
          return {
            ...item,
            name: cleanBudgetItemName(item.name),
            grant,
            grantName: grant?.name || '',
            grantStatus: grant?.status || DEFAULT_BUDGET_STATUS,
            grantStartDate: formatDate(grant?.startDate),
            grantEndDate: formatDate(grant?.endDate),
            remaining,
            allocatedAmount,
            schedules: item.schedules || []
          };
        }) as unknown as BudgetItemWithGrant[];
        
        // 選択した取引の情報を更新
        if (selectedTransaction) {
          const updatedTransaction = transactionData.find(t => t.id === selectedTransaction!.id);
          if (updatedTransaction) {
            selectedTransaction = updatedTransaction as any;
          }
        }
        // 選択中の予算項目を再選択して残額を更新
        if (selectedBudgetItem) {
          selectedBudgetItem = budgetItemsWithGrant.find(item => item.id === selectedBudgetItem!.id) || null;
        }
      }
    };
  }
  
  // ヘッダーフィルター管理機能
  function clearAllHeaderFilters() {
    // プリセット選択をリセット
    if (presetComponent) {
      presetComponent.resetSelection();
    }
    // 金額範囲をデータから再計算
    let minAmount = '';
    let maxAmount = '';
    let startDate = '';
    let endDate = '';
    
    if (transactionData.length > 0) {
      // 金額の範囲
      const amounts = transactionData.map(t => t.amount).filter(a => a != null && !isNaN(a));
      if (amounts.length > 0) {
        minAmount = Math.min(...amounts).toString();
        maxAmount = Math.max(...amounts).toString();
      }
      
      // 日付の範囲
      const dates = transactionData.map(t => t.dateObj).filter(d => d instanceof Date && !isNaN(d.getTime()));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        startDate = minDate.toISOString().split('T')[0];
        endDate = maxDate.toISOString().split('T')[0];
      }
    }
    
    headerFilters = {
      primaryGrantName: '',
      primaryBudgetItemName: '',
      account: '',
      department: '',
      supplier: '',
      item: '',
      description: '',
      detailDescription: '',
      memo: '',
      tags: '',
      minAmount: minAmount,  // データの最小値
      maxAmount: maxAmount,  // データの最大値
      startDate: startDate,  // データの開始日
      endDate: endDate       // データの終了日
    };
    
    // チェックボックスフィルターもリセット
    checkboxFilters.allocationStatus = new Set(['unallocated', 'partial', 'full']);
    checkboxFilters.account = new Set(uniqueValues.account);
    checkboxFilters.department = new Set(uniqueValues.department);
    checkboxFilters.supplier = new Set(uniqueValues.supplier);
    checkboxFilters.item = new Set(uniqueValues.item);
    checkboxFilters.primaryGrantName = new Set(uniqueValues.primaryGrantName);
    checkboxFilters.primaryBudgetItemName = new Set(uniqueValues.primaryBudgetItemName);
    
    // 範囲選択の状態もリセット
    lastClickedGrantIndex = -1;
    lastClickedBudgetItemIndex = -1;
  }
  
  function toggleAllCheckboxes(field: string, selectAll: boolean) {
    if (selectAll) {
      // allocationStatusは特別扱い
      if (field === 'allocationStatus') {
        (checkboxFilters as any)[field] = new Set(['unallocated', 'partial', 'full']);
      } else {
        (checkboxFilters as any)[field] = new Set((uniqueValues as any)[field] || []);
      }
    } else {
      (checkboxFilters as any)[field] = new Set();
    }
    
    // 助成金・予算項目フィルターの場合、最後のクリック位置をリセット
    if (field === 'primaryGrantName') {
      lastClickedGrantIndex = -1;
    } else if (field === 'primaryBudgetItemName') {
      lastClickedBudgetItemIndex = -1;
    }
    
    checkboxFilters = checkboxFilters; // リアクティブ更新
  }
  
  function toggleCheckboxValue(field: string, value: string) {
    if ((checkboxFilters as any)[field].has(value)) {
      (checkboxFilters as any)[field].delete(value);
    } else {
      (checkboxFilters as any)[field].add(value);
    }
    checkboxFilters = checkboxFilters; // リアクティブ更新
  }

  /**
   * Shift+クリックによる範囲選択処理
   */
  function handleRangeSelection(field: 'primaryGrantName' | 'primaryBudgetItemName', currentIndex: number, shiftKey: boolean) {
    if (!shiftKey) {
      // 通常のクリック：最後のクリック位置を更新
      if (field === 'primaryGrantName') {
        lastClickedGrantIndex = currentIndex;
      } else {
        lastClickedBudgetItemIndex = currentIndex;
      }
      return false; // 通常の処理を継続
    }

    // Shift+クリック：範囲選択処理
    const lastIndex = field === 'primaryGrantName' ? lastClickedGrantIndex : lastClickedBudgetItemIndex;
    
    if (lastIndex === -1) {
      // 最後のクリック位置が記録されていない場合は通常処理
      if (field === 'primaryGrantName') {
        lastClickedGrantIndex = currentIndex;
      } else {
        lastClickedBudgetItemIndex = currentIndex;
      }
      return false;
    }

    // 範囲を計算
    const startIndex = Math.min(lastIndex, currentIndex);
    const endIndex = Math.max(lastIndex, currentIndex);
    const values = (uniqueValues as any)[field];
    const checkboxFilter = (checkboxFilters as any)[field];
    
    // 最初にクリックした項目の状態を取得
    const firstValue = values[lastIndex];
    const shouldCheck = !checkboxFilter.has(firstValue);
    
    // 範囲内のすべての項目を同じ状態に設定
    for (let i = startIndex; i <= endIndex; i++) {
      const value = values[i];
      if (shouldCheck) {
        checkboxFilter.add(value);
      } else {
        checkboxFilter.delete(value);
      }
    }
    
    checkboxFilters = checkboxFilters; // リアクティブ更新
    return true; // 範囲選択処理を実行したことを示す
  }
  
  /**
   * Save filter state to localStorage with error handling
   */
  function saveFilterState(): void {
    if (!browser || isRestoringState) return; // Don't save during restoration
    
    const filterState = {
      headerFilters,
      checkboxFilters: {
        allocationStatus: Array.from(checkboxFilters.allocationStatus),
        account: Array.from(checkboxFilters.account),
        department: Array.from(checkboxFilters.department),
        supplier: Array.from(checkboxFilters.supplier),
        item: Array.from(checkboxFilters.item),
        primaryGrantName: Array.from(checkboxFilters.primaryGrantName),
        primaryBudgetItemName: Array.from(checkboxFilters.primaryBudgetItemName)
      },
      transactionSortFields,
      sortFields,
      currentPage,
      itemsPerPage,
      savedAt: new Date().toISOString()
    };
    
    const result = safeSetItem(FILTER_STATE_STORAGE_KEY, filterState);
    
    if (!result.success && result.error) {
      // Storage failed, but don't interrupt user flow
      // Could show a non-blocking notification here if needed
    }
  }
  
  /**
   * Load filter state from localStorage with error handling
   */
  function loadFilterState(): void {
    if (!browser) return;
    
    const result = safeGetItem<any>(FILTER_STATE_STORAGE_KEY);
    
    if (!result.success || !result.data) {
      // No saved state or error loading, use defaults
      return;
    }
    
    try {
      isRestoringState = true; // Start restoration
      const filterState = result.data;
      
      // Check if saved state is not too old (optional: skip if older than 7 days)
      if (filterState.savedAt) {
        const savedDate = new Date(filterState.savedAt);
        const daysSinceSaved = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceSaved > 7) {
          // State is too old, use defaults
          isRestoringState = false;
          return;
        }
      }
      
      // Restore saved state (including amount ranges)
      if (filterState.headerFilters) {
        headerFilters = { ...headerFilters, ...filterState.headerFilters };
      }
      
      if (filterState.checkboxFilters) {
        // Safely restore checkbox filters with validation
        const cb = filterState.checkboxFilters;
        checkboxFilters.allocationStatus = new Set(cb.allocationStatus || ['unallocated', 'partial', 'full']);
        checkboxFilters.account = new Set(cb.account || []);
        checkboxFilters.department = new Set(cb.department || []);
        checkboxFilters.supplier = new Set(cb.supplier || []);
        checkboxFilters.item = new Set(cb.item || []);
        checkboxFilters.primaryGrantName = new Set(cb.primaryGrantName || []);
        checkboxFilters.primaryBudgetItemName = new Set(cb.primaryBudgetItemName || []);
      }
      
      // Restore sort state
      if (filterState.transactionSortFields && Array.isArray(filterState.transactionSortFields)) {
        transactionSortFields = filterState.transactionSortFields;
      }
      if (filterState.sortFields && Array.isArray(filterState.sortFields)) {
        sortFields = filterState.sortFields;
      }
      
      // Restore pagination state with validation
      if (typeof filterState.currentPage === 'number' && filterState.currentPage > 0) {
        currentPage = filterState.currentPage;
        pageInputValue = filterState.currentPage.toString();
      }
      if (typeof filterState.itemsPerPage === 'number' && filterState.itemsPerPage > 0) {
        itemsPerPage = filterState.itemsPerPage;
      }
      
      // Complete restoration after next tick
      setTimeout(() => {
        isRestoringState = false;
        isStateRestored = true;
      }, 100);
    } catch {
      // Failed to apply filter state, reset flags and continue with defaults
      isRestoringState = false;
      isStateRestored = false;
    }
  }
  
  
  
  // 現在の状態をプリセット用の形式で取得
  function getCurrentStateForPreset() {
    return {
      headerFilters: { ...headerFilters },
      checkboxFilters: {
        allocationStatus: Array.from(checkboxFilters.allocationStatus),
        account: Array.from(checkboxFilters.account),
        department: Array.from(checkboxFilters.department),
        supplier: Array.from(checkboxFilters.supplier),
        item: Array.from(checkboxFilters.item),
        primaryGrantName: Array.from(checkboxFilters.primaryGrantName),
        primaryBudgetItemName: Array.from(checkboxFilters.primaryBudgetItemName)
      },
      budgetItemStatusFilter,
      budgetItemGrantFilter,
      budgetItemCategoryFilter
    };
  }
  
  function getCurrentSortsForPreset() {
    return {
      budgetItemSortFields: [...sortFields],
      transactionSortFields: [...transactionSortFields]
    };
  }
  
  // データから金額の範囲を計算（プレースホルダー用）
  $: amountRange = (() => {
    if (transactionData.length > 0) {
      const amounts = transactionData.map(t => t.amount).filter(a => a != null && !isNaN(a));
      if (amounts.length > 0) {
        return {
          min: Math.min(...amounts),
          max: Math.max(...amounts)
        };
      }
    }
    return { min: 0, max: 0 };
  })();
  
  // データから日付の範囲を計算（プレースホルダー用）
  $: dateRange = (() => {
    if (transactionData.length > 0) {
      const dates = transactionData.map(t => t.dateObj).filter(d => d instanceof Date && !isNaN(d.getTime()));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        return {
          start: minDate.toISOString().split('T')[0],
          end: maxDate.toISOString().split('T')[0]
        };
      }
    }
    return { start: '', end: '' };
  })();
  
  // フィルター状態が変更されたときに保存（復元中は除く）
  $: if (browser && !isRestoringState && (headerFilters || checkboxFilters)) {
    saveFilterState();
  }

  // フィルター結果をすべて選択
  function selectAllFiltered() {
    sortedTransactionData.forEach(row => {
      checkedTransactions.add(row.id);
    });
    checkedTransactions = checkedTransactions;
  }
  
  // すべての選択を解除
  function clearAllSelection() {
    checkedTransactions.clear();
    checkedTransactions = checkedTransactions;
  }
  
  // キーボードショートカット関数
  function moveSelection(direction: number) {
    const maxIndex = paginatedTransactionData.length - 1;
    
    if (maxIndex < 0) return;
    
    if (selectedRowIndex === -1) {
      selectedRowIndex = direction > 0 ? 0 : maxIndex;
    } else {
      selectedRowIndex = Math.max(0, Math.min(maxIndex, selectedRowIndex + direction));
    }
    
    // 選択行を更新
    if (paginatedTransactionData[selectedRowIndex]) {
      selectedTransaction = paginatedTransactionData[selectedRowIndex] as any;
      showRightPane = true;
      scrollToSelectedRow();
      // freeeファイルボックスから画像を取得
      if (selectedTransaction?.freeDealId) {
        loadFreeeReceipts(selectedTransaction.freeDealId.toString());
      }
    }
  }
  
  function selectFirstRow() {
    if (paginatedTransactionData.length > 0) {
      selectedRowIndex = 0;
      selectedTransaction = paginatedTransactionData[0] as any;
      showRightPane = true;
      scrollToSelectedRow();
      // freeeファイルボックスから画像を取得
      if (selectedTransaction?.freeDealId) {
        loadFreeeReceipts(selectedTransaction.freeDealId.toString());
      }
    }
  }
  
  function selectLastRow() {
    if (paginatedTransactionData.length > 0) {
      selectedRowIndex = paginatedTransactionData.length - 1;
      selectedTransaction = paginatedTransactionData[selectedRowIndex] as any;
      showRightPane = true;
      scrollToSelectedRow();
      // freeeファイルボックスから画像を取得
      if (selectedTransaction?.freeDealId) {
        loadFreeeReceipts(selectedTransaction.freeDealId.toString());
      }
    }
  }
  
  function toggleCurrentRowCheckbox() {
    if (selectedRowIndex >= 0 && paginatedTransactionData[selectedRowIndex]) {
      const row = paginatedTransactionData[selectedRowIndex];
      if (checkedTransactions.has(row.id)) {
        checkedTransactions.delete(row.id);
      } else {
        checkedTransactions.add(row.id);
      }
      checkedTransactions = checkedTransactions;
    }
  }
  
  function selectAllCurrentPage() {
    paginatedTransactionData.forEach(row => {
      checkedTransactions.add(row.id);
    });
    checkedTransactions = checkedTransactions;
  }
  
  function deselectAll() {
    checkedTransactions.clear();
    checkedTransactions = checkedTransactions;
  }
  
  function toggleRightPane() {
    if (selectedRowIndex >= 0 && paginatedTransactionData[selectedRowIndex]) {
      if (!selectedTransaction || selectedTransaction.id !== paginatedTransactionData[selectedRowIndex].id) {
        selectedTransaction = paginatedTransactionData[selectedRowIndex] as any;
      }
      showRightPane = !showRightPane;
      
      // 右ペインが開いたら、freeeファイルボックスから画像を取得
      if (showRightPane && selectedTransaction?.freeDealId) {
        loadFreeeReceipts(selectedTransaction.freeDealId.toString());
      }
    }
  }
  
  // 現在読み込み中のdealIdを記録（重複読み込み防止）
  let loadingDealId: string | null = null;
  // 現在表示中のdealIdを記録
  let displayedDealId: string | null = null;
  
  // 領収書画像拡大表示用
  let enlargedImageUrl: string | null = null;
  let enlargedImageAlt: string = '';
  
  // 画像拡大表示関数
  function enlargeImage(url: string, alt: string) {
    enlargedImageUrl = url;
    enlargedImageAlt = alt;
  }
  
  // 画像拡大を閉じる
  function closeEnlargedImage() {
    enlargedImageUrl = null;
    enlargedImageAlt = '';
  }
  
  // ESCキーで閉じる
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && enlargedImageUrl) {
      closeEnlargedImage();
    }
  }
  
  // WAM科目マッピング関数
  function mapToWamCategory(account: string): string {
    // 【事】【管】などの接頭辞を除去
    const cleanAccount = account.replace(/^【[事管]】/, '');
    
    // マッピングルール（wam-mapping-reference.mdに基づく）
    const mappings: Record<string, string> = {
      // 人件費関連
      '給与手当': '賃金（職員）',
      '給料手当': '賃金（職員）',
      '給料': '賃金（職員）',
      '賃金': '賃金（職員）',
      '臨時雇用費': '賃金（アルバイト）',
      'アルバイト': '賃金（アルバイト）',
      '雑給': '賃金（アルバイト）',
      '謝金': '謝金（外部）',
      '講師謝金': '謝金（外部）',
      '報酬': '謝金（外部）',
      
      // 事業費関連
      '旅費交通費': '旅費',
      '旅費': '旅費',
      '交通費': '旅費',
      '印刷製本費': '印刷製本費',
      '印刷費': '印刷製本費',
      'コピー': '印刷製本費',
      '通信運搬費': '通信運搬費',
      '通信費': '通信運搬費',
      '運搬費': '通信運搬費',
      '郵送': '通信運搬費',
      '支払手数料': '雑役務費',
      '手数料': '雑役務費',
      
      // 管理費関連
      '地代家賃': '家賃',
      '家賃': '家賃',
      '賃借料': '借料損料',
      'リース': '借料損料',
      'レンタル': '借料損料',
      '水道光熱費': '光熱水費',
      '光熱費': '光熱水費',
      '電気': '光熱水費',
      '水道': '光熱水費',
      'ガス': '光熱水費',
      '消耗品費': '消耗品費',
      '消耗品': '消耗品費',
      '事務用品': '消耗品費',
      '保険料': '保険料',
      '保険': '保険料',
      '修繕費': '修繕費',
      '修理': '修繕費',
      '保守': '修繕費',
      
      // その他（消耗品費として処理）
      '会議費': '消耗品費',
      '食材費': '消耗品費',
      '教養娯楽費': '消耗品費',
      '交際費': '消耗品費',
      
      // 委託費
      '委託費': '委託費',
      '外注費': '委託費',
      '業務委託': '委託費',
      
      // 備品
      '備品': '備品購入費',
      '什器備品': '備品購入費',
      '設備': '備品購入費'
    };
    
    // マッピングを探す（部分一致）
    for (const [key, value] of Object.entries(mappings)) {
      if (cleanAccount.includes(key)) {
        return value;
      }
    }
    
    // マッチしない場合は空欄
    return '';
  }
  
  // WAM CSV出力関数
  async function exportWamCsv() {
    // フィルター条件のチェック
    if (!wamFilterGrantId || !wamFilterYearMonth) {
      alert('助成金と年月を選択してください。');
      return;
    }

    try {
      // サーバーサイドのexportWamCsvアクションを呼び出し
      const formData = new FormData();
      formData.append('grantId', wamFilterGrantId);
      formData.append('yearMonth', wamFilterYearMonth);

      const response = await fetch('?/exportWamCsv', {
        method: 'POST',
        body: formData
      });

      const responseText = await response.text();
      console.log('Response text length:', responseText.length);
      
      // SvelteKitのアクションレスポンスを解析
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON parse error:', e);
        console.error('Response text:', responseText.substring(0, 500));
        alert('サーバーレスポンスの解析に失敗しました。');
        return;
      }

      // SvelteKitのアクションはtype: 'success'とdataを返す
      if (result && result.type === 'success' && result.data) {
        // dataはJSON文字列なので再度パース
        let exportData;
        try {
          exportData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
        } catch (e) {
          console.error('Data parse error:', e);
          alert('データの解析に失敗しました。');
          return;
        }
        
        const { transactions, grant, yearMonth, budgetItems } = exportData;
        
        if (!transactions || !Array.isArray(transactions)) {
          console.error('Invalid transactions data:', transactions);
          alert('取引データが正しく取得できませんでした。');
          return;
        }
        
        // CSV用データ準備
        const csvRows: string[][] = [];
        
        // ヘッダー行
        csvRows.push(['支払日', 'WAM科目', '取引先', '摘要', '金額', '管理番号', '勘定科目', '品目']);
        
        // データ行を生成
        transactions.forEach(transaction => {
          // 該当する助成金の予算項目への割当のみ処理
          const relevantAllocations = transaction.allocations.filter(alloc => 
            budgetItems.some(item => item.id === alloc.budgetItemId)
          );

          if (relevantAllocations.length > 0) {
            const date = new Date(transaction.date);
            const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
            
            const wamCategory = mapToWamCategory(transaction.account || '');
            const supplier = transaction.supplier || '';
            
            // 摘要の生成（取引内容/明細備考）
            let summary = '';
            if (transaction.description && transaction.detailDescription) {
              summary = `${transaction.description}/${transaction.detailDescription}`;
            } else if (transaction.description) {
              summary = transaction.description;
            } else if (transaction.detailDescription) {
              summary = transaction.detailDescription;
            } else {
              summary = '';
            }
            
            // 該当助成金への割当額合計
            const allocationAmount = relevantAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
            const managementNumber = transaction.managementNumber || '';
            const originalAccount = transaction.account || '';
            const item = transaction.item || '';
            
            csvRows.push([
              formattedDate,
              wamCategory,
              supplier,
              summary,
              allocationAmount.toString(),
              managementNumber,
              originalAccount,
              item
            ]);
          }
        });
        
        if (csvRows.length === 1) { // ヘッダーのみの場合
          alert('指定された条件に該当する取引が見つかりませんでした。');
          return;
        }
        
        // CSV文字列生成（BOM付きUTF-8）
        const csvContent = csvRows.map(row => 
          row.map(cell => {
            // セル内にカンマ、改行、ダブルクォートが含まれる場合はダブルクォートで囲む
            if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          }).join(',')
        ).join('\n');
        
        // BOM付きUTF-8でダウンロード
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // ファイル名に助成金名と年月を含める
        const [year, month] = yearMonth.split('-');
        const filename = `WAM_${grant?.name || '助成金'}_${year}-${month}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 件数を通知
        const dataRowCount = csvRows.length - 1; // ヘッダー行を除く
        alert(`WAM CSV出力完了\n助成金: ${grant?.name || ''}\n対象期間: ${year}/${month}\n出力件数: ${dataRowCount}件`);
      } else {
        console.error('Export failed:', result);
        alert(`CSV出力に失敗しました: ${result?.message || result?.error?.message || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('WAM CSV出力エラー:', error);
      alert('CSV出力中にエラーが発生しました。');
    }
  }
  
  // freeeファイルボックスから画像を取得
  async function loadFreeeReceipts(dealId: string) {
    // 既に同じdealIdが表示されているなら何もしない
    if (displayedDealId === dealId) return;
    // 現在読み込み中の場合は、同じIDでなければキャンセル
    if (loadingDealId !== null && loadingDealId !== dealId) {
      // 別の取引の読み込み中なので、新しい読み込みを開始
    }
    
    // コンテナが存在するまで待つ（最大1秒）
    let container = document.getElementById('receipts-container');
    let retries = 0;
    while (!container && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      container = document.getElementById('receipts-container');
      retries++;
    }
    if (!container) return;
    
    loadingDealId = dealId;
    
    try {
      container.innerHTML = '<div class="text-sm text-gray-500">読み込み中...</div>';
      
      // freee Deal APIから取引詳細とreceipts配列を取得
      const response = await fetch(`/budget2/api/freee/receipts?dealId=${dealId}`);
      const data = await response.json();
      
      if (data.success && data.receipts && data.receipts.length > 0) {
        container.innerHTML = '';
        
        // 各レシートを表示
        data.receipts.forEach((receipt: any) => {
          const receiptDiv = document.createElement('div');
          receiptDiv.className = 'bg-gray-50 rounded-lg p-3 mb-3';
          
          // ファイル情報
          const info = document.createElement('div');
          info.className = 'mb-2';
          info.innerHTML = `
            <p class="text-sm font-medium">
              ${receipt.receipt_metadatum?.partner_name || receipt.description || 'ファイル'}
            </p>
            <p class="text-xs text-gray-500">
              ${receipt.issue_date || ''} ${receipt.receipt_metadatum?.amount ? '¥' + receipt.receipt_metadatum.amount.toLocaleString() : ''}
            </p>
          `;
          receiptDiv.appendChild(info);
          
          // freeeリンクボタン
          const freeeButton = document.createElement('a');
          freeeButton.href = `https://secure.freee.co.jp/receipts/${receipt.id}`;
          freeeButton.target = '_blank';
          freeeButton.className = 'inline-block px-3 py-1 mb-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600';
          freeeButton.textContent = 'freeeで表示';
          receiptDiv.appendChild(freeeButton);
          
          // 画像の直接表示（プロキシ経由）
          if (receipt.mime_type && receipt.mime_type.startsWith('image/') && receipt.file_src) {
            const img = document.createElement('img');
            // プロキシエンドポイントを使用
            img.src = `/budget2/api/freee/receipt-image/${receipt.id}`;
            img.alt = receipt.description || 'レシート画像';
            img.className = 'w-full h-auto rounded cursor-pointer hover:opacity-80';
            // クリック時は画像を拡大表示
            img.onclick = () => enlargeImage(`/budget2/api/freee/receipt-image/${receipt.id}`, receipt.description || 'レシート画像');
            img.onerror = () => {
              img.style.display = 'none';
              // エラー時は既存のfreeeボタンのみ表示（重複を避ける）
            };
            receiptDiv.appendChild(img);
          } else if (receipt.file_src) {
            // 画像以外のファイル（PDFなど）もプロキシ経由でダウンロード
            const link = document.createElement('a');
            link.href = `/budget2/api/freee/receipt-image/${receipt.id}`;
            link.target = '_blank';
            link.className = 'inline-block px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600';
            link.textContent = 'ファイルを開く';
            receiptDiv.appendChild(link);
          } else {
            // file_srcがない場合はfreeeで開くボタン
            const link = document.createElement('a');
            link.href = `https://secure.freee.co.jp/receipts/${receipt.id}`;
            link.target = '_blank';
            link.className = 'inline-block px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600';
            link.textContent = 'freeeで表示';
            receiptDiv.appendChild(link);
          }
          
          container.appendChild(receiptDiv);
        }) as unknown as BudgetItemWithGrant[];
      } else {
        // レシートがない場合の表示を改善
        const message = data.message || 'この取引には領収書が登録されていません';
        container.innerHTML = `
          <div class="text-center py-8 px-4">
            <div class="text-gray-400 mb-2">
              <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <p class="text-sm text-gray-500 mb-1">${message}</p>
            <p class="text-xs text-gray-400">領収書を登録する場合はfreeeで操作してください</p>
          </div>
        `;
      }
      // 表示完了したdealIdを記録
      displayedDealId = dealId;
    } catch (error: any) {
      // Handle receipt fetch error gracefully
      if (container) {
        const errorMessage = error?.message || '領収書の取得に失敗しました';
        container.innerHTML = `<p class="text-sm text-red-500">${errorMessage}</p>`;
      }
    } finally {
      // 読み込み完了
      if (loadingDealId === dealId) {
        loadingDealId = null;
      }
    }
  }
  
  function closeModalsAndPanes() {
    if (rightPaneMode !== 'view') {
      closeAllocationForm();
    } else if (showRightPane) {
      showRightPane = false;
      // 右ペインを閉じた時に表示済みIDをリセット
      displayedDealId = null;
    }
  }
  
  function scrollToSelectedRow() {
    // 少し遅延させて DOM が更新されてからスクロール
    setTimeout(() => {
      const tableContainer = document.querySelector('.flex-1.overflow-auto.bg-white');
      if (tableContainer && selectedRowIndex >= 0) {
        const rows = tableContainer.querySelectorAll('tbody tr');
        const selectedRow = rows[selectedRowIndex];
        if (selectedRow) {
          selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, 50);
  }
  
  // チェックボックスフィルターのドロップダウンを閉じる
  function closeAllCheckboxDropdowns() {
    showCheckboxFilter = {
      allocationStatus: false,
      account: false,
      department: false,
      supplier: false,
      item: false,
      primaryGrantName: false,
      primaryBudgetItemName: false
    };
  }
  
  // ドキュメントクリックでドロップダウンを閉じる
  function handleDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // ドロップダウン内のクリックでない場合は閉じる
    if (!target.closest('.relative')) {
      closeAllCheckboxDropdowns();
    }
  }

  // キーボードイベントハンドラー
  function handleKeyDown(e: KeyboardEvent) {
    // 入力フィールドにフォーカスがある場合は無効
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }
  
    // フォーム表示中の処理
    if (rightPaneMode !== 'view') {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAllocationForm();
      }
      return;
    }
  
    // ショートカット処理
    switch(e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(-1);
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(1);
        break;
        
      case 'Home':
        e.preventDefault();
        selectFirstRow();
        break;
        
      case 'End':
        e.preventDefault();
        selectLastRow();
        break;
        
      case ' ': // Space
        e.preventDefault();
        toggleCurrentRowCheckbox();
        break;
        
      case 'Enter':
        e.preventDefault();
        toggleRightPane();
        break;
        
      case 'Escape':
        e.preventDefault();
        closeModalsAndPanes();
        break;
        
      case 'PageUp':
        e.preventDefault();
        goToPreviousPage();
        break;
        
      case 'PageDown':
        e.preventDefault();
        goToNextPage();
        break;
        
      case 'a':
      case 'A':
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.shiftKey) {
            deselectAll();
          } else {
            selectAllCurrentPage();
          }
        }
        break;
        
      case 'Home':
        if (e.ctrlKey) {
          e.preventDefault();
          goToFirstPage();
        }
        break;
        
      case 'End':
        if (e.ctrlKey) {
          e.preventDefault();
          goToLastPage();
        }
        break;
    }
  }
  
  // コンポーネントのライフサイクル
  onMount(() => {
    if (browser) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keydown', handleKeydown);
      document.addEventListener('click', handleDocumentClick);
      
      // 復元は初期化完了後に実行
    }
    isMounted = true;
  });
  
  onDestroy(() => {
    if (browser) {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleDocumentClick);
    }
  });
  
  // ページ変更時に選択をリセット
  $: if (currentPage) {
    selectedRowIndex = -1;
  }
  
  // ページネーション後のデータが変更されたときに選択インデックスを調整
  $: if (paginatedTransactionData.length > 0 && selectedTransaction) {
    const index = paginatedTransactionData.findIndex(row => row.id === selectedTransaction!.id);
    if (index >= 0) {
      selectedRowIndex = index;
    } else {
      selectedRowIndex = -1;
    }
  }
</script>

<div class="flex h-[calc(100vh-90px)] bg-gray-50 overflow-hidden">
  <!-- ペイン1: 予算項目一覧（フラットテーブル） -->
  <div 
    class="border-r bg-white transition-all duration-300 overflow-hidden flex flex-col flex-shrink-0"
    style="width: {showLeftPane ? LEFT_PANE_WIDTH + 'px' : '0'}; min-width: {showLeftPane ? LEFT_PANE_WIDTH + 'px' : '0'}"
  >
    {#if showLeftPane}
      <div class="flex-1 flex flex-col min-h-0">
        <!-- フィルタツールバー -->
        <div class="border-b px-3 py-2 bg-gray-50">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2 text-sm">
              <label class="text-gray-600 shrink-0">ステータス:</label>
              <select class="select select-xs select-bordered" bind:value={budgetItemStatusFilter}>
                <option value="all">すべて</option>
                <option value="active">進行中</option>
                <option value="completed">終了</option>
                <option value="applied">報告済み</option>
              </select>
              
            </div>
            
            <div class="flex items-center gap-2 text-sm">
              <label class="text-gray-600 shrink-0">月別:</label>
              <input 
                type="month" 
                class="input input-xs input-bordered"
                bind:value={selectedMonth}
              />
              <button 
                class="btn btn-xs {showMonthlyBalance ? 'btn-primary' : 'btn-outline'}"
                on:click={() => showMonthlyBalance = !showMonthlyBalance}
              >
                残額表示
              </button>
              {#if showMonthlyBalance}
                <button 
                  class="btn btn-xs {filterByMonthlyBudget ? 'btn-warning' : 'btn-outline'}"
                  on:click={() => filterByMonthlyBudget = !filterByMonthlyBudget}
                  title="選択月の予算が設定されている項目のみ表示"
                >
                  月予算あり
                </button>
              {/if}
            </div>
            
            <div class="flex items-center gap-2 text-sm">
              
              <div class="text-gray-600 text-xs">
                表示: {sortedBudgetItems.length}件
              </div>
            </div>
          </div>
        </div>
        
        <!-- テーブル表示エリア -->
        <div class="flex-1 overflow-auto min-h-0">
          <table class="table table-xs table-pin-rows w-full">
            <thead class="bg-gray-100">
              <tr>
                <th class="w-6 text-xs sticky left-0 z-10 bg-gray-100"></th>
                <th 
                  class="cursor-pointer select-none min-w-[80px] text-xs sticky left-6 z-10 bg-gray-100"
                  on:click={(e) => handleSort('grantName', e)}
                >
                  <div class="flex items-center gap-1">
                    助成金
                    {#if sortFields.findIndex(s => s.field === 'grantName') >= 0}
                      <span class="text-xs flex items-center gap-0.5">
                        {sortFields[sortFields.findIndex(s => s.field === 'grantName')].direction === 'asc' ? '↑' : '↓'}
                        {#if sortFields.length > 1}
                          <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                            {sortFields.findIndex(s => s.field === 'grantName') + 1}
                          </span>
                        {/if}
                      </span>
                    {/if}
                  </div>
                </th>
                <th 
                  class="cursor-pointer select-none min-w-[100px] text-xs sticky z-10 bg-gray-100 border-r-2 border-gray-300"
                  on:click={(e) => handleSort('name', e)}
                  style="left: 86px"
                >
                  <div class="flex items-center gap-1">
                    予算項目名
                    {#if sortFields.findIndex(s => s.field === 'name') >= 0}
                      <span class="text-xs flex items-center gap-0.5">
                        {sortFields[sortFields.findIndex(s => s.field === 'name')].direction === 'asc' ? '↑' : '↓'}
                        {#if sortFields.length > 1}
                          <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                            {sortFields.findIndex(s => s.field === 'name') + 1}
                          </span>
                        {/if}
                      </span>
                    {/if}
                  </div>
                </th>
                <th 
                  class="cursor-pointer select-none text-right min-w-[80px] text-xs"
                  on:click={(e) => handleSort('remaining', e)}
                >
                  <div class="flex items-center gap-1 justify-end">
                    残額
                    {#if sortFields.findIndex(s => s.field === 'remaining') >= 0}
                      <span class="text-xs flex items-center gap-0.5">
                        {sortFields[sortFields.findIndex(s => s.field === 'remaining')].direction === 'asc' ? '↑' : '↓'}
                        {#if sortFields.length > 1}
                          <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                            {sortFields.findIndex(s => s.field === 'remaining') + 1}
                          </span>
                        {/if}
                      </span>
                    {/if}
                  </div>
                </th>
                <th 
                  class="cursor-pointer select-none min-w-[60px] text-xs"
                  on:click={(e) => handleSort('category', e)}
                >
                  <div class="flex items-center gap-1">
                    カテゴリ
                    {#if sortFields.findIndex(s => s.field === 'category') >= 0}
                      <span class="text-xs flex items-center gap-0.5">
                        {sortFields[sortFields.findIndex(s => s.field === 'category')].direction === 'asc' ? '↑' : '↓'}
                        {#if sortFields.length > 1}
                          <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                            {sortFields.findIndex(s => s.field === 'category') + 1}
                          </span>
                        {/if}
                      </span>
                    {/if}
                  </div>
                </th>
                {#if showMonthlyBalance}
                  <th class="text-xs min-w-[60px]">
                    <div class="flex items-center gap-1 justify-end">
                      月別残額
                    </div>
                  </th>
                {/if}
                <th 
                  class="cursor-pointer select-none min-w-[55px] text-xs"
                  on:click={(e) => handleSort('grantStartDate', e)}
                >
                  <div class="flex items-center gap-1">
                    開始
                    {#if sortFields.findIndex(s => s.field === 'grantStartDate') >= 0}
                      <span class="text-xs flex items-center gap-0.5">
                        {sortFields[sortFields.findIndex(s => s.field === 'grantStartDate')].direction === 'asc' ? '↑' : '↓'}
                        {#if sortFields.length > 1}
                          <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                            {sortFields.findIndex(s => s.field === 'grantStartDate') + 1}
                          </span>
                        {/if}
                      </span>
                    {/if}
                  </div>
                </th>
                <th 
                  class="cursor-pointer select-none min-w-[55px] text-xs"
                  on:click={(e) => handleSort('grantEndDate', e)}
                >
                  <div class="flex items-center gap-1">
                    終了
                    {#if sortFields.findIndex(s => s.field === 'grantEndDate') >= 0}
                      <span class="text-xs flex items-center gap-0.5">
                        {sortFields[sortFields.findIndex(s => s.field === 'grantEndDate')].direction === 'asc' ? '↑' : '↓'}
                        {#if sortFields.length > 1}
                          <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                            {sortFields.findIndex(s => s.field === 'grantEndDate') + 1}
                          </span>
                        {/if}
                      </span>
                    {/if}
                  </div>
                </th>
                <th class="text-right min-w-[70px] text-xs">予算額</th>
                <th 
                  class="cursor-pointer select-none text-center min-w-[60px] text-xs"
                  on:click={(e) => handleSort('grantStatus', e)}
                >
                  <div class="flex items-center gap-1 justify-center">
                    ステータス
                    {#if sortFields.findIndex(s => s.field === 'grantStatus') >= 0}
                      <span class="text-xs flex items-center gap-0.5">
                        {sortFields[sortFields.findIndex(s => s.field === 'grantStatus')].direction === 'asc' ? '↑' : '↓'}
                        {#if sortFields.length > 1}
                          <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                            {sortFields.findIndex(s => s.field === 'grantStatus') + 1}
                          </span>
                        {/if}
                      </span>
                    {/if}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {#each sortedBudgetItems as item, index}
                {@const isOdd = index % 2 === 1}
                <tr 
                  class="hover cursor-pointer transition-colors duration-150"
                  class:bg-gray-50={isOdd}
                  class:bg-blue-100={selectedBudgetItem?.id === item.id}
                  on:click={() => selectedBudgetItem = item}
                >
                  <td class="p-0.5 sticky left-0 z-10" class:bg-gray-50={isOdd} class:bg-blue-100={selectedBudgetItem?.id === item.id} class:bg-white={!isOdd && selectedBudgetItem?.id !== item.id}>
                    <input 
                      type="radio" 
                      name="selectedBudgetItem" 
                      class="radio radio-xs radio-primary"
                      checked={selectedBudgetItem?.id === item.id}
                      on:change={() => selectedBudgetItem = item}
                    />
                  </td>
                  <td class="text-xs p-0.5 min-w-[80px] sticky left-6 z-10" 
                      class:bg-gray-50={isOdd} 
                      class:bg-blue-100={selectedBudgetItem?.id === item.id}
                      class:bg-white={!isOdd && selectedBudgetItem?.id !== item.id}
                      title={item.grantName}>
                    {item.grantName}
                  </td>
                  <td class="text-xs p-0.5 min-w-[100px] sticky z-10 border-r-2 border-gray-300" 
                      class:bg-gray-50={isOdd} 
                      class:bg-blue-100={selectedBudgetItem?.id === item.id}
                      class:bg-white={!isOdd && selectedBudgetItem?.id !== item.id}
                      style="left: 86px"
                      title={item.name}>
                    {item.name}
                    {#if item.schedules && item.schedules.length > 0}
                      <span class="text-gray-500 ml-1 text-[10px]">({item.schedules[0].month}月)</span>
                    {/if}
                  </td>
                  <td class="text-xs p-0.5 text-right font-medium min-w-[80px]" class:text-red-600={item.remaining < 0} class:text-green-700={item.remaining >= 0}>
                    {formatCurrency(item.remaining)}
                  </td>
                  <td class="text-xs p-0.5 text-gray-600 min-w-[60px]" title={item.category || '未分類'}>
                    {item.category || '未分類'}
                  </td>
                  {#if showMonthlyBalance}
                    {@const monthBalance = calculateMonthlyBalance(item, selectedMonth)}
                    <td class="text-xs p-0.5 text-right font-medium min-w-[60px]" 
                        class:text-red-600={monthBalance.remaining < 0} 
                        class:text-blue-600={monthBalance.remaining >= 0}>
                      {formatCurrency(monthBalance.remaining)}
                    </td>
                  {/if}
                  <td class="text-xs p-0.5 min-w-[55px]" title={item.grantStartDate}>
                    {formatShortDate(item.grantStartDate)}
                  </td>
                  <td class="text-xs p-0.5 min-w-[55px]" title={item.grantEndDate}>
                    {formatShortDate(item.grantEndDate)}
                  </td>
                  <td class="text-xs p-0.5 text-right font-medium min-w-[70px]">
                    {formatCurrency(item.budgetedAmount || 0)}
                  </td>
                  <td class="text-xs p-0.5 text-center">
                    <span class="badge badge-xs text-[10px] {getStatusColor(item.grantStatus)}">
                      {getStatusLabel(item.grantStatus)}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
      
      
      <!-- 下部: 選択項目の詳細表示 -->
      <div class="border-t bg-gray-50 flex-shrink-0">
        {#if selectedBudgetItem}
          {@const grant = selectedBudgetItem.grant}
          {@const grantRemaining = budgetItemsWithGrant
            .filter(item => item.grantId === grant?.id)
            .reduce((sum, item) => sum + (item.remaining || 0), 0)}
          {@const scheduleMonths = selectedBudgetItem.schedules?.map(s => `${s.month}月`).join('、') || '未設定'}
          <div class="p-1.5 space-y-1 text-xs">
            <!-- 助成金情報 -->
            <div class="bg-blue-50 p-1 rounded">
              <div class="space-y-0.5">
                <div class="flex justify-between">
                  <span class="text-gray-600">助成金名:</span>
                  <span class="font-medium truncate max-w-[120px]" title={grant?.name}>{grant?.name || '不明'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">助成期間:</span>
                  <span class="text-xs">
                    {formatDate(grant?.startDate) || '不明'} 
                    〜 
                    {formatDate(grant?.endDate) || '不明'}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">助成金残額:</span>
                  <span class="font-semibold" class:text-red-600={grantRemaining < 0} class:text-green-700={grantRemaining >= 0}>
                    {formatCurrency(grantRemaining)}
                  </span>
                </div>
              </div>
            </div>

            <!-- 予算項目情報 -->
            <div class="bg-green-50 p-1 rounded">
              <div class="space-y-0.5">
                <div class="flex justify-between">
                  <span class="text-gray-600">予算項目名:</span>
                  <span class="font-medium truncate max-w-[120px]" title={selectedBudgetItem.name}>{selectedBudgetItem.name}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">予定月:</span>
                  <span>{scheduleMonths}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">予算項目残額:</span>
                  <span class="font-semibold" class:text-red-600={selectedBudgetItem.remaining < 0} class:text-green-700={selectedBudgetItem.remaining >= 0}>
                    {formatCurrency(selectedBudgetItem.remaining || 0)}
                  </span>
                </div>
                {#if showMonthlyBalance}
                  {@const itemMonthlyBalance = calculateMonthlyBalance(selectedBudgetItem, selectedMonth)}
                  <div class="flex justify-between">
                    <span class="text-gray-600">{selectedMonth.slice(5)}月残額:</span>
                    <span class="font-semibold" class:text-red-600={itemMonthlyBalance.remaining < 0} class:text-blue-600={itemMonthlyBalance.remaining >= 0}>
                      {formatCurrency(itemMonthlyBalance.remaining)}
                    </span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- 選択した取引の合計額 -->
            {#if checkedTransactions.size > 0}
              <div class="bg-yellow-50 p-1 rounded">
                <div class="space-y-0.5">
                  <div class="flex justify-between">
                    <span class="text-gray-600">選択件数:</span>
                    <span>{checkedTransactions.size}件</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">合計金額:</span>
                    <span class="font-semibold text-yellow-700">
                      {formatCurrency(checkedTotal)}
                    </span>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="p-2 text-center text-gray-500 text-xs">
            予算項目を選択してください
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- ペイン2: 取引一覧（メイン） -->
  <div class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
    <!-- ツールバー -->
    <div class="border-b bg-white px-4 py-2">
      <div class="flex items-center gap-2 flex-wrap">
        <button 
          class="btn btn-sm btn-ghost"
          on:click={() => showLeftPane = !showLeftPane}
        >
          ☰
        </button>
        
        <div class="flex-1"></div>
        
        <!-- 検索ボタン -->
        <button 
          class="btn btn-sm gap-1 px-4 border border-gray-400 bg-white hover:bg-gray-50"
          class:bg-gray-100={showSearch}
          class:border-gray-600={showSearch}
          on:click={() => showSearch = !showSearch}
          title="検索機能を表示/非表示"
        >
          🔍 検索
        </button>
        
        <!-- ヒントボタン -->
        <button 
          class="btn btn-sm gap-1 px-4 border border-gray-400 bg-white hover:bg-gray-50"
          class:bg-gray-100={showHints}
          class:border-gray-600={showHints}
          on:click={() => showHints = !showHints}
          title="操作ヒントを表示/非表示"
        >
          💡 ヒント
        </button>
        
        <!-- 一括選択ボタン -->
        <div class="flex items-center gap-2">
          {#if sortedTransactionData.length > 0}
            <button 
              class="btn btn-xs px-3 bg-white border border-gray-400 hover:bg-gray-50 hover:border-gray-600"
              on:click={selectAllFiltered}
              title="フィルター結果をすべて選択"
            >
              全{sortedTransactionData.length}件を選択
            </button>
          {/if}
          
          {#if checkedTransactions.size > 0}
            <button 
              class="btn btn-xs btn-ghost"
              on:click={clearAllSelection}
              title="選択をクリア"
            >
              選択解除
            </button>
          {/if}
        </div>
        
        {#if checkedTransactions.size > 0}
          <div class="flex items-center gap-3 px-3 py-1 bg-blue-50 rounded-lg border border-blue-200">
            <div class="text-sm font-semibold text-blue-700">
              <span class="text-lg">☑</span> 選択中: {checkedTransactions.size}件 / {formatCurrency(checkedTotal)}
            </div>
            
            <div class="border-l border-blue-300 h-6"></div>
            
            {#if selectedBudgetItem}
              <button 
                class="btn btn-sm px-5 bg-green-500 text-white hover:bg-green-600 border-0 gap-1 font-bold shadow-md"
                on:click={handleBulkAllocation}
                title="選択した取引を予算項目に一括で割り当てます"
              >
                <span class="text-lg">✓</span>
                <span class="font-bold">{selectedBudgetItem.name}</span>
                <span>に一括割当</span>
              </button>
            {:else}
              <div class="text-sm text-gray-500">
                ← 左から予算項目を選択してください
              </div>
            {/if}
            
            <button 
              class="btn btn-sm px-3 bg-white border border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-gray-400 gap-1 text-xs"
              on:click={async () => {
                if (!confirm(`選択した${checkedTransactions.size}件の取引の割当をすべて削除しますか？
この操作は取り消せません。`)) {
                  return;
                }
                
                // 選択された取引のすべての割当IDを収集
                const allAllocationIds: string[] = [];
                for (const transactionId of checkedTransactions) {
                  const transaction = transactionData.find(t => t.id === transactionId);
                  if (transaction && transaction.allocations) {
                    allAllocationIds.push(...transaction.allocations.map((a: any) => a.id));
                  }
                }
                
                if (allAllocationIds.length === 0) {
                  alert('削除する割当がありません');
                  return;
                }
                
                // 一括削除実行
                const formData = new FormData();
                formData.append('allocationIds', JSON.stringify(allAllocationIds));
                
                try {
                  const response = await fetch('?/bulkDeleteAllocations', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                  });
                  
                  if (response.ok) {
                    await invalidateAll();
                    checkedTransactions.clear();
                    checkedTransactions = checkedTransactions; // リアクティブ更新
                  } else {
                    alert('削除に失敗しました');
                  }
                } catch (error) {
                  console.error('削除エラー:', error);
                  alert('削除中にエラーが発生しました');
                }
              }}
              title="選択した取引の割当をすべて削除します"
            >
              <span>🗑</span>
              <span>割当を一括削除</span>
            </button>
          </div>
        {/if}
        
        <div class="text-sm text-gray-600">
          フィルター: {sortedTransactionData.length}件 / {formatCurrency(filteredTotal)}
        </div>
        
        <!-- プリセット管理（シンプル版） -->
        <SimpleFilterPreset
          bind:this={presetComponent}
          currentFilters={{
            ...headerFilters,
            checkboxFilters: {
              allocationStatus: Array.from(checkboxFilters.allocationStatus),
              account: Array.from(checkboxFilters.account),
              department: Array.from(checkboxFilters.department),
              supplier: Array.from(checkboxFilters.supplier),
              item: Array.from(checkboxFilters.item),
              primaryGrantName: Array.from(checkboxFilters.primaryGrantName),
              primaryBudgetItemName: Array.from(checkboxFilters.primaryBudgetItemName)
            }
          } as any}
          currentSorts={getCurrentSortsForPreset() as any}
          budgetItemFilters={{
            budgetItemStatusFilter,
            budgetItemGrantFilter,
            budgetItemCategoryFilter
          } as any}
          on:apply={(event) => {
            const preset = event.detail;
            
            // 初期化フラグを一時的に無効化（プリセット適用中の自動初期化を防ぐ）
            const wasInitialized = isInitialized;
            isInitialized = true;
            
            // フィルター適用
            if (preset.filters) {
              // checkboxFiltersを除外してheaderFiltersを更新
              const { checkboxFilters: _, ...filterData } = preset.filters;
              // 新しいオブジェクトとして再割り当て（リアクティビティのため）
              headerFilters = { ...headerFilters, ...filterData };
              
              if (preset.filters.checkboxFilters) {
                // Setオブジェクトに変換して復元（配列であることを確認）
                const restored = preset.filters.checkboxFilters;
                checkboxFilters = {
                  allocationStatus: new Set(Array.isArray(restored.allocationStatus) ? restored.allocationStatus : ['unallocated', 'partial', 'full']),
                  account: new Set(Array.isArray(restored.account) ? restored.account : uniqueValues.account),
                  department: new Set(Array.isArray(restored.department) ? restored.department : uniqueValues.department),
                  supplier: new Set(Array.isArray(restored.supplier) ? restored.supplier : uniqueValues.supplier),
                  item: new Set(Array.isArray(restored.item) ? restored.item : uniqueValues.item),
                  primaryGrantName: new Set(Array.isArray(restored.primaryGrantName) ? restored.primaryGrantName : uniqueValues.primaryGrantName),
                  primaryBudgetItemName: new Set(Array.isArray(restored.primaryBudgetItemName) ? restored.primaryBudgetItemName : uniqueValues.primaryBudgetItemName)
                };
              }
            }
            // ソート適用
            if (preset.sorts) {
              if (preset.sorts.budgetItemSortFields) {
                sortFields = preset.sorts.budgetItemSortFields;
              }
              if (preset.sorts.transactionSortFields) {
                transactionSortFields = preset.sorts.transactionSortFields;
              }
            }
            // 予算項目フィルター適用
            if (preset.budgetFilters) {
              budgetItemStatusFilter = preset.budgetFilters.budgetItemStatusFilter || '';
              budgetItemGrantFilter = preset.budgetFilters.budgetItemGrantFilter || '';
              budgetItemCategoryFilter = preset.budgetFilters.budgetItemCategoryFilter || '';
            }
            
            // 初期化フラグを元に戻す
            if (!wasInitialized) {
              isInitialized = wasInitialized;
            }
          }}
        />
        
        <!-- フィルタークリアボタン -->
        <button 
          class="btn btn-sm px-4 bg-white border border-orange-400 text-orange-600 hover:bg-orange-50 hover:border-orange-600 gap-1"
          on:click={clearAllHeaderFilters}
          title="すべてのヘッダーフィルターをクリア"
        >
          🗑 フィルタークリア
        </button>
        
        <!-- WAM CSV出力フィルター -->
        <div class="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
          <span class="text-sm font-medium text-gray-700">WAM CSV出力</span>
          
          <!-- 助成金選択 -->
          <select 
            bind:value={wamFilterGrantId} 
            class="select select-sm border-gray-300"
          >
            <option value="">助成金を選択</option>
            {#each data.grants.filter(g => g.status === 'active') as grant (grant.id)}
              <option value={grant.id}>{grant.name}</option>
            {/each}
          </select>
          
          <!-- 年月選択 -->
          <input 
            type="month" 
            bind:value={wamFilterYearMonth}
            class="input input-sm border-gray-300"
          />
          
          <!-- 出力ボタン -->
          <button 
            class="btn btn-sm px-4 bg-green-500 text-white hover:bg-green-600 border-0 gap-1"
            on:click={exportWamCsv}
            title="選択した条件でWAM報告用CSVを出力"
            disabled={!wamFilterGrantId || !wamFilterYearMonth}
          >
            📊 CSV出力
          </button>
        </div>
      </div>
      
      <!-- 検索バー（条件付き表示） -->
      {#if showSearch}
        <div class="px-4 py-2 bg-blue-50 border-t">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">🔍 クイック検索:</span>
            <input
              type="text"
              placeholder="取引内容、摘要、取引先、仕訳番号、勘定科目などで検索..."
              class="input input-sm input-bordered flex-1"
              bind:value={searchQuery}
            />
            {#if searchQuery}
              <button 
                class="btn btn-sm btn-ghost"
                on:click={() => searchQuery = ''}
                title="検索をクリア"
              >
                ✕
              </button>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- 操作ヒント（条件付き表示） -->
      {#if showHints}
        <div class="px-4 py-1 bg-yellow-50 border-t text-xs text-gray-600 flex items-center gap-4">
          <span>💡 ヒント:</span>
          <span>ダブルクリック または Enter: 詳細表示</span>
          <span>Space: 選択/解除</span>
          <span>↑↓: 移動</span>
          <span>Esc: パネルを閉じる</span>
          <span>Shift+クリック: 範囲選択</span>
        </div>
      {/if}
      
    </div>
    
    <!-- データグリッド表示エリア -->
    <div class="flex-1 overflow-x-auto overflow-y-auto bg-white">
      <div class="min-w-max">
        <table class="table table-xs w-full relative" style="line-height: 1.2;">
          <thead class="sticky top-0 bg-gray-100 border-b-2 border-gray-300 z-30">
          <!-- ヘッダー行 -->
          <tr>
            <th class="w-8 bg-gray-100 sticky left-0 z-40 border-r">
              <input 
                type="checkbox" 
                class="checkbox checkbox-xs" 
                checked={paginatedTransactionData.length > 0 && paginatedTransactionData.every(row => checkedTransactions.has(row.id))}
                indeterminate={paginatedTransactionData.some(row => checkedTransactions.has(row.id)) && !paginatedTransactionData.every(row => checkedTransactions.has(row.id))}
                on:change={(e) => {
                  if ((e.target as HTMLInputElement).checked) {
                    selectAllCurrentPage();
                  } else {
                    deselectAll();
                  }
                }}
              />
            </th>
            <th 
              class="w-24 bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer select-none sticky left-8 z-40 border-r"
              on:click={(e) => handleTransactionSort('primaryGrantName', e)}
            >
              <div class="flex items-center gap-1">
                割当助成金
                {#if transactionSortFields.findIndex(s => s.field === 'primaryGrantName') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'primaryGrantName')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'primaryGrantName') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th 
              class="w-24 bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer select-none sticky left-32 z-40 border-r"
              on:click={(e) => handleTransactionSort('primaryBudgetItemName', e)}
            >
              <div class="flex items-center gap-1">
                予算項目
                {#if transactionSortFields.findIndex(s => s.field === 'primaryBudgetItemName') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'primaryBudgetItemName')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'primaryBudgetItemName') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th 
              class="w-24 bg-gray-100 text-[11px] font-semibold text-gray-700 text-right cursor-pointer select-none sticky left-56 z-40 border-r"
              on:click={(e) => handleTransactionSort('allocatedAmount', e)}
            >
              <div class="flex items-center gap-1 justify-end">
                割当額
                {#if transactionSortFields.findIndex(s => s.field === 'allocatedAmount') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'allocatedAmount')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'allocatedAmount') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th 
              class="w-20 bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer select-none sticky left-80 z-40 border-r"
              on:click={(e) => handleTransactionSort('date', e)}
            >
              <div class="flex items-center gap-1">
                発生日
                {#if transactionSortFields.findIndex(s => s.field === 'date') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'date')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'date') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th 
              class="w-24 bg-gray-100 text-[11px] font-semibold text-gray-700 text-right cursor-pointer select-none sticky z-40 border-r-2 border-gray-400"
              style="left: 25rem"
              on:click={(e) => handleTransactionSort('amount', e)}
            >
              <div class="flex items-center gap-1 justify-end">
                金額
                {#if transactionSortFields.findIndex(s => s.field === 'amount') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'amount')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'amount') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th 
              class="w-28 bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer select-none"
              on:click={(e) => handleTransactionSort('account', e)}
            >
              <div class="flex items-center gap-1">
                勘定科目
                {#if transactionSortFields.findIndex(s => s.field === 'account') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'account')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'account') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th 
              class="w-20 bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer select-none"
              on:click={(e) => handleTransactionSort('department', e)}
            >
              <div class="flex items-center gap-1">
                部門
                {#if transactionSortFields.findIndex(s => s.field === 'department') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'department')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'department') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th 
              class="w-28 bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer select-none"
              on:click={(e) => handleTransactionSort('supplier', e)}
            >
              <div class="flex items-center gap-1">
                取引先
                {#if transactionSortFields.findIndex(s => s.field === 'supplier') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'supplier')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'supplier') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th 
              class="w-24 bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer select-none"
              on:click={(e) => handleTransactionSort('item', e)}
            >
              <div class="flex items-center gap-1">
                品目
                {#if transactionSortFields.findIndex(s => s.field === 'item') >= 0}
                  <span class="text-xs flex items-center gap-0.5">
                    {transactionSortFields[transactionSortFields.findIndex(s => s.field === 'item')].direction === 'asc' ? '↑' : '↓'}
                    {#if transactionSortFields.length > 1}
                      <span class="text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                        {transactionSortFields.findIndex(s => s.field === 'item') + 1}
                      </span>
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
            <th class="bg-gray-100 text-[11px] font-semibold text-gray-700">取引内容</th>
            <th class="bg-gray-100 text-[11px] font-semibold text-gray-700">明細備考</th>
            <th class="w-32 bg-gray-100 text-[11px] font-semibold text-gray-700">メモタグ</th>
            <th class="w-32 bg-gray-100 text-[11px] font-semibold text-gray-700 hidden">レシートIDs</th>
          </tr>
          
          <!-- フィルター行 -->
          <tr class="bg-gray-50 border-b border-gray-200">
            <td class="w-8 bg-gray-50 sticky left-0 z-40 border-r p-1">
              <button
                class="btn btn-xs btn-ghost tooltip tooltip-right"
                data-tip="フィルタークリア"
                on:click={clearAllHeaderFilters}
              >
                🗑
              </button>
            </td>
            
            <!-- 割当助成金フィルター (チェックボックス式) -->
            <td class="w-24 bg-gray-50 sticky left-8 z-40 border-r p-1">
              <div class="relative">
                <button
                  class="btn btn-sm btn-outline w-full text-left justify-between text-xs"
                  on:click={() => showCheckboxFilter.primaryGrantName = !showCheckboxFilter.primaryGrantName}
                >
                  <span class="truncate">
                    {checkboxFilters.primaryGrantName.size === uniqueValues.primaryGrantName.length ? '全て' : 
                     checkboxFilters.primaryGrantName.size === 0 ? 'なし' : 
                     `${checkboxFilters.primaryGrantName.size}個選択`}
                  </span>
                  <span class="ml-1">▼</span>
                </button>
                
                {#if showCheckboxFilter.primaryGrantName}
                  <div class="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-md shadow-lg min-w-48 max-h-48 overflow-y-auto">
                    <div class="p-2 border-b">
                      <div class="flex gap-1">
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('primaryGrantName', true)}>全選択</button>
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('primaryGrantName', false)}>全解除</button>
                      </div>
                    </div>
                    <div class="p-1">
                      {#each uniqueValues.primaryGrantName as value, index}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                        <label 
                          class="flex items-center gap-2 p-1 hover:bg-gray-100 cursor-pointer select-none"
                          on:click={(e) => {
                            e.preventDefault();
                            
                            if (e.shiftKey && lastClickedGrantIndex >= 0 && lastClickedGrantIndex !== index) {
                              // Shift+クリック：範囲選択
                              const start = Math.min(lastClickedGrantIndex, index);
                              const end = Math.max(lastClickedGrantIndex, index);
                              
                              // 最初にクリックした項目の状態を基準にする
                              const firstValue = uniqueValues.primaryGrantName[lastClickedGrantIndex];
                              const shouldAdd = !checkboxFilters.primaryGrantName.has(firstValue);
                              
                              for (let i = start; i <= end; i++) {
                                const v = uniqueValues.primaryGrantName[i];
                                if (shouldAdd) {
                                  checkboxFilters.primaryGrantName.add(v);
                                } else {
                                  checkboxFilters.primaryGrantName.delete(v);
                                }
                              }
                              checkboxFilters = checkboxFilters; // リアクティブ更新
                            } else {
                              // 通常のクリック
                              if (checkboxFilters.primaryGrantName.has(value)) {
                                checkboxFilters.primaryGrantName.delete(value);
                              } else {
                                checkboxFilters.primaryGrantName.add(value);
                              }
                              checkboxFilters = checkboxFilters; // リアクティブ更新
                              lastClickedGrantIndex = index;
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            class="checkbox checkbox-xs pointer-events-none"
                            checked={checkboxFilters.primaryGrantName.has(value)}
                            tabindex="-1"
                          />
                          <span class="text-xs truncate">{value}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </td>
            
            <!-- 予算項目フィルター (チェックボックス式) -->
            <td class="w-24 bg-gray-50 sticky left-32 z-40 border-r p-1">
              <div class="relative">
                <button
                  class="btn btn-sm btn-outline w-full text-left justify-between text-xs"
                  on:click={() => showCheckboxFilter.primaryBudgetItemName = !showCheckboxFilter.primaryBudgetItemName}
                >
                  <span class="truncate">
                    {checkboxFilters.primaryBudgetItemName.size === uniqueValues.primaryBudgetItemName.length ? '全て' : 
                     checkboxFilters.primaryBudgetItemName.size === 0 ? 'なし' : 
                     `${checkboxFilters.primaryBudgetItemName.size}個選択`}
                  </span>
                  <span class="ml-1">▼</span>
                </button>
                
                {#if showCheckboxFilter.primaryBudgetItemName}
                  <div class="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-md shadow-lg min-w-48 max-h-48 overflow-y-auto">
                    <div class="p-2 border-b">
                      <div class="flex gap-1">
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('primaryBudgetItemName', true)}>全選択</button>
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('primaryBudgetItemName', false)}>全解除</button>
                      </div>
                    </div>
                    <div class="p-1">
                      {#each uniqueValues.primaryBudgetItemName as value, index}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                        <label 
                          class="flex items-center gap-2 p-1 hover:bg-gray-100 cursor-pointer select-none"
                          on:click={(e) => {
                            e.preventDefault();
                            
                            if (e.shiftKey && lastClickedBudgetItemIndex >= 0 && lastClickedBudgetItemIndex !== index) {
                              // Shift+クリック：範囲選択
                              const start = Math.min(lastClickedBudgetItemIndex, index);
                              const end = Math.max(lastClickedBudgetItemIndex, index);
                              
                              // 最初にクリックした項目の状態を基準にする
                              const firstValue = uniqueValues.primaryBudgetItemName[lastClickedBudgetItemIndex];
                              const shouldAdd = !checkboxFilters.primaryBudgetItemName.has(firstValue);
                              
                              for (let i = start; i <= end; i++) {
                                const v = uniqueValues.primaryBudgetItemName[i];
                                if (shouldAdd) {
                                  checkboxFilters.primaryBudgetItemName.add(v);
                                } else {
                                  checkboxFilters.primaryBudgetItemName.delete(v);
                                }
                              }
                              checkboxFilters = checkboxFilters; // リアクティブ更新
                            } else {
                              // 通常のクリック
                              if (checkboxFilters.primaryBudgetItemName.has(value)) {
                                checkboxFilters.primaryBudgetItemName.delete(value);
                              } else {
                                checkboxFilters.primaryBudgetItemName.add(value);
                              }
                              checkboxFilters = checkboxFilters; // リアクティブ更新
                              lastClickedBudgetItemIndex = index;
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            class="checkbox checkbox-xs pointer-events-none"
                            checked={checkboxFilters.primaryBudgetItemName.has(value)}
                            tabindex="-1"
                          />
                          <span class="text-xs truncate">{value}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </td>
            
            <!-- 割当額フィルター (範囲) -->
            <td class="w-24 bg-gray-50 sticky left-56 z-40 border-r p-1">
              <!-- 割当額は複雑なので通常フィルターに委ねる -->
              <span class="text-xs text-gray-400">-</span>
            </td>
            
            <!-- 発生日フィルター (範囲) -->
            <td class="w-20 bg-gray-50 sticky left-80 z-40 border-r p-1">
              <div class="flex flex-col gap-1">
                <input
                  type="date"
                  class="input input-sm w-full text-xs"
                  bind:value={headerFilters.startDate}
                  min={dateRange.start}
                  max={dateRange.end}
                  title={`開始日 (${dateRange.start || '未設定'})`}
                />
                <input
                  type="date"
                  class="input input-sm w-full text-xs"
                  bind:value={headerFilters.endDate}
                  min={dateRange.start}
                  max={dateRange.end}
                  title={`終了日 (${dateRange.end || '未設定'})`}
                />
              </div>
            </td>
            
            <!-- 金額フィルター (範囲) -->
            <td class="w-24 bg-gray-50 sticky z-40 border-r-2 border-gray-300 p-1" style="left: 25rem">
              <div class="flex flex-col gap-1">
                <input
                  type="number"
                  class="input input-sm w-full text-xs"
                  bind:value={headerFilters.minAmount}
                  placeholder={amountRange.min ? `最小: ${amountRange.min.toLocaleString()}` : '最小'}
                />
                <input
                  type="number"
                  class="input input-sm w-full text-xs"
                  bind:value={headerFilters.maxAmount}
                  placeholder={amountRange.max ? `最大: ${amountRange.max.toLocaleString()}` : '最大'}
                />
              </div>
            </td>
            
            <!-- 勘定科目フィルター (チェックボックス式) -->
            <td class="w-28 bg-gray-50 p-1">
              <div class="relative">
                <button
                  class="btn btn-sm btn-outline w-full text-left justify-between text-xs"
                  on:click={() => showCheckboxFilter.account = !showCheckboxFilter.account}
                >
                  <span class="truncate">
                    {checkboxFilters.account.size === uniqueValues.account.length ? '全て' : 
                     checkboxFilters.account.size === 0 ? 'なし' : 
                     `${checkboxFilters.account.size}個選択`}
                  </span>
                  <span class="ml-1">▼</span>
                </button>
                
                {#if showCheckboxFilter.account}
                  <div class="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-md shadow-lg min-w-48 max-h-48 overflow-y-auto">
                    <div class="p-2 border-b">
                      <div class="flex gap-1">
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('account', true)}>全選択</button>
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('account', false)}>全解除</button>
                      </div>
                    </div>
                    <div class="p-1">
                      {#each uniqueValues.account as value}
                        <label class="flex items-center gap-2 p-1 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-xs"
                            checked={checkboxFilters.account.has(value)}
                            on:change={() => toggleCheckboxValue('account', value)}
                          />
                          <span class="text-xs truncate">{value}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </td>
            
            <!-- 部門フィルター (チェックボックス式) -->
            <td class="w-20 bg-gray-50 p-1">
              <div class="relative">
                <button
                  class="btn btn-sm btn-outline w-full text-left justify-between text-xs"
                  on:click={() => showCheckboxFilter.department = !showCheckboxFilter.department}
                >
                  <span class="truncate">
                    {checkboxFilters.department.size === uniqueValues.department.length ? '全て' : 
                     checkboxFilters.department.size === 0 ? 'なし' : 
                     `${checkboxFilters.department.size}個選択`}
                  </span>
                  <span class="ml-1">▼</span>
                </button>
                
                {#if showCheckboxFilter.department}
                  <div class="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-md shadow-lg min-w-40 max-h-48 overflow-y-auto">
                    <div class="p-2 border-b">
                      <div class="flex gap-1">
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('department', true)}>全選択</button>
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('department', false)}>全解除</button>
                      </div>
                    </div>
                    <div class="p-1">
                      {#each uniqueValues.department as value}
                        <label class="flex items-center gap-2 p-1 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-xs"
                            checked={checkboxFilters.department.has(value)}
                            on:change={() => toggleCheckboxValue('department', value)}
                          />
                          <span class="text-xs truncate">{value}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </td>
            
            <!-- 取引先フィルター (チェックボックス式) -->
            <td class="w-28 bg-gray-50 p-1">
              <div class="relative">
                <button
                  class="btn btn-sm btn-outline w-full text-left justify-between text-xs"
                  on:click={() => showCheckboxFilter.supplier = !showCheckboxFilter.supplier}
                >
                  <span class="truncate">
                    {checkboxFilters.supplier.size === uniqueValues.supplier.length ? '全て' : 
                     checkboxFilters.supplier.size === 0 ? 'なし' : 
                     `${checkboxFilters.supplier.size}個選択`}
                  </span>
                  <span class="ml-1">▼</span>
                </button>
                
                {#if showCheckboxFilter.supplier}
                  <div class="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-md shadow-lg min-w-48 max-h-48 overflow-y-auto">
                    <div class="p-2 border-b">
                      <div class="flex gap-1">
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('supplier', true)}>全選択</button>
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('supplier', false)}>全解除</button>
                      </div>
                    </div>
                    <div class="p-1">
                      {#each uniqueValues.supplier as value}
                        <label class="flex items-center gap-2 p-1 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-xs"
                            checked={checkboxFilters.supplier.has(value)}
                            on:change={() => toggleCheckboxValue('supplier', value)}
                          />
                          <span class="text-xs truncate">{value}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </td>
            
            <!-- 品目フィルター (チェックボックス式) -->
            <td class="w-24 bg-gray-50 p-1">
              <div class="relative">
                <button
                  class="btn btn-sm btn-outline w-full text-left justify-between text-xs"
                  on:click={() => showCheckboxFilter.item = !showCheckboxFilter.item}
                >
                  <span class="truncate">
                    {checkboxFilters.item.size === uniqueValues.item.length ? '全て' : 
                     checkboxFilters.item.size === 0 ? 'なし' : 
                     `${checkboxFilters.item.size}個選択`}
                  </span>
                  <span class="ml-1">▼</span>
                </button>
                
                {#if showCheckboxFilter.item}
                  <div class="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-md shadow-lg min-w-40 max-h-48 overflow-y-auto">
                    <div class="p-2 border-b">
                      <div class="flex gap-1">
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('item', true)}>全選択</button>
                        <button class="btn btn-xs btn-outline flex-1 text-xs" on:click={() => toggleAllCheckboxes('item', false)}>全解除</button>
                      </div>
                    </div>
                    <div class="p-1">
                      {#each uniqueValues.item as value}
                        <label class="flex items-center gap-2 p-1 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            class="checkbox checkbox-xs"
                            checked={checkboxFilters.item.has(value)}
                            on:change={() => toggleCheckboxValue('item', value)}
                          />
                          <span class="text-xs truncate">{value}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </td>
            
            <!-- 取引内容フィルター (テキスト) -->
            <td class="bg-gray-50 p-1">
              <input
                type="text"
                class="input input-sm w-full text-xs"
                bind:value={headerFilters.description}
                placeholder="取引内容で検索"
              />
            </td>
            
            <!-- 明細備考フィルター (テキスト) -->
            <td class="bg-gray-50 p-1">
              <input
                type="text"
                class="input input-sm w-full text-xs"
                bind:value={headerFilters.detailDescription}
                placeholder="明細備考で検索"
              />
            </td>
            
            <!-- メモタグフィルター (テキスト) -->
            <td class="w-32 bg-gray-50 p-1">
              <div class="flex flex-col gap-1">
                <input
                  type="text"
                  class="input input-sm w-full text-xs"
                  bind:value={headerFilters.tags}
                  placeholder="メモタグ"
                />
              </div>
            </td>
            
            <!-- レシートIDsフィルター（非表示） -->
            <td class="w-32 bg-gray-50 p-1 hidden">
              <span class="text-xs text-gray-400">-</span>
            </td>
            
          </tr>
        </thead>
        <tbody>
          {#each paginatedTransactionData as row, index}
            {@const isOdd = index % 2 === 1}
            <tr 
              class="hover:bg-blue-50 cursor-pointer transition-colors duration-150 border-b border-gray-100"
              style="height: 24px; line-height: 1;"
              class:bg-gray-50={isOdd}
              class:bg-blue-100={selectedTransaction?.id === row.id}
              class:ring-2={selectedRowIndex === index}
              class:ring-blue-400={selectedRowIndex === index}
              class:ring-offset-1={selectedRowIndex === index}
              on:click={() => {
                selectedTransaction = row as any;
                selectedRowIndex = index;
                // 右ペインは自動で開かない（Enterキーかダブルクリックで開く）
              }}
              on:dblclick={() => {
                selectedTransaction = row as any;
                selectedRowIndex = index;
                showRightPane = true;
                // freeeファイルボックスから画像を取得
                if (row.freeDealId) {
                  loadFreeeReceipts(row.freeDealId.toString());
                }
              }}
            >
              <!-- チェックボックス -->
              <td class="p-0.5 sticky left-0 z-20 bg-white border-r">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-xs"
                  checked={checkedTransactions.has(row.id)}
                  on:click|stopPropagation={(e) => {
                    if (e.shiftKey && lastClickedTransactionIndex >= 0 && lastClickedTransactionIndex !== index) {
                      // Shift+クリック：範囲選択
                      const start = Math.min(lastClickedTransactionIndex, index);
                      const end = Math.max(lastClickedTransactionIndex, index);
                      
                      // 最初にクリックした項目の現在の状態を基準にする（クリック後の状態）
                      const firstRowId = paginatedTransactionData[lastClickedTransactionIndex].id;
                      const shouldCheck = checkedTransactions.has(firstRowId);
                      
                      for (let i = start; i <= end; i++) {
                        const rowId = paginatedTransactionData[i].id;
                        if (shouldCheck) {
                          checkedTransactions.add(rowId);
                        } else {
                          checkedTransactions.delete(rowId);
                        }
                      }
                      checkedTransactions = checkedTransactions; // リアクティブ更新
                    } else {
                      // 通常のクリック
                      if (checkedTransactions.has(row.id)) {
                        checkedTransactions.delete(row.id);
                      } else {
                        checkedTransactions.add(row.id);
                      }
                      checkedTransactions = checkedTransactions;
                      lastClickedTransactionIndex = index;
                    }
                  }}
                />
              </td>
              
              <!-- 割当助成金 -->
              <td class="text-xs p-0.5 text-gray-700 max-w-24 sticky left-8 z-20 bg-white border-r">
                {#if row.allocations.length > 0}
                  {#each row.allocations as alloc}
                    <div class="truncate" title={alloc.budgetItem.grant.name}>
                      {alloc.budgetItem.grant.name}
                    </div>
                  {/each}
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
              
              <!-- 予算項目 -->
              <td class="text-xs p-0.5 text-gray-700 max-w-24 sticky left-32 z-20 bg-white border-r">
                {#if row.allocations.length > 0}
                  {#each row.allocations as alloc}
                    <div class="truncate" title={alloc.budgetItem.name}>
                      {alloc.budgetItem.name}
                    </div>
                  {/each}
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
              
              <!-- 割当額 -->
              <td class="text-xs p-0.5 text-right font-medium sticky left-56 z-20 bg-white border-r">
                {#if row.allocations.length > 0}
                  {#each row.allocations as alloc}
                    <div class="text-green-700">
                      {formatCurrency(alloc.amount)}
                    </div>
                  {/each}
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
              
              <!-- 発生日 -->
              <td class="text-xs p-0.5 font-medium text-gray-800 sticky left-80 z-20 bg-white border-r">{row.date}</td>
              
              <!-- 金額 -->
              <td class="text-sm p-0.5 text-right font-semibold text-gray-900 sticky z-20 bg-white border-r-2 border-gray-300" style="left: 25rem">
                {formatCurrency(row.amount)}
              </td>
              
              <!-- 勘定科目 -->
              <td class="text-xs p-0.5 text-gray-700 max-w-28 truncate" title={row.account}>
                {row.account}
              </td>
              
              <!-- 部門 -->
              <td class="text-xs p-0.5 text-gray-600 max-w-20 truncate" title={row.department}>
                {row.department}
              </td>
              
              <!-- 取引先 -->
              <td class="text-xs p-0.5 text-gray-700 max-w-28 truncate" title={row.supplier}>
                {row.supplier}
              </td>
              
              <!-- 品目 -->
              <td class="text-xs p-0.5 text-gray-600 max-w-24 truncate" title={row.item}>
                {row.item || '-'}
              </td>
              
              <!-- 取引内容 -->
              <td class="text-xs p-0.5 text-gray-800 max-w-64 truncate" title={row.description}>
                {row.description || '-'}
              </td>
              
              <!-- 明細備考 -->
              <td class="text-xs p-0.5 text-gray-600 max-w-64 truncate" title={row.detailDescription}>
                {row.detailDescription || '-'}
              </td>
              
              <!-- メモタグ -->
              <td class="text-xs p-0.5 text-gray-600 max-w-32 truncate">
                {#if row.tags}
                  <div class="text-blue-600" title={row.tags}>{row.tags}</div>
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
              
              <!-- レシートIDs（非表示） -->
              <td class="text-xs p-0.5 text-gray-600 max-w-32 hidden">
                {#if row.receiptIds && row.receiptIds.length > 0}
                  <div class="text-green-600" title="レシート{row.receiptIds.length}件">
                    📎 {row.receiptIds.length}件
                  </div>
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
              
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
    </div>
    
    <!-- ページネーションコントロール（フッター） -->
    <div class="flex items-center justify-between gap-4 px-4 py-2 bg-gray-50 border-t">
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-600">表示件数:</label>
        <select 
          class="select select-sm select-bordered w-20"
          bind:value={itemsPerPage}
          on:change={handleItemsPerPageChange}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </select>
        <span class="text-sm text-gray-600 ml-2">
          {startIndex + 1}-{endIndex}件 / 全{sortedTransactionData.length}件
        </span>
      </div>
      
      <div class="flex items-center gap-1">
        <button 
          class="btn btn-sm px-4 bg-white border border-gray-400 hover:bg-gray-50 hover:border-gray-600"
          on:click={goToFirstPage}
          disabled={currentPage === 1}
          title="最初のページ"
        >
          ≪
        </button>
        <button 
          class="btn btn-sm px-4 bg-white border border-gray-400 hover:bg-gray-50 hover:border-gray-600"
          on:click={goToPreviousPage}
          disabled={currentPage === 1}
          title="前のページ"
        >
          ＜
        </button>
        
        <div class="flex items-center gap-1 mx-2">
          <span class="text-sm text-gray-600">ページ</span>
          <input 
            type="number" 
            class="input input-sm input-bordered w-16 text-center"
            bind:value={pageInputValue}
            on:blur={handlePageInput}
            on:keydown={(e) => e.key === 'Enter' && handlePageInput()}
            min="1"
            max={totalPages}
          />
          <span class="text-sm text-gray-600">/ {totalPages}</span>
        </div>
        
        <button 
          class="btn btn-sm px-4 bg-white border border-gray-400 hover:bg-gray-50 hover:border-gray-600"
          on:click={goToNextPage}
          disabled={currentPage === totalPages}
          title="次のページ"
        >
          ＞
        </button>
        <button 
          class="btn btn-sm px-4 bg-white border border-gray-400 hover:bg-gray-50 hover:border-gray-600"
          on:click={goToLastPage}
          disabled={currentPage === totalPages}
          title="最後のページ"
        >
          ≫
        </button>
      </div>
      
      <div class="text-sm text-gray-600">
        全{totalPages}ページ
      </div>
    </div>
    
    <!-- 右ペインが閉じている時のヒント -->
    {#if !showRightPane && selectedTransaction}
      <button
        class="absolute right-0 top-1/2 -translate-y-1/2 bg-blue-500 text-white px-1 py-4 rounded-l-lg shadow-lg hover:bg-blue-600 transition-colors z-50"
        on:click={() => showRightPane = true}
        title="詳細を表示 (Enter/ダブルクリック)"
      >
        <span class="text-xs writing-mode-vertical">詳細</span>
      </button>
    {/if}
  </div>

  <!-- ペイン3: 取引明細 -->
  {#if showRightPane && selectedTransaction}
    <div class="w-96 border-l bg-white transition-all duration-300 overflow-hidden relative flex-shrink-0">
      <div class="h-full flex flex-col">
        <div class="border-b px-3 py-2 bg-gray-50 flex justify-between items-center">
          <h3 class="text-sm font-semibold">取引明細</h3>
          <button 
            class="btn btn-xs btn-ghost"
            on:click={() => {
              showRightPane = false;
              displayedDealId = null;
            }}
          >
            ✕
          </button>
        </div>
        <div class="flex-1 overflow-auto p-3">
          <div class="space-y-3 text-sm">
            <!-- 割当情報セクション -->
            <div class="pb-3 border-b">
              <div class="flex justify-between items-center mb-2">
                <span class="text-gray-600 font-semibold">割当情報</span>
                {#if rightPaneMode === 'view'}
                  <button 
                    class="btn btn-xs btn-primary"
                    on:click={() => selectedTransaction && openAllocationForm(selectedTransaction)}
                    disabled={selectedTransaction?.allocationStatus === 'full'}
                  >
                    新規割当
                  </button>
                {/if}
              </div>
              
              {#if rightPaneMode === 'create' || rightPaneMode === 'edit'}
                <!-- インライン割当フォーム -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <div class="flex justify-between items-center mb-3">
                    <h4 class="font-semibold text-sm text-blue-800">
                      {rightPaneMode === 'edit' ? '割当編集' : '新規割当'}
                    </h4>
                    <button 
                      class="btn btn-xs btn-ghost text-blue-600" 
                      on:click={closeAllocationForm}
                    >
                      ✕
                    </button>
                  </div>
                  
                  <form method="POST" action="?/saveAllocation" use:enhance={handleFormResult} class="space-y-3">
                    <input type="hidden" name="transactionId" value={selectedTransaction?.id} />
                    {#if editingAllocation}
                      <input type="hidden" name="allocationId" value={editingAllocation.id} />
                    {/if}
                    
                    <div class="form-control w-full">
                      <label class="label py-1">
                        <span class="label-text text-xs">予算項目</span>
                      </label>
                      <select 
                        class="select select-bordered select-sm w-full text-xs" 
                        name="budgetItemId"
                        bind:value={allocationForm.budgetItemId}
                        required
                      >
                        <option value="">予算項目を選択</option>
                        {#each data.budgetItems.filter(item => {
                          const grant = data.grants.find(g => g.id === item.grantId);
                          return grant?.status !== 'applied';
                        }) as item}
                          <option value={item.id.toString()}>
                            {getBudgetItemDisplayName(item as any)} (残額: {formatCurrency(item.remaining || 0)})
                          </option>
                        {/each}
                      </select>
                    </div>
                    
                    <div class="form-control w-full">
                      <label class="label py-1">
                        <span class="label-text text-xs">割当額</span>
                      </label>
                      <div class="flex gap-1">
                        <input 
                          type="number" 
                          class="input input-bordered input-sm flex-1 text-xs" 
                          name="amount"
                          bind:value={allocationForm.amount}
                          min="0"
                          max={selectedTransaction?.amount}
                          required
                        />
                        <button 
                          type="button"
                          class="btn btn-xs bg-white border border-gray-400 hover:bg-gray-50"
                          on:click={setRemainingAmount}
                        >
                          残額
                        </button>
                      </div>
                      {#if parseInt(allocationForm.amount) > selectedTransaction?.unallocatedAmount}
                        <label class="label py-1">
                          <span class="label-text-alt text-warning text-xs">
                            未割当額を超過しています
                          </span>
                        </label>
                      {/if}
                    </div>
                    
                    <div class="form-control w-full">
                      <label class="label py-1">
                        <span class="label-text text-xs">備考</span>
                      </label>
                      <textarea 
                        class="textarea textarea-bordered textarea-sm text-xs" 
                        name="note"
                        bind:value={allocationForm.note}
                        placeholder="備考（任意）"
                        rows="2"
                      ></textarea>
                    </div>
                    
                    <div class="flex gap-2 justify-end pt-2">
                      <button 
                        type="button" 
                        class="btn btn-sm btn-ghost text-xs" 
                        on:click={closeAllocationForm}
                      >
                        キャンセル
                      </button>
                      <button type="submit" class="btn btn-sm btn-primary text-xs">
                        {rightPaneMode === 'edit' ? '更新' : '保存'}
                      </button>
                    </div>
                  </form>
                </div>
              {/if}
              
              {#if selectedTransaction?.allocations?.length > 0}
                <div class="space-y-1">
                  <!-- 一括削除ボタン -->
                  {#if selectedAllocationIds.size > 0}
                    <div class="flex justify-between items-center mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <span class="text-sm text-yellow-800">
                        {selectedAllocationIds.size}件選択中
                      </span>
                      <button 
                        class="btn btn-sm btn-error"
                        on:click={bulkDeleteAllocations}
                        disabled={isDeleting}
                      >
                        {isDeleting ? '削除中...' : '選択した項目を削除'}
                      </button>
                    </div>
                  {/if}
                  
                  {#each selectedTransaction?.allocations || [] as alloc}
                    <div class="flex items-center gap-2">
                      <!-- チェックボックス -->
                      <input 
                        type="checkbox" 
                        class="checkbox checkbox-sm"
                        checked={selectedAllocationIds.has(alloc.id)}
                        on:change={() => {
                          if (selectedAllocationIds.has(alloc.id)) {
                            selectedAllocationIds.delete(alloc.id);
                          } else {
                            selectedAllocationIds.add(alloc.id);
                          }
                          selectedAllocationIds = selectedAllocationIds; // リアクティブ更新
                        }}
                      />
                      
                      <div class="flex justify-between items-center flex-1">
                        <span class="flex-1">
                          {alloc.budgetItem.grant.name}・{alloc.budgetItem.name} /{formatCurrency(alloc.amount)}
                        </span>
                        <div class="flex gap-1 ml-2">
                          <button 
                            class="btn btn-xs btn-outline"
                            on:click={() => editAllocation(alloc)}
                            disabled={rightPaneMode !== 'view'}
                          >
                            編集
                          </button>
                          <button 
                            class="btn btn-xs btn-error btn-outline"
                            on:click|stopPropagation={() => deleteAllocation(alloc.id)}
                            disabled={rightPaneMode !== 'view'}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="text-gray-400">未割当</div>
              {/if}
            </div>
            
            <!-- 2行目: 発生日・金額 -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-gray-600">発生日:</span>
                <span class="ml-2">{selectedTransaction.date}</span>
              </div>
              <div>
                <span class="text-gray-600">金額:</span>
                <span class="ml-2 font-semibold">{formatCurrency(selectedTransaction.amount)}</span>
              </div>
            </div>
            
            <!-- 3行目: 勘定科目・部門 -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-gray-600">勘定科目:</span>
                <span class="ml-2">{selectedTransaction.account || '-'}</span>
              </div>
              <div>
                <span class="text-gray-600">部門:</span>
                <span class="ml-2">{selectedTransaction.department || '-'}</span>
              </div>
            </div>
            
            <!-- 4行目: 取引先・取引内容 -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-gray-600">取引先:</span>
                <span class="ml-2">{selectedTransaction.supplier || '-'}</span>
              </div>
              <div>
                <span class="text-gray-600">取引内容:</span>
                <span class="ml-2">{selectedTransaction.detailDescription || '-'}</span>
              </div>
            </div>
            
            <!-- 5行目: 品目・メモタグ -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-gray-600">品目:</span>
                <span class="ml-2">{selectedTransaction.item || '-'}</span>
              </div>
              <div>
                <span class="text-gray-600">メモタグ:</span>
                <span class="ml-2 text-blue-600">{selectedTransaction.tags || '-'}</span>
              </div>
            </div>
            
            <!-- 6行目: 明細ID・取引ID -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-gray-600">明細ID:</span>
                <span class="ml-2 text-xs text-gray-500">{selectedTransaction.detailId || '-'}</span>
              </div>
              <div>
                <span class="text-gray-600">取引ID:</span>
                <span class="ml-2 text-xs text-gray-500">{selectedTransaction.freeDealId || '-'}</span>
              </div>
            </div>
            
            <!-- freeeリンクボタン -->
            {#if selectedTransaction.freeDealId}
              <div class="mt-3 pt-3 border-t">
                <a 
                  href="https://secure.freee.co.jp/deals/standards?deal_id={selectedTransaction.freeDealId}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm btn-outline btn-info w-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  freeeで取引を確認
                </a>
              </div>
            {/if}
          </div>

          <!-- 領収書ファイル表示エリア -->
          <div class="border-t mt-4 pt-4">
            <h4 class="font-semibold text-sm mb-2">領収書ファイル</h4>
            <div id="receipts-container" class="space-y-4">
              <!-- freeeファイルボックスから画像を読み込み中... -->
              <div class="text-sm text-gray-500">読み込み中...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- モーダル削除済み - インラインフォームを右ペインに統合 -->

<!-- 一括割当用の隠しフォーム（SvelteKitのCSRF保護を活用） -->
<form 
  bind:this={bulkAllocationFormRef}
  method="POST" 
  action="?/bulkAllocation" 
  use:enhance={handleBulkAllocationResult}
  class="hidden"
>
  {#if selectedBudgetItem}
    <input type="hidden" name="budgetItemId" value={selectedBudgetItem.id} />
  {/if}
  {#each Array.from(checkedTransactions) as transactionId}
    <input type="hidden" name="transactionIds" value={transactionId} />
  {/each}
</form>

<!-- 領収書画像拡大表示用ポップアップ -->
{#if enlargedImageUrl}
  <div 
    class="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center"
    on:click={closeEnlargedImage}
  >
    <div class="relative max-w-7xl max-h-screen p-4">
      <img 
        src={enlargedImageUrl} 
        alt={enlargedImageAlt}
        class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        on:click|stopPropagation
      />
      <button 
        class="absolute top-2 right-2 btn btn-circle btn-sm bg-white text-black hover:bg-gray-200"
        on:click={closeEnlargedImage}
      >
        ✕
      </button>
      <div class="absolute bottom-4 left-4 right-4 text-center text-white bg-black bg-opacity-50 rounded p-2">
        {enlargedImageAlt}
      </div>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    overflow: hidden;
  }
  
  .table-compact td, .table-compact th {
    padding: 0.25rem 0.5rem;
  }
  
  /* 左ペインのテーブルをさらにコンパクトに */
  .table-xs td {
    padding: 0.125rem 0.25rem;
    line-height: 1.2;
  }
  
  .table-xs th {
    padding: 0.25rem 0.25rem;
    line-height: 1.2;
  }
  
  /* キーボード選択時のハイライト */
  .ring-2 {
    --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
    --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
    box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
  }
  
  /* 縦書きテキスト */
  .writing-mode-vertical {
    writing-mode: vertical-rl;
    text-orientation: mixed;
  }
</style>