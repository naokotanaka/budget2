<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  // 強制ナビゲーション（デバッグ用）
  function forceNavigateTo(path: string) {
    console.log(`🔄 Force navigating to: ${path}`);
    goto(path, { replaceState: false, keepFocus: false });
  }

  // 現在のページ情報をログ出力
  $: {
    console.log('📍 Current page:', {
      url: $page.url,
      pathname: $page.url.pathname,
      search: $page.url.search,
      params: $page.params,
      route: $page.route
    });
  }
</script>

<!-- デバッグ用ナビゲーションパネル -->
<div class="fixed bottom-4 right-4 bg-red-100 border border-red-300 rounded-lg p-4 shadow-lg z-50">
  <h4 class="text-sm font-bold text-red-800 mb-2">🚨 Debug Navigation</h4>
  <div class="space-y-2 text-xs">
    <div>
      <strong>Current:</strong> {$page.url.pathname}
    </div>
    <div class="space-x-2">
      <button 
        on:click={() => forceNavigateTo('/budget2/')}
        class="px-2 py-1 bg-blue-500 text-white rounded text-xs"
      >
        Dashboard
      </button>
      <button 
        on:click={() => forceNavigateTo('/budget2/transactions')}
        class="px-2 py-1 bg-green-500 text-white rounded text-xs"
      >
        Transactions
      </button>
      <button 
        on:click={() => forceNavigateTo('/budget2/budget-items')}
        class="px-2 py-1 bg-purple-500 text-white rounded text-xs"
      >
        Budget Items
      </button>
      <button 
        on:click={() => forceNavigateTo('/budget2/allocations')}
        class="px-2 py-1 bg-orange-500 text-white rounded text-xs"
      >
        Allocations
      </button>
    </div>
    <div class="mt-2">
      <button 
        on:click={() => window.location.reload()}
        class="px-2 py-1 bg-gray-500 text-white rounded text-xs"
      >
        🔄 Reload
      </button>
    </div>
  </div>
</div>