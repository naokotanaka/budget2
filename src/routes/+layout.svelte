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
    <div class="w-full px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-semibold text-gray-900">
            nagaiku 予算管理 v2
          </h1>
        </div>
        
        <div class="flex items-center space-x-4">
          <a 
            href={createRouteUrl.transactionAllocations()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.TRANSACTION_ALLOCATIONS) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            取引割当一覧
          </a>
          <a 
            href={createRouteUrl.grants()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.GRANTS) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            助成金管理
          </a>
          <a 
            href={createRouteUrl.freee()} 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive(ROUTES.FREEE) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            freee連携
          </a>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="w-full py-3 px-2 sm:px-4 lg:px-6 xl:px-8">
    <slot />
  </main>
  
</div>