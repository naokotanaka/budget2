<script lang="ts">
  import type { PageData } from './$types';
  import { writable } from 'svelte/store';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { AllocationSplit, BudgetItem, Grant, Transaction } from '$lib/types/models';
  
  export let data: PageData;
  
  // 定数
  const LEFT_PANE_WIDTH = 300; // px
  const DEFAULT_BUDGET_STATUS = 'active';
  const DEFAULT_TRANSACTION_STATUS = 'all';
  
  // 型定義
  interface BudgetItemWithGrant extends BudgetItem {
    grant?: Grant;
    grantName: string;
    grantStatus: string;
    grantStartDate: string;
    grantEndDate: string;
    remaining: number;
    allocatedAmount?: number;
    schedules?: Array<{ month: number; year: number }>;
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
      budgetItem: BudgetItem & { grant: Grant } 
    }>;
    supplier: string;
    department: string;
    account: string;
    memo: string;
    tags: string;
    item: string;
    receiptIds: string[];
    dateObj: Date;
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
  let checkedTransactions = new Set<string>();
  
  // キーボードショートカット用の行選択状態
  let selectedRowIndex = -1;
  
  // 左ペインフィルター状態
  let budgetItemStatusFilter = DEFAULT_BUDGET_STATUS;
  let budgetItemGrantFilter = '';
  let budgetItemCategoryFilter = '';
  
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
  
  // フィルター状態
  let filterStatus = DEFAULT_TRANSACTION_STATUS;
  let filterGrant = ''; // 助成金フィルター
  let searchQuery = '';
  let startDate = '';
  let endDate = '';
  
  // モーダル状態
  let showAllocationModal = false;
  let allocationForm: AllocationFormData = {
    budgetItemId: '',
    amount: '',
    note: ''
  };
  let editingAllocation: (AllocationSplit & { 
    budgetItem: BudgetItem & { grant: Grant } 
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
    const remaining = (item.amount || 0) - allocatedAmount;
    
    return {
      ...item,
      name: cleanBudgetItemName(item.name),
      grant,
      grantName: grant?.name || '',
      grantStatus: grant?.status || DEFAULT_BUDGET_STATUS,
      grantStartDate: formatDate(grant?.startDate),
      grantEndDate: formatDate(grant?.endDate),
      remaining: remaining
    } as BudgetItemWithGrant;
  });

  // 左ペインフィルター適用
  $: filteredBudgetItems = budgetItemsWithGrant.filter(item => {
    // ステータスフィルター（デフォルト: 進行中のみ）
    if (budgetItemStatusFilter !== 'all' && item.grantStatus !== budgetItemStatusFilter) return false;
    
    // 助成金フィルター
    if (budgetItemGrantFilter && !item.grantName.toLowerCase().includes(budgetItemGrantFilter.toLowerCase())) return false;
    
    // カテゴリフィルター
    if (budgetItemCategoryFilter && (!item.category || !item.category.toLowerCase().includes(budgetItemCategoryFilter.toLowerCase()))) return false;
    
    return true;
  });

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
        result = (aValue || 0) - (bValue || 0);
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
  let transactionData = data.transactions.map(transaction => ({
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
    memo: transaction.memo || '',
    tags: transaction.tags || '',
    item: transaction.item || '',
    receiptIds: transaction.receiptIds || [],
    dateObj: new Date(transaction.date)
  }));
  
  // データ更新時の処理（invalidateAll等による更新時のみ）
  let prevTransactions = data.transactions;
  $: if (data.transactions && data.transactions !== prevTransactions) {
    prevTransactions = data.transactions;
    transactionData = data.transactions.map(transaction => ({
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
      memo: transaction.memo || '',
      tags: transaction.tags || '',
      item: transaction.item || '',
      receiptIds: transaction.receiptIds || [],
      dateObj: new Date(transaction.date)
    }));
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
  
  // フィルタリング処理（シンプル分離）
  $: filteredTransactionData = transactionData.filter(row => {
    // 割当状況フィルター
    if (filterStatus === 'allocated' && row.allocationStatus !== 'full') return false;
    if (filterStatus === 'unallocated' && row.allocationStatus !== 'unallocated') return false;
    if (filterStatus === 'partial' && row.allocationStatus !== 'partial') return false;
    
    // 助成金フィルター
    if (filterGrant && !row.allocations.some(alloc => alloc.budgetItem.grantId.toString() === filterGrant)) return false;
    
    // 期間フィルター
    if (startDateObj && row.dateObj < startDateObj) return false;
    if (endDateObj && row.dateObj > endDateObj) return false;
    
    // 検索クエリフィルター
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchText = (
        row.description.toLowerCase() + ' ' +
        row.detailDescription.toLowerCase() + ' ' +
        row.supplier.toLowerCase() + ' ' +
        row.journalNumber + ' ' +
        row.account.toLowerCase()
      );
      return searchText.includes(query);
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
  
  // フィルターやソートが変更されたらページを1に戻す
  $: if (filterStatus || filterGrant || searchQuery || startDate || endDate || transactionSortFields) {
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
  
  // 割当モーダルを開く
  function openAllocationModal(transaction: TransactionRow) {
    selectedTransaction = transaction;
    showAllocationModal = true;
    allocationForm = {
      budgetItemId: '',
      amount: transaction.unallocatedAmount.toString(),
      note: ''
    };
    editingAllocation = null;
  }
  
  // 割当編集モーダルを開く
  function editAllocation(allocation: AllocationSplit & { 
    budgetItem: BudgetItem & { grant: Grant } 
  }) {
    editingAllocation = allocation;
    allocationForm = {
      budgetItemId: allocation.budgetItemId.toString(),
      amount: allocation.amount.toString(),
      note: allocation.note || ''
    };
    showAllocationModal = true;
  }
  
  // モーダルを閉じる
  function closeAllocationModal() {
    showAllocationModal = false;
    selectedTransaction = null;
    editingAllocation = null;
    allocationForm = {
      budgetItemId: '',
      amount: '',
      note: ''
    };
  }
  
  // 残額を自動入力
  function setRemainingAmount() {
    if (selectedTransaction) {
      allocationForm.amount = selectedTransaction.unallocatedAmount.toString();
    }
  }
  
  // 予算項目の表示名を取得
  function getBudgetItemDisplayName(budgetItem: BudgetItem): string {
    const grant = data.grants.find(g => g.id === budgetItem.grantId);
    return `${grant?.name || ''} - ${budgetItem.name}`;
  }
  
  // 一括割当ボタンの処理
  async function handleBulkAllocation() {
    if (!selectedBudgetItem || checkedTransactions.size === 0) return;
    
    const formData = new FormData();
    formData.append('budgetItemId', selectedBudgetItem.id.toString());
    Array.from(checkedTransactions).forEach(id => {
      formData.append('transactionIds', id);
    });
    
    const response = await fetch('?/bulkAllocation', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      await invalidateAll();
      checkedTransactions.clear();
      checkedTransactions = checkedTransactions;
      // 選択中の予算項目を再選択して残額を更新
      if (selectedBudgetItem) {
        const updated = budgetItemsWithGrant.find(item => item.id === selectedBudgetItem.id);
        if (updated) {
          selectedBudgetItem = updated;
        }
      }
    }
  }
  
  // 割当削除
  async function deleteAllocation(allocationId: string) {
    if (!confirm('この割当を削除しますか？')) return;
    
    const formData = new FormData();
    formData.append('allocationId', allocationId);
    
    const response = await fetch('?/deleteAllocation', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      await invalidateAll();
      // 選択した取引の情報を更新
      if (selectedTransaction) {
        const updatedTransaction = transactionData.find(t => t.id === selectedTransaction.id);
        if (updatedTransaction) {
          selectedTransaction = updatedTransaction;
        }
      }
      // 選択中の予算項目を再選択して残額を更新
      if (selectedBudgetItem) {
        const updated = budgetItemsWithGrant.find(item => item.id === selectedBudgetItem.id);
        if (updated) {
          selectedBudgetItem = updated;
        }
      }
    }
  }
  
  // フォーム送信後の処理
  function handleFormResult() {
    return async ({ result }: { result: { type: string } }) => {
      if (result.type === 'success') {
        closeAllocationModal();
        await invalidateAll();
        // 選択した取引の情報を更新
        if (selectedTransaction) {
          const updatedTransaction = transactionData.find(t => t.id === selectedTransaction.id);
          if (updatedTransaction) {
            selectedTransaction = updatedTransaction;
          }
        }
        // 選択中の予算項目を再選択して残額を更新
        if (selectedBudgetItem) {
          const updated = budgetItemsWithGrant.find(item => item.id === selectedBudgetItem.id);
          if (updated) {
            selectedBudgetItem = updated;
          }
        }
      }
    };
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
      selectedTransaction = paginatedTransactionData[selectedRowIndex];
      showRightPane = true;
      scrollToSelectedRow();
    }
  }
  
  function selectFirstRow() {
    if (paginatedTransactionData.length > 0) {
      selectedRowIndex = 0;
      selectedTransaction = paginatedTransactionData[0];
      showRightPane = true;
      scrollToSelectedRow();
    }
  }
  
  function selectLastRow() {
    if (paginatedTransactionData.length > 0) {
      selectedRowIndex = paginatedTransactionData.length - 1;
      selectedTransaction = paginatedTransactionData[selectedRowIndex];
      showRightPane = true;
      scrollToSelectedRow();
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
        selectedTransaction = paginatedTransactionData[selectedRowIndex];
      }
      showRightPane = !showRightPane;
    }
  }
  
  function closeModalsAndPanes() {
    if (showAllocationModal) {
      closeAllocationModal();
    } else if (showRightPane) {
      showRightPane = false;
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
  
  // キーボードイベントハンドラー
  function handleKeyDown(e: KeyboardEvent) {
    // 入力フィールドにフォーカスがある場合は無効
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }
  
    // モーダル表示中の処理
    if (showAllocationModal) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAllocationModal();
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
    }
  });
  
  onDestroy(() => {
    if (browser) {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });
  
  // ページ変更時に選択をリセット
  $: if (currentPage) {
    selectedRowIndex = -1;
  }
  
  // ページネーション後のデータが変更されたときに選択インデックスを調整
  $: if (paginatedTransactionData.length > 0 && selectedTransaction) {
    const index = paginatedTransactionData.findIndex(row => row.id === selectedTransaction.id);
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
    class="border-r bg-white transition-all duration-300 overflow-hidden flex flex-col"
    style="width: {showLeftPane ? LEFT_PANE_WIDTH + 'px' : '0'}"
  >
    {#if showLeftPane}
      <div class="flex-1 flex flex-col min-h-0">
        <!-- フィルタツールバー -->
        <div class="border-b px-3 py-2 bg-gray-50">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2 text-sm">
              <label class="text-gray-600 shrink-0">ステータス:</label>
              <select class="select select-xs select-bordered" bind:value={budgetItemStatusFilter}>
                <option value="active">進行中</option>
                <option value="all">すべて</option>
                <option value="completed">完了</option>
                <option value="applied">申請中</option>
                <option value="reported">報告済</option>
              </select>
              
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
                <th class="w-6 text-xs"></th>
                <th 
                  class="cursor-pointer select-none min-w-[80px] text-xs"
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
                  class="cursor-pointer select-none min-w-[100px] text-xs"
                  on:click={(e) => handleSort('name', e)}
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
                <th 
                  class="cursor-pointer select-none min-w-[55px] text-xs"
                  on:click={(e) => handleSort('grantStartDate', e)}
                >
                  <div class="flex items-center gap-1">
                    助成開始
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
                    助成終了
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
                  <td class="p-0.5">
                    <input 
                      type="radio" 
                      name="selectedBudgetItem" 
                      class="radio radio-xs radio-primary"
                      checked={selectedBudgetItem?.id === item.id}
                      on:change={() => selectedBudgetItem = item}
                    />
                  </td>
                  <td class="text-xs p-0.5 min-w-[80px]" title={item.grantName}>
                    {item.grantName}
                  </td>
                  <td class="text-xs p-0.5 min-w-[100px]" title={item.name}>
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
                  <td class="text-xs p-0.5 min-w-[55px]" title={item.grantStartDate}>
                    {formatShortDate(item.grantStartDate)}
                  </td>
                  <td class="text-xs p-0.5 min-w-[55px]" title={item.grantEndDate}>
                    {formatShortDate(item.grantEndDate)}
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
  <div class="flex-1 flex flex-col">
    <!-- ツールバー -->
    <div class="border-b bg-white px-4 py-2">
      <div class="flex items-center gap-2 flex-wrap">
        <button 
          class="btn btn-sm btn-ghost"
          on:click={() => showLeftPane = !showLeftPane}
        >
          ☰
        </button>
        
        <!-- 検索 -->
        <input
          type="text"
          placeholder="検索（摘要、取引先、仕訳番号、勘定科目）"
          class="input input-sm input-bordered w-64"
          bind:value={searchQuery}
        />
        
        <!-- 期間フィルター -->
        <div class="flex items-center gap-1">
          <label class="text-sm text-gray-600">期間:</label>
          <input
            type="date"
            class="input input-sm input-bordered w-36"
            bind:value={startDate}
          />
          <span class="text-sm text-gray-600">〜</span>
          <input
            type="date"
            class="input input-sm input-bordered w-36"
            bind:value={endDate}
          />
        </div>
        
        <!-- 割当状況フィルター -->
        <select class="select select-sm select-bordered" bind:value={filterStatus}>
          <option value="all">すべて</option>
          <option value="unallocated">未割当</option>
          <option value="partial">部分割当</option>
          <option value="allocated">完全割当</option>
        </select>
        
        <!-- 助成金フィルター -->
        <select class="select select-sm select-bordered" bind:value={filterGrant}>
          <option value="">助成金選択</option>
          {#each data.grants as grant}
            <option value={grant.id.toString()}>{grant.name}</option>
          {/each}
        </select>
        
        <div class="flex-1"></div>
        
        {#if checkedTransactions.size > 0}
          <div class="text-sm">
            選択: {checkedTransactions.size}件 / {formatCurrency(checkedTotal)}
          </div>
          {#if selectedBudgetItem}
            <button class="btn btn-sm btn-primary" on:click={handleBulkAllocation}>
              → {selectedBudgetItem.name}に一括割当
            </button>
          {/if}
        {/if}
        
        <div class="text-sm text-gray-600">
          表示: {sortedTransactionData.length}件 / {formatCurrency(filteredTotal)}
        </div>
      </div>
      
      <!-- ページネーションコントロール -->
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
            class="btn btn-sm btn-outline"
            on:click={goToFirstPage}
            disabled={currentPage === 1}
            title="最初のページ"
          >
            ≪
          </button>
          <button 
            class="btn btn-sm btn-outline"
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
            class="btn btn-sm btn-outline"
            on:click={goToNextPage}
            disabled={currentPage === totalPages}
            title="次のページ"
          >
            ＞
          </button>
          <button 
            class="btn btn-sm btn-outline"
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
    </div>
    
    <!-- データグリッド表示エリア -->
    <div class="flex-1 overflow-auto bg-white">
      <table class="table table-compact w-full">
        <thead class="sticky top-0 bg-gray-100 border-b-2 border-gray-300">
          <tr>
            <th class="w-8 bg-gray-100">
              <input 
                type="checkbox" 
                class="checkbox checkbox-xs" 
                checked={paginatedTransactionData.length > 0 && paginatedTransactionData.every(row => checkedTransactions.has(row.id))}
                indeterminate={paginatedTransactionData.some(row => checkedTransactions.has(row.id)) && !paginatedTransactionData.every(row => checkedTransactions.has(row.id))}
                on:change={(e) => {
                  if (e.target.checked) {
                    selectAllCurrentPage();
                  } else {
                    deselectAll();
                  }
                }}
              />
            </th>
            <th class="w-32 bg-gray-100 text-[11px] font-semibold text-gray-700">割当助成金</th>
            <th class="w-32 bg-gray-100 text-[11px] font-semibold text-gray-700">予算項目</th>
            <th 
              class="w-24 bg-gray-100 text-[11px] font-semibold text-gray-700 text-right cursor-pointer select-none"
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
              class="w-20 bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer select-none"
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
              class="w-24 bg-gray-100 text-[11px] font-semibold text-gray-700 text-right cursor-pointer select-none"
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
            <th class="w-32 bg-gray-100 text-[11px] font-semibold text-gray-700">メモ・タグ</th>
            <th class="w-16 bg-gray-100 text-[11px] font-semibold text-gray-700 text-center">📎</th>
            <th class="w-16 bg-gray-100 text-[11px] font-semibold text-gray-700 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedTransactionData as row, index}
            {@const isOdd = index % 2 === 1}
            <tr 
              class="hover:bg-blue-50 cursor-pointer transition-colors duration-150 border-b border-gray-100"
              class:bg-gray-50={isOdd}
              class:bg-blue-100={selectedTransaction?.id === row.id}
              class:ring-2={selectedRowIndex === index}
              class:ring-blue-400={selectedRowIndex === index}
              class:ring-offset-1={selectedRowIndex === index}
              on:click={() => {
                selectedTransaction = row;
                selectedRowIndex = index;
                showRightPane = true;
              }}
            >
              <!-- チェックボックス -->
              <td class="p-2">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-xs"
                  checked={checkedTransactions.has(row.id)}
                  on:click|stopPropagation={() => {
                    if (checkedTransactions.has(row.id)) {
                      checkedTransactions.delete(row.id);
                    } else {
                      checkedTransactions.add(row.id);
                    }
                    checkedTransactions = checkedTransactions;
                  }}
                />
              </td>
              
              <!-- 割当助成金 -->
              <td class="text-xs p-2 text-gray-700 max-w-32">
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
              <td class="text-xs p-2 text-gray-700 max-w-32">
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
              <td class="text-xs p-2 text-right font-medium">
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
              <td class="text-xs p-2 font-medium text-gray-800">{row.date}</td>
              
              <!-- 金額 -->
              <td class="text-sm p-2 text-right font-semibold text-gray-900">
                {formatCurrency(row.amount)}
              </td>
              
              <!-- 勘定科目 -->
              <td class="text-xs p-2 text-gray-700 max-w-28 truncate" title={row.account}>
                {row.account}
              </td>
              
              <!-- 部門 -->
              <td class="text-xs p-2 text-gray-600 max-w-20 truncate" title={row.department}>
                {row.department}
              </td>
              
              <!-- 取引先 -->
              <td class="text-xs p-2 text-gray-700 max-w-28 truncate" title={row.supplier}>
                {row.supplier}
              </td>
              
              <!-- 品目 -->
              <td class="text-xs p-2 text-gray-600 max-w-24 truncate" title={row.item}>
                {row.item || '-'}
              </td>
              
              <!-- 取引内容 -->
              <td class="text-xs p-2 text-gray-800 max-w-64 truncate" title={row.detailDescription}>
                {row.detailDescription}
              </td>
              
              <!-- メモ・タグ -->
              <td class="text-xs p-2 text-gray-600 max-w-32 truncate">
                {#if row.memo || row.tags}
                  <div class="space-y-1">
                    {#if row.memo}
                      <div title={row.memo}>{row.memo}</div>
                    {/if}
                    {#if row.tags}
                      <div class="text-blue-600" title={row.tags}>{row.tags}</div>
                    {/if}
                  </div>
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
              
              <!-- 添付ファイル -->
              <td class="p-2 text-center">
                {#if row.receiptIds && row.receiptIds.length > 0}
                  <span class="text-gray-500" title="{row.receiptIds.length}件の添付ファイル">
                    📎 {row.receiptIds.length}
                  </span>
                {:else}
                  <span class="text-gray-300">-</span>
                {/if}
              </td>
              
              <!-- 操作 -->
              <td class="p-2 text-center">
                <button 
                  class="btn btn-xs btn-primary transition-all duration-200 hover:shadow-md"
                  on:click|stopPropagation={() => openAllocationModal(row)}
                  title="割当を追加"
                >
                  +
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- ペイン3: 取引明細 -->
  <div 
    class="border-l bg-white transition-all duration-300 overflow-hidden"
    class:w-96={showRightPane}
    class:w-0={!showRightPane}
  >
    {#if showRightPane && selectedTransaction}
      <div class="h-full flex flex-col">
        <div class="border-b px-3 py-2 bg-gray-50 flex justify-between items-center">
          <h3 class="text-sm font-semibold">取引明細</h3>
          <button 
            class="btn btn-xs btn-ghost"
            on:click={() => showRightPane = false}
          >
            ✕
          </button>
        </div>
        <div class="flex-1 overflow-auto p-3">
          <div class="space-y-2 text-sm">
            <div>
              <span class="text-gray-600">日付:</span>
              <span class="ml-2">{selectedTransaction.date}</span>
            </div>
            <div>
              <span class="text-gray-600">仕訳番号:</span>
              <span class="ml-2">{selectedTransaction.journalNumber}</span>
            </div>
            <div>
              <span class="text-gray-600">勘定科目:</span>
              <span class="ml-2">{selectedTransaction.account}</span>
            </div>
            <div>
              <span class="text-gray-600">摘要:</span>
              <span class="ml-2">{selectedTransaction.description}</span>
            </div>
            <div>
              <span class="text-gray-600">取引先:</span>
              <span class="ml-2">{selectedTransaction.supplier}</span>
            </div>
            <div>
              <span class="text-gray-600">金額:</span>
              <span class="ml-2">{formatCurrency(selectedTransaction.amount)}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="flex justify-between items-center">
              <h4 class="font-semibold">割当情報</h4>
              <button 
                class="btn btn-xs btn-primary"
                on:click={() => openAllocationModal(selectedTransaction)}
                disabled={selectedTransaction.allocationStatus === 'full'}
              >
                新規割当
              </button>
            </div>
            
            {#if selectedTransaction.allocations.length > 0}
              {#each selectedTransaction.allocations as alloc}
                <div class="p-2 bg-gray-50 rounded mb-1">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="font-medium text-sm">{alloc.budgetItem.name}</div>
                      <div class="text-xs text-gray-600">{alloc.budgetItem.grant.name}</div>
                      <div class="font-semibold text-sm">{formatCurrency(alloc.amount)}</div>
                      {#if alloc.note}
                        <div class="text-xs text-gray-500 mt-1">{alloc.note}</div>
                      {/if}
                    </div>
                    <div class="flex gap-1 ml-2">
                      <button 
                        class="btn btn-xs btn-outline"
                        on:click={() => editAllocation(alloc)}
                      >
                        編集
                      </button>
                      <button 
                        class="btn btn-xs btn-error btn-outline"
                        on:click|stopPropagation={() => deleteAllocation(alloc.id)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="text-center text-gray-500 text-sm py-4">
                割当がありません
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>

<!-- 割当設定モーダル -->
{#if showAllocationModal && selectedTransaction}
  <div class="modal modal-open">
    <div class="modal-box w-11/12 max-w-2xl">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">
          {editingAllocation ? '割当編集' : '新規割当'}
        </h3>
        <button class="btn btn-sm btn-circle btn-ghost" on:click={closeAllocationModal}>
          ✕
        </button>
      </div>
      
      <!-- 取引詳細 -->
      <div class="bg-gray-50 p-3 rounded mb-4">
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div><span class="text-gray-600">日付:</span> {selectedTransaction.date}</div>
          <div><span class="text-gray-600">金額:</span> {formatCurrency(selectedTransaction.amount)}</div>
          <div><span class="text-gray-600">摘要:</span> {selectedTransaction.description}</div>
          <div><span class="text-gray-600">取引先:</span> {selectedTransaction.supplier}</div>
          <div><span class="text-gray-600">割当済:</span> {formatCurrency(selectedTransaction.allocatedAmount)}</div>
          <div><span class="text-gray-600">未割当:</span> {formatCurrency(selectedTransaction.unallocatedAmount)}</div>
        </div>
      </div>
      
      <!-- 割当フォーム -->
      <form method="POST" action="?/saveAllocation" use:enhance={handleFormResult}>
        <input type="hidden" name="transactionId" value={selectedTransaction.id} />
        {#if editingAllocation}
          <input type="hidden" name="allocationId" value={editingAllocation.id} />
        {/if}
        
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">予算項目</span>
          </label>
          <select 
            class="select select-bordered w-full" 
            name="budgetItemId"
            bind:value={allocationForm.budgetItemId}
            required
          >
            <option value="">予算項目を選択</option>
            {#each data.budgetItems as item}
              <option value={item.id}>
                {getBudgetItemDisplayName(item)} (残額: {formatCurrency(item.remaining || 0)})
              </option>
            {/each}
          </select>
        </div>
        
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">割当額</span>
          </label>
          <div class="flex gap-2">
            <input 
              type="number" 
              class="input input-bordered flex-1" 
              name="amount"
              bind:value={allocationForm.amount}
              min="0"
              max={selectedTransaction.amount}
              required
            />
            <button 
              type="button"
              class="btn btn-outline btn-sm"
              on:click={setRemainingAmount}
            >
              残額入力
            </button>
          </div>
          {#if parseInt(allocationForm.amount) > selectedTransaction.unallocatedAmount}
            <label class="label">
              <span class="label-text-alt text-warning">
                未割当額を超過しています
              </span>
            </label>
          {/if}
        </div>
        
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">備考</span>
          </label>
          <textarea 
            class="textarea textarea-bordered" 
            name="note"
            bind:value={allocationForm.note}
            placeholder="備考（任意）"
          ></textarea>
        </div>
        
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" on:click={closeAllocationModal}>
            キャンセル
          </button>
          <button type="submit" class="btn btn-primary">
            {editingAllocation ? '更新' : '保存'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
</div>

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
</style>