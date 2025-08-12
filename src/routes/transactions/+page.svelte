<script>
  import { onMount } from 'svelte';
  import { TabulatorFull as Tabulator } from 'tabulator-tables';
  import 'tabulator-tables/dist/css/tabulator.min.css';
  import { base } from '$app/paths';
  import TransactionDetailPanel from '$lib/components/TransactionDetailPanel.svelte';

  export let data;
  
  $: ({ transactions, budgetItems } = data);
  
  let tableElement;
  let table;
  let selectedTransaction = null;
  let showDetailPanel = false;
  let tableBuilt = false;

  // 取引データを表示用にフォーマット
  $: formattedTransactions = transactions.map(tx => ({
    id: tx.id,
    date: new Date(tx.date).toLocaleDateString('ja-JP'),
    description: tx.description || '',
    account: tx.account || '',
    amount: tx.amount,
    supplier: tx.supplier || '',
    department: tx.department || '',
    item: tx.item || '',
    memo: tx.memo || '',
    remark: tx.remark || '',
    detailDescription: tx.detailDescription || '',
    tags: tx.tags || '',
    managementNumber: tx.managementNumber || '',
    freeDealId: tx.freeDealId,
    receiptIds: tx.receiptIds || null,
    detailId: tx.detailId || null,
    journalNumber: tx.journalNumber || null,
    journalLineNumber: tx.journalLineNumber || null,
    allocations: tx.allocations.length > 0 
      ? tx.allocations.map(a => `${a.budgetItem.grant.name} - ${a.budgetItem.name} (¥${a.amount.toLocaleString()})`).join(', ')
      : '',
    allocationStatus: tx.allocations.length > 0 ? '割当済' : '未割当',
    totalAllocated: tx.allocations.reduce((sum, a) => sum + a.amount, 0),
    remaining: tx.amount - tx.allocations.reduce((sum, a) => sum + a.amount, 0)
  }));

  // Tabulator用の列定義（最終仕様に更新）
  const columns = [
    { 
      title: "発生日", 
      field: "date", 
      width: 100,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "金額", 
      field: "amount", 
      width: 100,
      sorter: "number",
      headerSort: true,
      hozAlign: "right",
      formatter: (cell) => `¥${cell.getValue().toLocaleString()}`
    },
    { 
      title: "取引内容", 
      field: "description", 
      width: 120,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "勘定科目", 
      field: "account", 
      width: 120,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "部門", 
      field: "department", 
      width: 80,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "取引先名", 
      field: "supplier", 
      width: 120,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "備考", 
      field: "detailDescription", 
      width: 120,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "メモタグ", 
      field: "tags", 
      width: 100,
      sorter: "string",
      headerSort: true,
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? `<span class="text-blue-600">${value}</span>` : '';
      }
    },
    { 
      title: "品目", 
      field: "item", 
      width: 100,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "メモ", 
      field: "memo", 
      width: 120,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "管理番号", 
      field: "managementNumber", 
      width: 100,
      sorter: "string",
      headerSort: true
    },
    { 
      title: "割当状況", 
      field: "allocationStatus", 
      width: 80,
      sorter: "string",
      headerSort: true,
      formatter: (cell) => {
        const value = cell.getValue();
        if (value === '割当済') {
          return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">${value}</span>`;
        } else {
          return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">${value}</span>`;
        }
      }
    },
    { 
      title: "ファイル", 
      field: "receiptIds", 
      width: 60,
      sorter: false,
      headerSort: false,
      formatter: (cell) => {
        const rowData = cell.getRow().getData();
        const receiptIds = rowData.receiptIds;
        if (receiptIds) {
          try {
            const ids = JSON.parse(receiptIds);
            return ids && ids.length > 0 ? 
              `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">📎${ids.length}</span>` : 
              '';
          } catch (e) {
            return '';
          }
        }
        return '';
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

  // 取引詳細パネルを開く
  function openTransactionDetail(transaction) {
    // 元の取引データを取得
    const originalTransaction = transactions.find(tx => tx.id === transaction.id);
    if (originalTransaction) {
      selectedTransaction = originalTransaction;
      showDetailPanel = true;
    }
  }

  // 取引詳細パネルを閉じる
  function closeTransactionDetail() {
    showDetailPanel = false;
    selectedTransaction = null;
  }

  // 取引データが更新されたとき
  function handleTransactionUpdate(event) {
    const updatedTransaction = event.detail;
    // データを再取得するか、ローカル更新
    console.log('Transaction updated:', updatedTransaction);
  }

  onMount(() => {
    if (tableElement) {
      table = new Tabulator(tableElement, {
        data: formattedTransactions,
        columns: columns,
        layout: "fitColumns",
        height: "600px",
        pagination: "local",
        paginationSize: 20,
        paginationSizeSelector: [10, 20, 50, 100],
        movableColumns: true,
        resizableRows: false,
        resizableColumns: true,
        selectable: 1,
        langs: {
          "ja-jp": {
            "pagination": {
              "first": "最初",
              "first_title": "最初のページ",
              "last": "最後",
              "last_title": "最後のページ", 
              "prev": "前",
              "prev_title": "前のページ",
              "next": "次",
              "next_title": "次のページ",
              "counter": {
                "showing": "表示中",
                "of": "の",
                "rows": "行"
              }
            }
          }
        },
        locale: "ja-jp",
        // 行クリックイベントを追加
        rowClick: function(e, row) {
          const rowData = row.getData();
          openTransactionDetail(rowData);
        }
      });
      
      // テーブル初期化完了イベント
      table.on("tableBuilt", function(){
        tableBuilt = true;
        console.log("Table built successfully");
      });
    }
  });

  // データが更新されたときにテーブルを再描画（テーブル初期化完了後のみ）
  $: if (table && tableBuilt && formattedTransactions.length > 0) {
    table.setData(formattedTransactions);
  }
</script>

<style>
  /* Tabulatorのスタイルカスタマイズ */
  :global(.tabulator) {
    background: white;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  :global(.tabulator-header) {
    background: #f9fafb;
    border-radius: 0.5rem 0.5rem 0 0;
  }

  :global(.tabulator-col) {
    border-right: 1px solid #e5e7eb;
  }

  :global(.tabulator-col-title) {
    color: #374151;
    font-weight: 500;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  :global(.tabulator-row) {
    border-bottom: 1px solid #e5e7eb;
  }

  :global(.tabulator-row:hover) {
    background-color: #f9fafb;
  }

  :global(.tabulator-row .tabulator-cell) {
    border-right: 1px solid #e5e7eb;
    padding: 0.75rem 1rem;
  }

  :global(.tabulator-paginator) {
    color: #374151;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }

  :global(.tabulator-page.active) {
    background: #3b82f6;
    color: white;
  }
</style>

<div class="flex h-screen bg-gray-100">
  <!-- メインコンテンツ -->
  <div class="flex-1 {showDetailPanel ? 'w-3/4' : 'w-full'} transition-all duration-300">
    <div class="p-6 space-y-6">
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
      <a 
        href="/budget2/freee"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg class="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        freee連携へ
      </a>
      <button class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
        CSVエクスポート
      </button>
    </div>
  </div>



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
      {#if formattedTransactions.length > 0}
        <!-- Tabulatorデータグリッド -->
        <div bind:this={tableElement} class="w-full"></div>
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
  </div>

  <!-- 取引詳細パネル -->
  {#if showDetailPanel && selectedTransaction}
    <TransactionDetailPanel 
      transaction={selectedTransaction}
      budgetItems={budgetItems}
      on:close={closeTransactionDetail}
      on:update={handleTransactionUpdate}
    />
  {/if}
</div>