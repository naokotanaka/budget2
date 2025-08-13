<script lang="ts">
  import type { PageData } from './$types';
  import { writable } from 'svelte/store';
  
  export let data: PageData;
  
  // ペイン表示状態の管理
  let showLeftPane = true;
  let showRightPane = false;
  let leftPaneView = 'grant'; // 'grant' or 'category'
  let periodFilter = '';
  
  // 選択状態の管理
  let selectedGrant: any = null;
  let selectedBudgetItem: any = null;
  let selectedTransaction: any = null;
  let checkedTransactions = new Set<string>();
  
  // フィルター状態
  let filterStatus = 'all';
  let searchQuery = '';
  
  // 取引データの準備（一時的に既存のロジックを保持）
  $: transactionData = data.transactions.map(transaction => {
    const allocatedAmount = transaction.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    const unallocatedAmount = transaction.amount - allocatedAmount;
    
    return {
      id: transaction.id,
      date: new Date(transaction.date).toLocaleDateString('ja-JP'),
      journalNumber: transaction.journalNumber.toString(),
      description: transaction.description || '',
      detailDescription: transaction.detailDescription || '',
      amount: transaction.amount,
      allocatedAmount: allocatedAmount,
      unallocatedAmount: unallocatedAmount,
      allocationCount: transaction.allocations.length,
      allocations: transaction.allocations,
      supplier: transaction.supplier || '',
      department: transaction.department || '',
      account: transaction.account || '',
      memo: transaction.memo || '',
      hasAllocations: transaction.allocations.length > 0,
      isFullyAllocated: allocatedAmount === transaction.amount
    };
  });
  
  // チェックされた取引の合計額
  $: checkedTotal = Array.from(checkedTransactions).reduce((sum, id) => {
    const transaction = transactionData.find(t => t.id === id);
    return sum + (transaction?.amount || 0);
  }, 0);
  
  // フィルター適用後のデータ
  $: filteredData = transactionData.filter(row => {
    if (filterStatus === 'allocated' && !row.isFullyAllocated) return false;
    if (filterStatus === 'unallocated' && row.hasAllocations) return false;
    if (filterStatus === 'partial' && (!row.hasAllocations || row.isFullyAllocated)) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        row.description.toLowerCase().includes(query) ||
        row.detailDescription.toLowerCase().includes(query) ||
        row.supplier.toLowerCase().includes(query) ||
        row.journalNumber.includes(query)
      );
    }
    
    return true;
  });
  
  // フィルター適用後の合計額
  $: filteredTotal = filteredData.reduce((sum, row) => sum + row.amount, 0);
</script>

<div class="flex h-screen bg-gray-50">
  <!-- ペイン1: 助成金/予算項目一覧 -->
  <div 
    class="border-r bg-white transition-all duration-300 overflow-hidden flex flex-col"
    class:w-80={showLeftPane}
    class:w-0={!showLeftPane}
  >
    {#if showLeftPane}
      <!-- 上部: グリッド表示 -->
      <div class="flex-1 flex flex-col min-h-0">
        <!-- ツールバー -->
        <div class="border-b px-2 py-1 bg-gray-50 flex items-center gap-2">
          <select class="select select-xs select-bordered flex-1" bind:value={leftPaneView}>
            <option value="grant">助成金別</option>
            <option value="category">カテゴリ別</option>
          </select>
          <input 
            type="text" 
            placeholder="期間絞込" 
            class="input input-xs input-bordered w-24"
            bind:value={periodFilter}
          />
        </div>
        
        <!-- グリッド表示エリア -->
        <div class="flex-1 overflow-auto">
          <table class="table table-xs w-full">
            <thead class="sticky top-0 bg-gray-100">
              <tr>
                <th>名称</th>
                {#if leftPaneView === 'category'}
                  <th>助成金</th>
                {:else}
                  <th>カテゴリ</th>
                {/if}
                <th class="text-right">予算</th>
                <th class="text-right">残額</th>
              </tr>
            </thead>
            <tbody>
              {#if leftPaneView === 'grant'}
                <!-- 助成金別表示 -->
                {#each data.grants as grant}
                  <tr 
                    class="hover cursor-pointer font-semibold bg-blue-50"
                    on:click={() => {
                      selectedGrant = grant;
                      selectedBudgetItem = null;
                    }}
                  >
                    <td colspan="4" class="text-xs">
                      {grant.name}
                      {#if grant.startDate && grant.endDate}
                        <span class="font-normal text-gray-600 ml-2">
                          ({new Date(grant.startDate).toLocaleDateString('ja-JP', {year: 'numeric', month: 'numeric'})} 〜 
                          {new Date(grant.endDate).toLocaleDateString('ja-JP', {year: 'numeric', month: 'numeric'})})
                        </span>
                      {/if}
                    </td>
                  </tr>
                  {#each data.budgetItems.filter(item => item.grantId === grant.id) as item}
                    <tr 
                      class="hover cursor-pointer"
                      class:bg-blue-100={selectedBudgetItem?.id === item.id}
                      on:click={() => {
                        selectedBudgetItem = item;
                        selectedGrant = grant;
                      }}
                    >
                      <td class="pl-4 text-xs">
                        {item.name}
                        {#if item.schedules && item.schedules.length > 0}
                          <span class="text-gray-500 ml-1">({item.schedules[0].month}月)</span>
                        {/if}
                      </td>
                      <td class="text-xs text-gray-600">{item.category || '未分類'}</td>
                      <td class="text-right text-xs">
                        {item.budgetedAmount ? `¥${item.budgetedAmount.toLocaleString()}` : '-'}
                      </td>
                      <td class="text-right text-xs">
                        {item.remaining !== undefined ? `¥${item.remaining.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  {/each}
                {/each}
              {:else}
                <!-- カテゴリ別表示 -->
                {@const categories = [...new Set(data.budgetItems.map(item => item.category || '未分類'))]}
                {#each categories as category}
                  <tr class="font-semibold bg-green-50">
                    <td colspan="4" class="text-xs">{category}</td>
                  </tr>
                  {#each data.budgetItems.filter(item => (item.category || '未分類') === category) as item}
                    {@const grant = data.grants.find(g => g.id === item.grantId)}
                    <tr 
                      class="hover cursor-pointer"
                      class:bg-green-100={selectedBudgetItem?.id === item.id}
                      on:click={() => {
                        selectedBudgetItem = item;
                        selectedGrant = grant;
                      }}
                    >
                      <td class="pl-4 text-xs">
                        {item.name}
                        {#if item.schedules && item.schedules.length > 0}
                          <span class="text-gray-500 ml-1">({item.schedules[0].month}月)</span>
                        {/if}
                      </td>
                      <td class="text-xs text-gray-600">
                        {grant?.name || ''}
                        {#if grant?.startDate && grant?.endDate}
                          <span class="text-gray-500 text-[10px]">
                            ({new Date(grant.startDate).getMonth() + 1}〜{new Date(grant.endDate).getMonth() + 1}月)
                          </span>
                        {/if}
                      </td>
                      <td class="text-right text-xs">
                        {item.budgetedAmount ? `¥${item.budgetedAmount.toLocaleString()}` : '-'}
                      </td>
                      <td class="text-right text-xs">
                        {item.remaining !== undefined ? `¥${item.remaining.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  {/each}
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- 下部: 詳細表示 -->
      <div class="h-48 border-t bg-gray-50 overflow-auto">
        {#if selectedBudgetItem}
          <div class="p-2 space-y-1 text-xs">
            <h4 class="font-semibold text-sm mb-2">{selectedBudgetItem.name}</h4>
            <div class="grid grid-cols-2 gap-1">
              <div class="text-gray-600">助成金:</div>
              <div>{selectedGrant?.name || '-'}</div>
              
              <div class="text-gray-600">カテゴリ:</div>
              <div>{selectedBudgetItem.category || '未分類'}</div>
              
              <div class="text-gray-600">予算額:</div>
              <div>¥{selectedBudgetItem.budget?.toLocaleString() || '0'}</div>
              
              <div class="text-gray-600">割当済:</div>
              <div>¥{selectedBudgetItem.allocated?.toLocaleString() || '0'}</div>
              
              <div class="text-gray-600">残額:</div>
              <div class="font-semibold">
                ¥{selectedBudgetItem.remaining?.toLocaleString() || '0'}
              </div>
              
              {#if selectedGrant}
                <div class="text-gray-600">期間:</div>
                <div>
                  {selectedGrant.startDate ? new Date(selectedGrant.startDate).toLocaleDateString('ja-JP') : ''} 〜
                  {selectedGrant.endDate ? new Date(selectedGrant.endDate).toLocaleDateString('ja-JP') : ''}
                </div>
                
                <div class="text-gray-600">残り日数:</div>
                <div>
                  {#if selectedGrant.endDate}
                    {@const days = Math.ceil((new Date(selectedGrant.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
                    <span class:text-red-600={days < 30} class:text-orange-600={days < 60}>
                      {days}日
                    </span>
                  {:else}
                    -
                  {/if}
                </div>
              {/if}
            </div>
            
            {#if selectedBudgetItem.description}
              <div class="mt-2 pt-2 border-t">
                <div class="text-gray-600">備考:</div>
                <div class="text-xs">{selectedBudgetItem.description}</div>
              </div>
            {/if}
          </div>
        {:else if selectedGrant}
          <div class="p-2 space-y-1 text-xs">
            <h4 class="font-semibold text-sm mb-2">{selectedGrant.name}</h4>
            <div class="grid grid-cols-2 gap-1">
              <div class="text-gray-600">総予算:</div>
              <div>¥{selectedGrant.totalBudget?.toLocaleString() || '0'}</div>
              
              <div class="text-gray-600">割当済:</div>
              <div>¥{selectedGrant.totalAllocated?.toLocaleString() || '0'}</div>
              
              <div class="text-gray-600">残額:</div>
              <div class="font-semibold">
                ¥{selectedGrant.totalRemaining?.toLocaleString() || '0'}
              </div>
              
              <div class="text-gray-600">期間:</div>
              <div>
                {selectedGrant.startDate ? new Date(selectedGrant.startDate).toLocaleDateString('ja-JP') : ''} 〜
                {selectedGrant.endDate ? new Date(selectedGrant.endDate).toLocaleDateString('ja-JP') : ''}
              </div>
            </div>
          </div>
        {:else}
          <div class="p-4 text-center text-gray-500 text-xs">
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
      <div class="flex items-center gap-2">
        <button 
          class="btn btn-sm btn-ghost"
          on:click={() => showLeftPane = !showLeftPane}
        >
          ☰
        </button>
        
        <input
          type="text"
          placeholder="検索..."
          class="input input-sm input-bordered w-48"
          bind:value={searchQuery}
        />
        
        <select class="select select-sm select-bordered" bind:value={filterStatus}>
          <option value="all">すべて</option>
          <option value="allocated">完全割当済</option>
          <option value="partial">一部割当済</option>
          <option value="unallocated">未割当</option>
        </select>
        
        <div class="flex-1"></div>
        
        {#if checkedTransactions.size > 0}
          <div class="text-sm">
            選択: {checkedTransactions.size}件 / ¥{checkedTotal.toLocaleString()}
          </div>
        {/if}
        
        <div class="text-sm text-gray-600">
          表示: {filteredData.length}件 / ¥{filteredTotal.toLocaleString()}
        </div>
        
        {#if selectedBudgetItem && checkedTransactions.size > 0}
          <button class="btn btn-sm btn-primary">
            一括割当
          </button>
        {/if}
      </div>
    </div>
    
    <!-- データグリッド表示エリア -->
    <div class="flex-1 overflow-auto bg-white">
      <!-- 一時的なテーブル表示（次のステップでTabulatorに置き換え） -->
      <table class="table table-compact w-full">
        <thead class="sticky top-0 bg-gray-100">
          <tr>
            <th class="w-8">
              <input type="checkbox" class="checkbox checkbox-xs" />
            </th>
            <th>日付</th>
            <th>仕訳番号</th>
            <th>摘要</th>
            <th>金額</th>
            <th>割当済</th>
            <th>未割当</th>
            <th>取引先</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredData as row}
            <tr 
              class="hover cursor-pointer"
              class:bg-blue-50={selectedTransaction?.id === row.id}
              on:click={() => {
                selectedTransaction = row;
                showRightPane = true;
              }}
            >
              <td>
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
              <td class="text-xs">{row.date}</td>
              <td class="text-xs">{row.journalNumber}</td>
              <td class="text-xs">{row.description}</td>
              <td class="text-xs text-right">¥{row.amount.toLocaleString()}</td>
              <td class="text-xs text-right">¥{row.allocatedAmount.toLocaleString()}</td>
              <td class="text-xs text-right">¥{row.unallocatedAmount.toLocaleString()}</td>
              <td class="text-xs">{row.supplier}</td>
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
              <span class="text-gray-600">摘要:</span>
              <span class="ml-2">{selectedTransaction.description}</span>
            </div>
            <div>
              <span class="text-gray-600">金額:</span>
              <span class="ml-2">¥{selectedTransaction.amount.toLocaleString()}</span>
            </div>
            
            {#if selectedTransaction.allocations.length > 0}
              <div class="mt-4">
                <h4 class="font-semibold mb-2">割当情報</h4>
                {#each selectedTransaction.allocations as alloc}
                  <div class="p-2 bg-gray-50 rounded mb-1">
                    <div>{alloc.budgetItem.name}</div>
                    <div class="text-xs text-gray-600">{alloc.budgetItem.grant.name}</div>
                    <div class="font-semibold">¥{alloc.amount.toLocaleString()}</div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(body) {
    overflow: hidden;
  }
  
  .table-compact td, .table-compact th {
    padding: 0.25rem 0.5rem;
  }
</style>