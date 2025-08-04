<script>
  import { Grid } from "wx-svelte-grid";
  
  export let data;
  
  $: ({ grants, budgetItems } = data);

  // 予算項目の表示用データ
  $: formattedBudgetItems = budgetItems.map(item => ({
    id: item.id,
    grantName: item.grant.name,
    grantCode: item.grant.grantCode || '',
    name: item.name,
    category: item.category || '',
    budgetedAmount: item.budgetedAmount || 0,
    totalAllocated: item.totalAllocated,
    remaining: (item.budgetedAmount || 0) - item.totalAllocated,
    allocationCount: item.allocationCount,
    activeMonths: item.activeMonths,
    note: item.note || '',
    status: item.grant.status,
    utilizationRate: item.budgetedAmount > 0 
      ? Math.round((item.totalAllocated / item.budgetedAmount) * 100)
      : 0
  }));

  // DataGrid用の列定義
  const columns = [
    { 
      id: "grantName", 
      header: "助成金", 
      width: 150, 
      sort: true 
    },
    { 
      id: "grantCode", 
      header: "コード", 
      width: 120, 
      sort: true 
    },
    { 
      id: "name", 
      header: "予算項目名", 
      width: 200, 
      sort: true
    },
    { 
      id: "category", 
      header: "カテゴリ", 
      width: 120, 
      sort: true 
    },
    { 
      id: "budgetedAmount", 
      header: "予算額", 
      width: 120, 
      sort: true,
      align: "right",
      template: (value) => value > 0 ? `¥${value.toLocaleString()}` : '-'
    },
    { 
      id: "totalAllocated", 
      header: "使用額", 
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
          return `<span class="text-green-600">¥${value.toLocaleString()}</span>`;
        } else if (value < 0) {
          return `<span class="text-red-600">¥${Math.abs(value).toLocaleString()}</span>`;
        } else {
          return `<span class="text-gray-500">¥0</span>`;
        }
      }
    },
    { 
      id: "utilizationRate", 
      header: "使用率", 
      width: 80, 
      sort: true,
      align: "center",
      template: (value) => {
        let colorClass = 'text-gray-500';
        if (value > 90) colorClass = 'text-red-600 font-medium';
        else if (value > 70) colorClass = 'text-orange-600 font-medium';
        else if (value > 0) colorClass = 'text-blue-600';
        return `<span class="${colorClass}">${value}%</span>`;
      }
    },
    { 
      id: "allocationCount", 
      header: "割当件数", 
      width: 90, 
      sort: true,
      align: "center"
    },
    { 
      id: "activeMonths", 
      header: "有効月数", 
      width: 90, 
      sort: true,
      align: "center"
    },
    { 
      id: "status", 
      header: "状態", 
      width: 80, 
      sort: true,
      template: (value) => {
        if (value === 'active') {
          return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">進行中</span>`;
        } else {
          return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">${value}</span>`;
        }
      }
    }
  ];

  // 統計情報を計算
  $: stats = {
    totalItems: budgetItems.length,
    totalBudget: budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0),
    totalAllocated: budgetItems.reduce((sum, item) => sum + item.totalAllocated, 0),
    activeGrants: grants.filter(g => g.status === 'active').length,
    overBudgetItems: budgetItems.filter(item => 
      item.budgetedAmount > 0 && item.totalAllocated > item.budgetedAmount
    ).length
  };

  $: overallUtilization = stats.totalBudget > 0 
    ? Math.round((stats.totalAllocated / stats.totalBudget) * 100)
    : 0;
</script>

<div class="space-y-6">
  <!-- ページヘッダー -->
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-2xl font-bold text-gray-900">
        予算項目管理
      </h2>
      <p class="mt-2 text-sm text-gray-600">
        助成金別の予算項目と使用状況を管理できます
      </p>
    </div>
    
    <div class="flex space-x-3">
      <button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
        予算項目追加
      </button>
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
              <span class="text-white text-sm font-medium">項</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">予算項目数</dt>
              <dd class="text-lg font-medium text-gray-900">{stats.totalItems}</dd>
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
              <span class="text-white text-sm font-medium">助</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">進行中助成金</dt>
              <dd class="text-lg font-medium text-gray-900">{stats.activeGrants}</dd>
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
              <span class="text-white text-sm font-medium">予</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">総予算額</dt>
              <dd class="text-sm font-medium text-gray-900">¥{stats.totalBudget.toLocaleString()}</dd>
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
              <span class="text-white text-sm font-medium">使</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">総使用額</dt>
              <dd class="text-sm font-medium text-gray-900">¥{stats.totalAllocated.toLocaleString()}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 {overallUtilization > 90 ? 'bg-red-500' : overallUtilization > 70 ? 'bg-orange-500' : 'bg-blue-500'} rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">率</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">全体使用率</dt>
              <dd class="text-lg font-medium text-gray-900">{overallUtilization}%</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 助成金別サマリー -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
        助成金別サマリー
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each grants as grant}
          {@const grantBudget = grant.budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0)}
          {@const grantAllocated = grant.budgetItems.reduce((sum, item) => sum + item.allocations.reduce((subSum, a) => subSum + a.amount, 0), 0)}
          {@const grantUtilization = grantBudget > 0 ? Math.round((grantAllocated / grantBudget) * 100) : 0}
          
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
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">予算項目数:</span>
                <span class="font-medium">{grant.budgetItems.length}件</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">総予算額:</span>
                <span class="font-medium">¥{grantBudget.toLocaleString()}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">使用額:</span>
                <span class="font-medium">¥{grantAllocated.toLocaleString()}</span>
              </div>
              <div class="flex justify-between text-sm pt-2 border-t">
                <span class="text-gray-600">使用率:</span>
                <span class="font-medium {grantUtilization > 90 ? 'text-red-600' : grantUtilization > 70 ? 'text-orange-600' : 'text-blue-600'}">
                  {grantUtilization}%
                </span>
              </div>
              <!-- 使用率バー -->
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="h-2 rounded-full {grantUtilization > 90 ? 'bg-red-500' : grantUtilization > 70 ? 'bg-orange-500' : 'bg-blue-500'}" 
                     style="width: {Math.min(grantUtilization, 100)}%"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- 予算項目一覧 -->
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
      <h3 class="text-lg leading-6 font-medium text-gray-900">
        予算項目詳細
      </h3>
      <p class="mt-1 max-w-2xl text-sm text-gray-500">
        全ての予算項目の詳細情報と使用状況
      </p>
    </div>
    
    <div class="p-4">
      <div style="height: 600px;">
        <Grid data={formattedBudgetItems} {columns} />
      </div>
    </div>
  </div>

  <!-- 予算超過アラート -->
  {#if stats.overBudgetItems > 0}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">
            予算超過アラート
          </h3>
          <p class="mt-2 text-sm text-red-700">
            {stats.overBudgetItems}件の予算項目で予算額を超過しています。予算の見直しが必要です。
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>