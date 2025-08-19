<script lang="ts">
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { Transaction, AllocationSplit, BudgetItem } from '$lib/types/models.js';
  import type { PageData } from './$types.js';
  
  // TransactionWithAllocations型定義
  interface TransactionWithAllocations extends Transaction {
    allocations: (AllocationSplit & {
      budgetItem: BudgetItem & {
        grant: { name: string };
      };
    })[];
  }
  
  interface AllocationSplitForm {
    id?: string | number;
    budgetItemId: number | string;
    amount: number | string;
    note: string;
    budgetItemName?: string;
    isNew?: boolean;
  }

  interface FlatAllocationRow {
    id: string;
    date: string;
    description: string;
    grantName: string;
    budgetItemName: string;
    category: string;
    amount: number;
    note: string;
    createdAt: string;
    transactionAmount: number;
  }
  
  export let data: PageData;
  export let form: any;
  
  // データの型を明示的に定義
  let transactions: TransactionWithAllocations[] = [];
  let budgetItems: BudgetItem[] = [];
  let allAllocations: AllocationSplit[] = [];
  
  $: ({ transactions = [], budgetItems = [], allAllocations = [] } = data);

  // Gridテーブル関連
  let tableData: any[] = [];
  let allocationHistoryData: any[] = [];

  // 分割割当モーダルの状態
  let showAllocationModal = false;
  let selectedTransaction: TransactionWithAllocations | null = null;
  let allocationSplits: AllocationSplitForm[] = [];
  let newSplit: AllocationSplitForm = { budgetItemId: '', amount: '', note: '' };

  // 取引選択
  function selectTransactionForAllocation(transaction: TransactionWithAllocations) {
    selectedTransaction = transaction;
    // 既存の割当を読み込み
    allocationSplits = transaction.allocations.map(a => ({
      id: a.id,
      budgetItemId: a.budgetItemId,
      amount: a.amount,
      note: a.note || '',
      budgetItemName: `${a.budgetItem.grant.name} - ${a.budgetItem.name}`
    }));
    showAllocationModal = true;
  }

  // 新しい分割を追加
  function addSplit() {
    if (newSplit.budgetItemId && newSplit.amount) {
      const budgetItem = budgetItems.find(b => b.id === parseInt(newSplit.budgetItemId));
      if (budgetItem) {
        allocationSplits = [...allocationSplits, {
          id: `new-${Date.now()}`,
          budgetItemId: parseInt(newSplit.budgetItemId),
          amount: parseInt(newSplit.amount),
          note: newSplit.note,
          budgetItemName: `${budgetItem.grant.name} - ${budgetItem.name}`,
          isNew: true
        }];
        newSplit = { budgetItemId: '', amount: '', note: '' };
      }
    }
  }

  // 分割を削除
  function removeSplit(index: number) {
    allocationSplits = allocationSplits.filter((_, i) => i !== index);
  }

  // 合計計算
  $: totalAllocated = allocationSplits.reduce((sum, split) => sum + split.amount, 0);
  $: remaining = selectedTransaction ? selectedTransaction.amount - totalAllocated : 0;

  // 取引割当一覧の表示用データ
  $: {
    tableData = transactions.map(tx => {
      const totalAllocated = tx.allocations.reduce((sum, a) => sum + a.amount, 0);
      const remaining = tx.amount - totalAllocated;
      const allocationStatus = tx.allocations.length > 0 
        ? (remaining === 0 ? '完全割当' : '部分割当') 
        : '未割当';
      
      return {
        id: tx.id,
        allocationStatus,
        totalAllocated,
        allocations: tx.allocations.length > 0 
          ? tx.allocations.map(a => `${a.budgetItem.grant.name} - ${a.budgetItem.name} (¥${a.amount.toLocaleString()})`).join('\n')
          : '',
        remaining,
        date: new Date(tx.date).toLocaleDateString('ja-JP'),
        amount: tx.amount,
        account: tx.account || '',
        department: tx.department || '',
        supplier: tx.supplier || '',
        item: tx.item || '',
        description: tx.description || '',
        detailDescription: tx.detailDescription || '',
        tags: tx.tags || '',
        managementNumber: tx.managementNumber || '',
        memo: tx.memo || '',
        remark: tx.remark || '',
        journalNumber: typeof tx.journalNumber === 'bigint' ? tx.journalNumber.toString() : tx.journalNumber,
        journalLineNumber: tx.journalLineNumber,
        receiptIds: tx.receiptIds || ''
      };
    });
  }

  // HTMLテーブル実装に変更したため、Grid列定義は削除済み

  // フラット表示用データ
  let flatAllocations: FlatAllocationRow[] = [];
  let filteredAllocations: FlatAllocationRow[] = [];
  let sortField = 'date';
  let sortDirection = 'desc';
  
  // フィルター条件
  let grantFilter = '';
  let budgetItemFilter = '';
  let dateFromFilter = '';
  let dateToFilter = '';
  let amountMinFilter = '';
  let amountMaxFilter = '';
  
  // ユニークな助成金・予算項目リスト
  let uniqueGrants: string[] = [];
  let uniqueBudgetItems: string[] = [];
  
  $: {
    // フラットデータの生成
    flatAllocations = allAllocations.map(allocation => ({
      id: allocation.id,
      date: new Date(allocation.transaction.date).toLocaleDateString('ja-JP'),
      description: allocation.transaction.description || '',
      grantName: allocation.budgetItem.grant.name,
      budgetItemName: allocation.budgetItem.name,
      category: allocation.budgetItem.category || '未分類',
      amount: allocation.amount,
      note: allocation.note || '',
      createdAt: new Date(allocation.createdAt).toLocaleDateString('ja-JP'),
      transactionAmount: allocation.transaction.amount
    }));
    
    // ユニークリストの生成
    uniqueGrants = [...new Set(flatAllocations.map(a => a.grantName))].sort();
    uniqueBudgetItems = [...new Set(flatAllocations.map(a => a.budgetItemName))].sort();
  }
  
  // フィルタリング
  $: {
    filteredAllocations = flatAllocations.filter(allocation => {
      // 助成金フィルター
      if (grantFilter && allocation.grantName !== grantFilter) return false;
      
      // 予算項目フィルター
      if (budgetItemFilter && allocation.budgetItemName !== budgetItemFilter) return false;
      
      // 日付フィルター
      const allocationDate = new Date(allocation.date.split('/').reverse().join('-'));
      if (dateFromFilter) {
        const fromDate = new Date(dateFromFilter);
        if (allocationDate < fromDate) return false;
      }
      if (dateToFilter) {
        const toDate = new Date(dateToFilter);
        if (allocationDate > toDate) return false;
      }
      
      // 金額フィルター
      if (amountMinFilter && allocation.amount < parseInt(amountMinFilter)) return false;
      if (amountMaxFilter && allocation.amount > parseInt(amountMaxFilter)) return false;
      
      return true;
    });
  }
  
  // ソート機能
  function sortBy(field: string) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  }
  
  $: {
    filteredAllocations = [...filteredAllocations].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'date':
          aVal = new Date(a.date.split('/').reverse().join('-'));
          bVal = new Date(b.date.split('/').reverse().join('-'));
          break;
        case 'amount':
        case 'transactionAmount':
          aVal = a[sortField];
          bVal = b[sortField];
          break;
        default:
          aVal = a[sortField as keyof FlatAllocationRow]?.toString().toLowerCase() || '';
          bVal = b[sortField as keyof FlatAllocationRow]?.toString().toLowerCase() || '';
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  // フィルタークリア
  function clearFilters() {
    grantFilter = '';
    budgetItemFilter = '';
    dateFromFilter = '';
    dateToFilter = '';
    amountMinFilter = '';
    amountMaxFilter = '';
  }

  // HTMLテーブル実装のため、割当履歴列定義も削除済み

  // 分割割当を保存
  let saving = false;

  async function saveAllocation() {
    if (!selectedTransaction || saving) return;
    
    saving = true;
    
    const formData = new FormData();
    formData.append('transactionId', selectedTransaction.id);
    formData.append('allocations', JSON.stringify(allocationSplits.map(split => ({
      budgetItemId: split.budgetItemId,
      amount: split.amount,
      note: split.note || ''
    }))));

    try {
      const response = await fetch('?/saveAllocation', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        showAllocationModal = false;
        await invalidateAll(); // データを再読み込み
      } else {
        console.error('Failed to save allocation');
      }
    } catch (error: any) {
      console.error('Save error:', error);
    } finally {
      saving = false;
    }
  }

  // HTMLテーブル実装では不要なため削除済み
</script>

<!-- HTML テーブルを使用しているため、特別なスタイルは不要 -->

<div class="space-y-6">
  <!-- ページヘッダー -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900">
      割当管理
    </h2>
    <p class="mt-2 text-sm text-gray-600">
      すべての予算割当を一覧で確認・管理できます
    </p>
  </div>

  <!-- 統計情報 -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">要</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">割当要対応</dt>
              <dd class="text-lg font-medium text-gray-900">{transactions.length}件</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">総</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">総割当件数</dt>
              <dd class="text-lg font-medium text-gray-900">{allAllocations.length}件</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">額</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">総割当額</dt>
              <dd class="text-sm font-medium text-gray-900">
                ¥{allAllocations.reduce((sum, a) => sum + a.amount, 0).toLocaleString()}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">表</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">表示件数</dt>
              <dd class="text-lg font-medium text-gray-900">{filteredAllocations.length}件</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- フィルター -->  
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
      <h3 class="text-lg leading-6 font-medium text-gray-900">
        フィルター
      </h3>
    </div>
    
    <div class="p-4">
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <!-- 助成金フィルター -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">助成金</label>
          <select bind:value={grantFilter} class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">すべて</option>
            {#each uniqueGrants as grant}
              <option value={grant}>{grant}</option>
            {/each}
          </select>
        </div>
        
        <!-- 予算項目フィルター -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">予算項目</label>
          <select bind:value={budgetItemFilter} class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">すべて</option>
            {#each uniqueBudgetItems as item}
              <option value={item}>{item}</option>
            {/each}
          </select>
        </div>
        
        <!-- 日付From -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">日付開始</label>
          <input type="date" bind:value={dateFromFilter} class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        
        <!-- 日付To -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">日付終了</label>
          <input type="date" bind:value={dateToFilter} class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        
        <!-- 金額Min -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">金額最小</label>
          <input type="number" bind:value={amountMinFilter} placeholder="0" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
        
        <!-- 金額Max -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">金額最大</label>
          <input type="number" bind:value={amountMaxFilter} placeholder="1000000" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
        </div>
      </div>
      
      <div class="mt-4">
        <button on:click={clearFilters} class="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">
          フィルタークリア
        </button>
      </div>
    </div>
  </div>

  <!-- メイン割当テーブル -->
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
      <h3 class="text-lg leading-6 font-medium text-gray-900">
        予算割当一覧
      </h3>
      <p class="mt-1 max-w-2xl text-sm text-gray-500">
        すべての予算割当をフラットに表示します
      </p>
    </div>
    
    <div class="p-4">
      {#if filteredAllocations.length > 0}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortBy('date')}>
                  日付 
                  {#if sortField === 'date'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortBy('description')}>
                  摘要
                  {#if sortField === 'description'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortBy('grantName')}>
                  助成金
                  {#if sortField === 'grantName'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortBy('budgetItemName')}>
                  予算項目
                  {#if sortField === 'budgetItemName'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortBy('category')}>
                  カテゴリ
                  {#if sortField === 'category'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortBy('amount')}>
                  割当金額
                  {#if sortField === 'amount'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortBy('transactionAmount')}>
                  取引金額
                  {#if sortField === 'transactionAmount'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortBy('note')}>
                  メモ
                  {#if sortField === 'note'}
                    <span class="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each filteredAllocations as allocation}
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{allocation.date}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" title={allocation.description}>
                    {allocation.description.length > 30 ? allocation.description.substring(0, 30) + '...' : allocation.description}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{allocation.grantName}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{allocation.budgetItemName}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{allocation.category}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">¥{allocation.amount.toLocaleString()}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">¥{allocation.transactionAmount.toLocaleString()}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" title={allocation.note}>
                    {allocation.note.length > 20 ? allocation.note.substring(0, 20) + '...' : allocation.note}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <form method="POST" action="?/deleteAllocation" use:enhance class="inline">
                      <input type="hidden" name="allocationId" value={allocation.id}>
                      <button type="submit" class="text-red-600 hover:text-red-900" on:click={event => { if (!confirm('この割当を削除しますか？')) event.preventDefault(); }}>
                        削除
                      </button>
                    </form>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="text-center py-12">
          <div class="text-gray-500">
            <p>表示する割当データがありません</p>
            {#if grantFilter || budgetItemFilter || dateFromFilter || dateToFilter || amountMinFilter || amountMaxFilter}
              <p class="text-sm mt-2">フィルター条件を変更してください</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- 分割割当対象取引（縮小版） -->
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
      <h3 class="text-lg leading-6 font-medium text-gray-900">
        分割割当対象取引
      </h3>
      <p class="mt-1 max-w-2xl text-sm text-gray-500">
        未割当または部分割当の取引一覧です（分割割当機能用）
      </p>
    </div>
    
    <div class="p-4">
      {#if tableData.length > 0}
        <!-- 基本HTMLテーブル -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">割当状況</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">割当済み金額</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">未割当金額</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">発生日</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">勘定科目</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">取引内容</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each tableData as row}
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap">
                    {#if row.allocationStatus === '完全割当'}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">{row.allocationStatus}</span>
                    {:else if row.allocationStatus === '部分割当'}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">{row.allocationStatus}</span>
                    {:else}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">{row.allocationStatus}</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {row.totalAllocated > 0 ? `¥${row.totalAllocated.toLocaleString()}` : '-'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {#if row.remaining > 0}
                      <span class="text-orange-600 font-medium">¥{row.remaining.toLocaleString()}</span>
                    {:else if row.remaining < 0}
                      <span class="text-red-600 font-medium">¥{row.remaining.toLocaleString()}</span>
                    {:else}
                      <span class="text-green-600">¥0</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">¥{row.amount.toLocaleString()}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.account}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.description}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      on:click={() => {
                        const transaction = transactions.find(t => t.id === row.id);
                        if (transaction) {
                          selectTransactionForAllocation(transaction);
                        }
                      }}
                      class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                      割当
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="text-center py-12">
          <div class="text-gray-500">
            <p>取引データがありません</p>
            <p class="text-sm mt-2">freee連携ページでデータを同期してください</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- 分割割当モーダル -->
{#if showAllocationModal && selectedTransaction}
<div class="fixed inset-0 z-50 overflow-y-auto">
  <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
    <div class="fixed inset-0 transition-opacity" aria-hidden="true">
      <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
    </div>

    <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
      <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
        <div class="sm:flex sm:items-start">
          <div class="w-full">
            <!-- ヘッダー -->
            <div class="flex justify-between items-center mb-6">
              <div>
                <h3 class="text-lg leading-6 font-medium text-gray-900">
                  分割割当設定
                </h3>
                <p class="mt-1 text-sm text-gray-500">
                  {selectedTransaction.description} (¥{selectedTransaction.amount.toLocaleString()})
                </p>
              </div>
              <button on:click={() => showAllocationModal = false} class="text-gray-400 hover:text-gray-600">
                <span class="sr-only">閉じる</span>
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- 現在の分割状況 -->
            <div class="mb-6">
              <h4 class="text-md font-medium text-gray-900 mb-3">現在の分割状況</h4>
              {#if allocationSplits.length > 0}
                <div class="space-y-2">
                  {#each allocationSplits as split, index}
                    <div class="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                      <div class="flex-1">
                        <div class="text-sm font-medium text-gray-900">{split.budgetItemName}</div>
                        <div class="text-sm text-gray-600">¥{split.amount.toLocaleString()}</div>
                        {#if split.note}
                          <div class="text-xs text-gray-500">{split.note}</div>
                        {/if}
                      </div>
                      <button on:click={() => removeSplit(index)} class="ml-4 text-red-600 hover:text-red-800">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-sm text-gray-500">まだ分割が設定されていません</p>
              {/if}
            </div>

            <!-- 新しい分割を追加 -->
            <div class="mb-6 border-t pt-6">
              <h4 class="text-md font-medium text-gray-900 mb-3">新しい分割を追加</h4>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">予算項目</label>
                  <select bind:value={newSplit.budgetItemId} class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">選択してください</option>
                    {#each budgetItems as item}
                      <option value={item.id}>{item.grant.name} - {item.name}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">金額</label>
                  <input type="number" bind:value={newSplit.amount} placeholder="0" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">備考</label>
                  <input type="text" bind:value={newSplit.note} placeholder="分割理由など" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                </div>
              </div>
              <div class="mt-3">
                <button on:click={addSplit} class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  分割を追加
                </button>
              </div>
            </div>

            <!-- 合計表示 -->
            <div class="bg-gray-50 p-4 rounded-md">
              <div class="flex justify-between items-center text-sm">
                <span>取引金額:</span>
                <span class="font-medium">¥{selectedTransaction.amount.toLocaleString()}</span>
              </div>
              <div class="flex justify-between items-center text-sm mt-1">
                <span>割当合計:</span>
                <span class="font-medium">¥{totalAllocated.toLocaleString()}</span>
              </div>
              <div class="flex justify-between items-center text-sm mt-1 pt-2 border-t">
                <span>残額:</span>
                <span class="font-medium {remaining > 0 ? 'text-orange-600' : remaining < 0 ? 'text-red-600' : 'text-green-600'}">
                  ¥{remaining.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- モーダルフッター -->
      <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
        <button 
          on:click={saveAllocation}
          disabled={saving || allocationSplits.length === 0}
          type="button" 
          class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? '保存中...' : '保存'}
        </button>
        <button 
          on:click={() => showAllocationModal = false} 
          type="button" 
          class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
          キャンセル
        </button>
      </div>
    </div>
  </div>
</div>
{/if}

<!-- デバッグ情報は削除済み -->