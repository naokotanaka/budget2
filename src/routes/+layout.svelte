<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dev } from '$app/environment';
  import DebugNavigation from '$lib/components/DebugNavigation.svelte';
  
  // 現在のページに基づいてアクティブなリンクを強調表示
  function isActive(path: string) {
    return $page.url.pathname === `/budget2${path}`;
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
            href="/budget2/" 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive('/') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            ダッシュボード
          </a>
          <a 
            href="/budget2/transactions" 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive('/transactions') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            取引一覧
          </a>
          <a 
            href="/budget2/budget-items" 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive('/budget-items') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            予算項目
          </a>
          <a 
            href="/budget2/allocations" 
            class="px-3 py-2 rounded-md text-sm font-medium {isActive('/allocations') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'}"
            data-sveltekit-preload-data="hover"
          >
            分割割当
          </a>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <slot />
  </main>
  
  <!-- 開発環境でのみデバッグナビゲーションを表示 -->
  {#if dev}
    <DebugNavigation />
  {/if}
</div>