<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { base } from '$app/paths';

  // 強制ナビゲーション（デバッグ用）
  function forceNavigateTo(path: string) {
    console.log(`🔄 Force navigating to: ${path}`);
    goto(path, { replaceState: false, keepFocus: false });
  }

  // 現在のページ情報をログ出力
  $: {
    console.log('📍 Current page:', {
      url: $page.url.href,
      pathname: $page.url.pathname,
      search: $page.url.search,
      params: $page.params,
      route: $page.route,
      base: base,
      pathnameWithoutBase: $page.url.pathname.replace(base, ''),
      isBaseMatch: $page.url.pathname.startsWith(base)
    });
  }
  
  // URL生成ヘルパー
  function createUrl(path: string) {
    return `${base}${path}`;
  }
</script>

<!-- デバッグ用ナビゲーションパネル -->
<div class="fixed bottom-4 right-4 bg-red-100 border border-red-300 rounded-lg p-4 shadow-lg z-50 max-w-sm">
  <h4 class="text-sm font-bold text-red-800 mb-2">🚨 Debug Navigation</h4>
  <div class="space-y-2 text-xs">
    <div class="bg-white p-2 rounded border">
      <div><strong>Current:</strong> {$page.url.pathname}</div>
      <div><strong>Base:</strong> {base}</div>
      <div><strong>Without Base:</strong> {$page.url.pathname.replace(base, '') || '/'}</div>
      <div><strong>Route ID:</strong> {$page.route.id || 'unknown'}</div>
    </div>
    
    <div class="grid grid-cols-2 gap-1">
      <button 
        on:click={() => forceNavigateTo(createUrl('/'))}
        class="px-2 py-1 bg-blue-500 text-white rounded text-xs"
      >
        Dashboard
      </button>
      <button 
        on:click={() => forceNavigateTo(createUrl('/transactions'))}
        class="px-2 py-1 bg-green-500 text-white rounded text-xs"
      >
        Transactions
      </button>
      <button 
        on:click={() => forceNavigateTo(createUrl('/budget-items'))}
        class="px-2 py-1 bg-purple-500 text-white rounded text-xs"
      >
        Budget Items
      </button>
      <button 
        on:click={() => forceNavigateTo(createUrl('/allocations'))}
        class="px-2 py-1 bg-orange-500 text-white rounded text-xs"
      >
        Allocations
      </button>
      <button 
        on:click={() => forceNavigateTo(createUrl('/freee/data'))}
        class="px-2 py-1 bg-red-500 text-white rounded text-xs col-span-2"
      >
        freee Data
      </button>
    </div>
    
    <div class="flex space-x-1">
      <button 
        on:click={() => window.location.reload()}
        class="px-2 py-1 bg-gray-500 text-white rounded text-xs flex-1"
      >
        🔄 Reload
      </button>
      <button 
        on:click={() => window.open($page.url.href)}
        class="px-2 py-1 bg-gray-600 text-white rounded text-xs flex-1"
      >
        🔗 New Tab
      </button>
    </div>
  </div>
</div>