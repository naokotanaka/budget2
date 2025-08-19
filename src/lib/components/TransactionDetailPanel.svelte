<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { base } from '$app/paths';

  export let transaction;
  export let budgetItems = [];

  const dispatch = createEventDispatcher();

  let allocations = [];
  let selectedBudgetItem = '';
  let allocatedAmount = 0;
  let saving = false;
  let selectedCategory = '';
  let receipts = [];
  let loadingReceipts = false;
  let freeeConnectionStatus = null;

  // 初期データの読み込み
  onMount(async () => {
    await loadData();
    await loadFreeeStatus();
  });

  // 取引が変更されたときの処理
  $: if (transaction) {
    selectedBudgetItem = transaction.budget_item || '';
    allocatedAmount = transaction.allocated_amount_edit || transaction.amount || 0;
    loadReceipts();
  }

  async function loadData() {
    try {
      // 割当データを取得
      const response = await fetch(`${base}/api/allocations`);
      if (response.ok) {
        const data = await response.json();
        allocations = data.allocations || [];
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
    }
  }

  async function loadFreeeStatus() {
    try {
      const response = await fetch(`${base}/api/freee/status`);
      if (response.ok) {
        const status = await response.json();
        freeeConnectionStatus = status;
      }
    } catch (error: any) {
      console.error('Failed to load freee status:', error);
      freeeConnectionStatus = { connected: false, message: 'Freee接続状態の取得に失敗しました' };
    }
  }

  // レシート情報を取得
  async function loadReceipts() {
    if (transaction?.freeDealId) {
      loadingReceipts = true;
      try {
        console.log('Loading receipts for deal ID:', transaction.freeDealId);
        const response = await fetch(`${base}/api/freee/deals/${transaction.freeDealId}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Deal detail received:', data);
          
          if (data.success && data.deal && data.deal.receipts && data.deal.receipts.length > 0) {
            receipts = data.deal.receipts;
            console.log('Receipts found:', receipts);
          } else {
            console.log('No receipts found for this deal');
            receipts = [];
          }
        } else {
          console.log('Failed to fetch deal detail');
          receipts = [];
        }
      } catch (error: any) {
        console.error('ファイルボックス情報の取得に失敗しました:', error);
        receipts = [];
      } finally {
        loadingReceipts = false;
      }
    }
  }

  // 残額の色を決定する関数
  function getRemainingAmountColor(remaining, endDate) {
    if (remaining <= 0) return 'text-gray-900';
    if (!endDate) return 'text-green-600 font-bold';
    
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-gray-400';
    if (diffDays <= 30) return 'text-red-600 font-bold';
    if (diffDays <= 60) return 'text-blue-600 font-bold';
    return 'text-green-600 font-bold';
  }

  // 予算項目の残額情報を計算
  function getCurrentBudgetItemInfo() {
    if (!selectedBudgetItem || selectedBudgetItem === '未割当') return null;
    
    const budgetItem = budgetItems.find(item => 
      (item.display_name || `${item.grant_name || '不明'}-${item.name}`) === selectedBudgetItem
    );
    
    if (!budgetItem) return null;
    
    // 予算項目の残額を計算
    const budgetItemAllocations = allocations.filter(a => a.budget_item_id === budgetItem.id);
    const allocatedAmount = budgetItemAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);
    const budgetItemRemaining = budgetItem.budgeted_amount - allocatedAmount;
    
    return {
      budgetItem,
      budgetItemRemaining
    };
  }

  // 割当を保存
  async function saveAllocation() {
    if (!selectedBudgetItem) {
      alert('予算項目を選択してください');
      return;
    }

    saving = true;
    try {
      const budgetItem = budgetItems.find(item => 
        (item.display_name || `${item.grant_name || '不明'}-${item.name}`) === selectedBudgetItem
      );

      if (!budgetItem) {
        alert('予算項目が見つかりません');
        return;
      }

      // 既存の割当を確認
      const existingAllocation = allocations.find(a => a.transaction_id === transaction.id);

      let result;
      if (existingAllocation) {
        // 更新
        const response = await fetch(`${base}/api/allocations/${existingAllocation.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            budget_item_id: budgetItem.id,
            amount: allocatedAmount
          })
        });
        result = await response.json();
      } else {
        // 新規作成
        const response = await fetch(`${base}/api/allocations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id: transaction.id,
            budget_item_id: budgetItem.id,
            amount: allocatedAmount
          })
        });
        result = await response.json();
      }

      // 割当データを更新
      await loadData();

      // 更新された取引データを親に通知
      dispatch('update', {
        ...transaction,
        budget_item: selectedBudgetItem,
        allocated_amount_edit: allocatedAmount
      });
    } catch (error: any) {
      console.error('Failed to save allocation:', error);
      alert('割当の保存に失敗しました');
    } finally {
      saving = false;
    }
  }

  // 割当を削除
  async function removeAllocation() {
    if (!confirm('この取引の割当を削除しますか？')) return;

    saving = true;
    try {
      const existingAllocation = allocations.find(a => a.transaction_id === transaction.id);

      if (existingAllocation) {
        const response = await fetch(`${base}/api/allocations/${existingAllocation.id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          await loadData();
          
          dispatch('update', {
            ...transaction,
            budget_item: '',
            allocated_amount_edit: 0
          });

          selectedBudgetItem = '';
          allocatedAmount = 0;
        }
      }
    } catch (error: any) {
      console.error('Failed to remove allocation:', error);
      alert('割当の削除に失敗しました');
    } finally {
      saving = false;
    }
  }

  function copyTransactionAmount() {
    selectedBudgetItem = transaction.budget_item || '';
    allocatedAmount = transaction.amount || 0;
  }

  function openFreeeTransaction() {
    if (transaction.journalNumber) {
      window.open(`https://secure.freee.co.jp/deals/standards?txn_number=${transaction.journalNumber}`, '_blank');
    }
  }

  function openFreeeReceipt(receiptId) {
    window.open(`https://secure.freee.co.jp/receipts/${receiptId}`, '_blank');
  }

  function openReceiptImage(imageSrc) {
    window.open(imageSrc, '_blank');
  }
</script>

<div class="w-1/4 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-lg font-semibold text-gray-900">取引詳細</h2>
    <button
      on:click={() => dispatch('close')}
      class="text-gray-400 hover:text-gray-600"
    >
      ✕
    </button>
  </div>

  <!-- 予算割当編集 -->
  <div class="bg-white p-4 rounded-lg shadow-sm mb-4">
    <h3 class="text-sm font-medium text-gray-700 mb-3">予算割当</h3>
    
    <div class="space-y-3">
      <div>
        <label class="block text-sm text-gray-600 mb-1">カテゴリ</label>
        <select
          bind:value={selectedCategory}
          class="w-full p-2 border border-gray-300 rounded text-sm"
          disabled={saving}
        >
          <option value="">全てのカテゴリ</option>
          {#each Array.from(new Set(budgetItems.filter(item => item.category).map(item => item.category))).sort() as category}
            <option value={category}>{category}</option>
          {/each}
        </select>
      </div>
      
      <div>
        <label class="block text-sm text-gray-600 mb-1">予算項目</label>
        <select
          bind:value={selectedBudgetItem}
          class="w-full p-2 border border-gray-300 rounded text-sm font-mono text-gray-800"
          disabled={saving}
        >
          <option value="">未割当</option>
          {#each budgetItems.filter(item => !selectedCategory || item.category === selectedCategory) as item}
            {@const itemAllocations = allocations.filter(a => a.budget_item_id === item.id)}
            {@const allocatedAmount = itemAllocations.reduce((sum, a) => sum + (a.amount || 0), 0)}
            {@const remaining = item.budgeted_amount - allocatedAmount}
            {@const displayName = item.display_name || `${item.grant_name || '不明'}-${item.name}`}
            {@const remainingText = `¥${remaining.toLocaleString()}`}
            <option 
              value={displayName}
              style="color: {remaining <= 0 ? '#9ca3af' : '#059669'}; font-weight: bold;"
            >
              {displayName} ({remainingText})
            </option>
          {/each}
        </select>
      </div>
      
      <div>
        <label class="block text-sm text-gray-600 mb-1">割当金額</label>
        <input
          type="number"
          bind:value={allocatedAmount}
          class="w-full p-2 border border-gray-300 rounded text-sm font-mono text-right"
          disabled={saving}
        />
      </div>

      {#if getCurrentBudgetItemInfo()}
        {@const info = getCurrentBudgetItemInfo()}
        <div class="bg-blue-50 p-3 rounded border space-y-2">
          <h4 class="text-sm font-medium text-blue-700">残額情報</h4>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">予算項目残額:</span>
              <span class="font-mono {getRemainingAmountColor(info.budgetItemRemaining, info.budgetItem?.grant?.end_date)}">
                ¥{info.budgetItemRemaining.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      {/if}
      
      <div class="flex gap-2">
        <button
          on:click={saveAllocation}
          disabled={saving || !selectedBudgetItem}
          class="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          on:click={removeAllocation}
          disabled={saving}
          class="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
        >
          削除
        </button>
      </div>
      
      <button
        on:click={copyTransactionAmount}
        class="w-full px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
      >
        取引金額をコピー
      </button>
    </div>
  </div>
  
  <!-- 取引詳細情報 -->
  <div class="bg-white p-4 rounded-lg shadow-sm space-y-3">
    <div class="space-y-2 text-sm">
      <div class="flex justify-between items-center">
        <span class="text-gray-600">仕訳番号:</span>
        <div class="flex items-center space-x-2">
          <span class="font-mono">{transaction.journalNumber}</span>
          {#if transaction.freeDealId}
            <button
              on:click={openFreeeTransaction}
              class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              title="Freeeの取引を開く"
            >
              開く
            </button>
          {/if}
        </div>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">行番号:</span>
        <span class="font-mono">{transaction.journalLineNumber}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">日付:</span>
        <span class="font-mono">{new Date(transaction.date).toLocaleDateString('ja-JP')}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">金額:</span>
        <span class="font-mono font-bold">¥{transaction.amount?.toLocaleString()}</span>
      </div>
      
      <hr class="my-3" />
      
      <div>
        <span class="text-gray-600">摘要:</span>
        <p class="mt-1 text-gray-900">{transaction.description || ''}</p>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">勘定科目:</span>
        <span>{transaction.account || ''}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">取引先:</span>
        <span>{transaction.supplier || ''}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">部門:</span>
        <span>{transaction.department || ''}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">品目:</span>
        <span>{transaction.item || ''}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">管理番号:</span>
        <span>{transaction.managementNumber || ''}</span>
      </div>
      
      {#if transaction.memo || transaction.remark || transaction.detailDescription || transaction.tags}
        <hr class="my-3" />
        {#if transaction.memo}
          <div>
            <span class="text-gray-600">メモ:</span>
            <p class="mt-1 text-gray-900">{transaction.memo}</p>
          </div>
        {/if}
        {#if transaction.remark}
          <div>
            <span class="text-gray-600">備考:</span>
            <p class="mt-1 text-gray-900">{transaction.remark}</p>
          </div>
        {/if}
        {#if transaction.detailDescription}
          <div>
            <span class="text-gray-600">明細備考:</span>
            <p class="mt-1 text-gray-900">{transaction.detailDescription}</p>
          </div>
        {/if}
        {#if transaction.tags}
          <div>
            <span class="text-gray-600">メモタグ:</span>
            <p class="mt-1 text-gray-900">{transaction.tags}</p>
          </div>
        {/if}
      {/if}
      
      <!-- ファイルボックス情報 -->
      <hr class="my-3" />
      <div>
        <span class="text-gray-600">添付ファイル:</span>
        {#if !freeeConnectionStatus?.connected}
          <!-- Freeeシステム未接続の場合 -->
          <div class="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p class="text-sm text-gray-600 mb-3">
              Freeeとの接続ができていないため、添付ファイルを表示できません。
            </p>
            <p class="text-xs text-gray-500 mb-3">
              {freeeConnectionStatus?.message || '接続状態を確認中...'}
            </p>
            <button
              on:click={() => window.open(`${base}/freee`, '_blank')}
              class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Freee接続ページを開く
            </button>
          </div>
        {:else if transaction.freeDealId}
          <!-- Freee連携済みの場合 -->
          {#if loadingReceipts}
            <p class="mt-1 text-gray-500">読み込み中...</p>
          {:else if receipts.length > 0}
            <div class="mt-2 space-y-4">
              {#each receipts as receipt, index}
                <div class="bg-gray-50 rounded-lg p-3">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex-1">
                      <p class="text-sm font-medium">
                        {receipt.receipt_metadatum?.partner_name || receipt.description || `${receipt.mime_type?.split('/')[1] || 'ファイル'}`}
                      </p>
                      <p class="text-xs text-gray-500">
                        {receipt.receipt_metadatum?.issue_date || new Date(receipt.created_at).toLocaleDateString('ja-JP')}
                        {#if receipt.receipt_metadatum?.amount}
                          - ¥{receipt.receipt_metadatum.amount.toLocaleString()}
                        {/if}
                      </p>
                    </div>
                    <div class="flex space-x-2">
                      <span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {receipt.mime_type?.split('/')[1] || 'file'}
                      </span>
                      <button
                        on:click={() => openFreeeReceipt(receipt.id)}
                        class="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                        title="Freeeでファイルを表示"
                      >
                        表示
                      </button>
                    </div>
                  </div>
                  
                  <!-- 画像の場合は直接表示 -->
                  {#if receipt.mime_type?.startsWith('image/') && receipt.file_src}
                    <div class="mt-2">
                      <img 
                        src={receipt.file_src}
                        alt="{receipt.receipt_metadatum?.partner_name || 'Receipt'} - {receipt.receipt_metadatum?.issue_date || ''}"
                        class="max-w-full h-auto max-h-96 rounded border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        on:click={() => openReceiptImage(receipt.file_src)}
                        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openReceiptImage(receipt.file_src)}
                        role="button"
                        tabindex="0"
                        on:error={(e) => {
                          console.error('Image failed to load:', receipt.file_src);
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="mt-1 text-gray-500">添付ファイルはありません</p>
          {/if}
        {:else}
          <!-- 取引がFreee未連携の場合 -->
          <p class="mt-1 text-gray-500">この取引はFreeeと連携されていません</p>
        {/if}
      </div>
    </div>
  </div>
</div>