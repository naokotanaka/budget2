<script>
  // import { Grid } from "wx-svelte-grid";
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
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span class="text-primary-content text-sm font-medium">取</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <div class="stat-title text-sm">総取引件数</div>
            <div class="stat-value text-lg">{stats.totalTransactions}件</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-success rounded-full flex items-center justify-center">
              <span class="text-success-content text-sm font-medium">割</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <div class="stat-title text-sm">分割割当件数</div>
            <div class="stat-value text-lg">{stats.totalAllocations}件</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-warning rounded-full flex items-center justify-center">
              <span class="text-warning-content text-sm font-medium">未</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <div class="stat-title text-sm">未割当取引</div>
            <div class="stat-value text-lg">{stats.unallocatedTransactions}件</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 助成金一覧 -->
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h3 class="card-title text-lg mb-4">
        助成金一覧
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each grants as grant}
          <div class="card border border-base-300 bg-base-50">
            <div class="card-body">
              <div class="flex justify-between items-start mb-2">
                <h4 class="card-title text-md">{grant.name}</h4>
                <div class="badge {grant.status === 'active' ? 'badge-success' : 'badge-neutral'}">
                  {grant.status === 'active' ? '進行中' : grant.status}
                </div>
              </div>
              {#if grant.grantCode}
                <p class="text-sm text-base-content/70 mb-2">コード: {grant.grantCode}</p>
              {/if}
              {#if grant.totalAmount}
                <p class="text-sm text-base-content/70 mb-2">
                  総額: ¥{grant.totalAmount.toLocaleString()}
                </p>
              {/if}
              <p class="text-sm text-base-content/70 mb-3">
                予算項目: {grant.budgetItems.length}件
              </p>
              <div class="space-y-1">
                {#each grant.budgetItems.slice(0, 3) as item}
                  <div class="text-xs text-base-content/60 flex justify-between">
                    <span>{item.name}</span>
                    <span>{item._count.allocations}件割当</span>
                  </div>
                {/each}
                {#if grant.budgetItems.length > 3}
                  <div class="text-xs text-base-content/50">
                    他 {grant.budgetItems.length - 3}件...
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- 最近の取引 -->
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h3 class="card-title text-lg">
        最近の取引
      </h3>
      <p class="text-sm text-base-content/70 mb-4">
        最新の10件を表示しています
      </p>
      
      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>日付</th>
              <th>摘要</th>
              <th>勘定科目</th>
              <th class="text-right">金額</th>
              <th>割当状況</th>
            </tr>
          </thead>
          <tbody>
            {#each formattedTransactions as tx}
              <tr>
                <td>{tx.date}</td>
                <td>{tx.description}</td>
                <td>{tx.account}</td>
                <td class="text-right">¥{tx.amount.toLocaleString()}</td>
                <td>
                  <span class="badge {tx.allocations === '未割当' ? 'badge-warning' : 'badge-success'}">
                    {tx.allocations}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- デバッグ情報コンポーネント -->
