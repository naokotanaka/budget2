<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { isActivePath, createRouteUrl, ROUTES } from '$lib/utils/routing';
  
  // 現在のページに基づいてアクティブなリンクを強調表示
  function isActive(path: string) {
    return isActivePath($page.url.pathname, path);
  }
</script>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-semibold text-gray-900">
            nagaiku 予算管理 v2
          </h1>
        </div>
        
        <div class="flex items-center space-x-4">
          <a 
            href={createRouteUrl.dashboard()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.DASHBOARD) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            ダッシュボード
          </a>
          <a 
            href={createRouteUrl.transactions()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.TRANSACTIONS) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            取引一覧
          </a>
          <a 
            href={createRouteUrl.budgetItems()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.BUDGET_ITEMS) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            予算項目
          </a>
          <a 
            href={createRouteUrl.allocations()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.ALLOCATIONS) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            分割割当
          </a>
          <a 
            href={createRouteUrl.grants()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.GRANTS) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            助成金管理
          </a>
          <a 
            href={createRouteUrl.freeeData()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.FREEE_DATA) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            freee連携
          </a>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <slot />
  </main>
  
</div>