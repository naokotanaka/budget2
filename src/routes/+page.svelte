<script>
  // import { Grid } from "wx-svelte-grid";
  import DebugInfo from '$lib/components/DebugInfo.svelte';
  
  export let data;
  
  $: ({ grants, recentTransactions, stats } = data);

  // 最近の取引を表示用にフォーマット
  $: formattedTransactions = recentTransactions.map(tx => ({
    id: tx.id,
    date: new Date(tx.date).toLocaleDateString('ja-JP'),
    description: tx.description || '',
    account: tx.account || '',
    amount: tx.amount,
    allocations: tx.allocations.length > 0 
      ? tx.allocations.map(a => `${a.budgetItem.grant.name} - ${a.budgetItem.name}`).join(', ')
      : '未割当'
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
      flexgrow: 1, 
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
      id: "allocations", 
      header: "割当状況", 
      width: 200, 
      sort: true
    }
  ];
</script>

<div class="space-y-6">
  <!-- ダッシュボードヘッダー -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900">
      ダッシュボード
    </h2>
    <p class="mt-2 text-sm text-gray-600">
      予算管理の概要と最近の活動を確認できます
    </p>
  </div>

  <!-- 統計カード -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">取</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">
                総取引件数
              </dt>
              <dd class="text-lg font-medium text-gray-900">
                {stats.totalTransactions}件
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
            <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">割</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">
                分割割当件数
              </dt>
              <dd class="text-lg font-medium text-gray-900">
                {stats.totalAllocations}件
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
            <div class="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">未</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">
                未割当取引
              </dt>
              <dd class="text-lg font-medium text-gray-900">
                {stats.unallocatedTransactions}件
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 助成金一覧 -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
        助成金一覧
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each grants as grant}
          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex justify-between items-start mb-2">
              <h4 class="text-md font-medium text-gray-900">{grant.name}</h4>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                {grant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                {grant.status === 'active' ? '進行中' : grant.status}
              </span>
            </div>
            {#if grant.grantCode}
              <p class="text-sm text-gray-600 mb-2">コード: {grant.grantCode}</p>
            {/if}
            {#if grant.totalAmount}
              <p class="text-sm text-gray-600 mb-2">
                総額: ¥{grant.totalAmount.toLocaleString()}
              </p>
            {/if}
            <p class="text-sm text-gray-600 mb-3">
              予算項目: {grant.budgetItems.length}件
            </p>
            <div class="space-y-1">
              {#each grant.budgetItems.slice(0, 3) as item}
                <div class="text-xs text-gray-500 flex justify-between">
                  <span>{item.name}</span>
                  <span>{item._count.allocations}件割当</span>
                </div>
              {/each}
              {#if grant.budgetItems.length > 3}
                <div class="text-xs text-gray-400">
                  他 {grant.budgetItems.length - 3}件...
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- 最近の取引 -->
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
      <h3 class="text-lg leading-6 font-medium text-gray-900">
        最近の取引
      </h3>
      <p class="mt-1 max-w-2xl text-sm text-gray-500">
        最新の10件を表示しています
      </p>
    </div>
    
    <div class="p-4">
      <div style="height: 400px;">
        <!-- <Grid data={formattedTransactions} {columns} /> -->
      </div>
    </div>
  </div>
</div>

<!-- デバッグ情報コンポーネント -->
<DebugInfo />