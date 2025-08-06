<script>
  // import { Grid } from "wx-svelte-grid";
  import { base } from '$app/paths';
  import DebugInfo from '$lib/components/DebugInfo.svelte';
  
  export let data;
  
  $: ({ transactions, budgetItems } = data);

  // 取引データを表示用にフォーマット
  $: formattedTransactions = transactions.map(tx => ({
    id: tx.id,
    date: new Date(tx.date).toLocaleDateString('ja-JP'),
    description: tx.description || '',
    account: tx.account || '',
    amount: tx.amount,
    supplier: tx.supplier || '',
    department: tx.department || '',
    allocations: tx.allocations.length > 0 
      ? tx.allocations.map(a => `${a.budgetItem.grant.name} - ${a.budgetItem.name} (¥${a.amount.toLocaleString()})`).join(', ')
      : '',
    allocationStatus: tx.allocations.length > 0 ? '割当済' : '未割当',
    totalAllocated: tx.allocations.reduce((sum, a) => sum + a.amount, 0),
    remaining: tx.amount - tx.allocations.reduce((sum, a) => sum + a.amount, 0)
  }));

  // DataGrid用の列定義
  const columns = [
    { 
      id: "date", 
      header: "日付", 
      width: 120, 
      sort: true 
    },
    { 
      id: "description", 
      header: "摘要", 
      width: 200, 
      sort: true
    },
    { 
      id: "account", 
      header: "勘定科目", 
      width: 120, 
      sort: true 
    },
    { 
      id: "amount", 
      header: "金額", 
      width: 120, 
      sort: true,
      align: "right",
      template: (value) => `¥${value.toLocaleString()}`
    },
    { 
      id: "supplier", 
      header: "取引先", 
      width: 150, 
      sort: true
    },
    { 
      id: "department", 
      header: "部門", 
      width: 100, 
      sort: true
    },
    { 
      id: "allocationStatus", 
      header: "割当状況", 
      width: 100, 
      sort: true,
      template: (value) => {
        if (value === '割当済') {
          return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">${value}</span>`;
        } else {
          return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">${value}</span>`;
        }
      }
    },
    { 
      id: "totalAllocated", 
      header: "割当合計", 
      width: 120, 
      sort: true,
      align: "right",
      template: (value) => value > 0 ? `¥${value.toLocaleString()}` : '-'
    },
    { 
      id: "remaining", 
      header: "残額", 
      width: 120, 
      sort: true,
      align: "right",
      template: (value) => {
        if (value > 0) {
          return `<span class="text-orange-600">¥${value.toLocaleString()}</span>`;
        } else if (value < 0) {
          return `<span class="text-red-600">¥${value.toLocaleString()}</span>`;
        } else {
          return `<span class="text-green-600">¥0</span>`;
        }
      }
    }
  ];

  // 統計情報を計算
  $: stats = {
    total: transactions.length,
    allocated: transactions.filter(tx => tx.allocations.length > 0).length,
    unallocated: transactions.filter(tx => tx.allocations.length === 0).length,
    totalAmount: transactions.reduce((sum, tx) => sum + tx.amount, 0),
    allocatedAmount: transactions.reduce((sum, tx) => 
      sum + tx.allocations.reduce((subSum, a) => subSum + a.amount, 0), 0
    )
  };

  // freee同期状態
  let syncing = false;
  let syncMessage = '';

  // freee同期実行
  async function syncFromFreee() {
    if (syncing) return;
    
    syncing = true;
    syncMessage = 'freeeから取引データを同期中...';
    
    try {
      // 過去3ヶ月のデータを同期
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      
      const response = await fetch(`/budget2/api/freee/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        })
      });

      const result = await response.json();
      
      if (result.success) {
        syncMessage = result.message;
        // ページをリロードしてデータを更新
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        syncMessage = `同期エラー: ${result.error}`;
        if (response.status === 401) {
          // 認証が必要な場合は認証ページにリダイレクト
          setTimeout(() => {
            window.location.href = `/budget2/auth/freee`;
          }, 3000);
        }
      }
    } catch (error) {
      syncMessage = `同期エラー: ${error.message}`;
      console.error('Sync error:', error);
    } finally {
      syncing = false;
      // 5秒後にメッセージをクリア
      setTimeout(() => {
        syncMessage = '';
      }, 5000);
    }
  }
</script>

<div class="space-y-6">
  <!-- ページヘッダー -->
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-2xl font-bold text-gray-900">
        取引一覧
      </h2>
      <p class="mt-2 text-sm text-gray-600">
        全ての取引と割当状況を確認できます
      </p>
    </div>
    
    <div class="flex space-x-3">
      <button 
        on:click={syncFromFreee}
        disabled={syncing}
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if syncing}
          <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          同期中...
        {:else}
          freeeから同期
        {/if}
      </button>
      <button class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
        CSVエクスポート
      </button>
    </div>
  </div>

  <!-- 同期メッセージ -->
  {#if syncMessage}
    <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          {#if syncing}
            <svg class="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else}
            <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
          {/if}
        </div>
        <div class="ml-3">
          <p class="text-sm text-blue-700">
            {syncMessage}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- 統計情報 -->
  <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">全</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">総件数</dt>
              <dd class="text-lg font-medium text-gray-900">{stats.total}</dd>
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
              <span class="text-white text-sm font-medium">済</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">割当済</dt>
              <dd class="text-lg font-medium text-gray-900">{stats.allocated}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">未</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">未割当</dt>
              <dd class="text-lg font-medium text-gray-900">{stats.unallocated}</dd>
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
              <span class="text-white text-sm font-medium">総</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">総金額</dt>
              <dd class="text-sm font-medium text-gray-900">¥{stats.totalAmount.toLocaleString()}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">割</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">割当額</dt>
              <dd class="text-sm font-medium text-gray-900">¥{stats.allocatedAmount.toLocaleString()}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 取引一覧テーブル -->
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
      <h3 class="text-lg leading-6 font-medium text-gray-900">
        取引データ
      </h3>
      <p class="mt-1 max-w-2xl text-sm text-gray-500">
        クリックして詳細確認・割当操作が可能です
      </p>
    </div>
    
    <div class="p-4">
      <div style="height: 600px;">
        <!-- <Grid data={formattedTransactions} {columns} /> -->
      </div>
    </div>
  </div>
</div>

<!-- デバッグ情報コンポーネント -->
<DebugInfo />