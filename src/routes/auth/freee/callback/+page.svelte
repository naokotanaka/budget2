<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  
  export let data;
  
  $: ({ success, error, companies, tokenExpiresAt } = data);
  
  // 成功時は3秒後にダッシュボードにリダイレクト
  onMount(() => {
    if (success) {
      setTimeout(() => {
        window.location.href = `/budget2/`;
      }, 3000);
    }
  });
</script>

<div class="max-w-2xl mx-auto">
  <div class="bg-white shadow-sm rounded-lg p-6">
    <div class="text-center">
      {#if success}
        <div class="mb-6">
          <svg class="mx-auto h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h1 class="text-2xl font-bold text-gray-900 mb-4">
          freee連携が完了しました！
        </h1>
        
        <div class="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
          <div class="text-sm text-green-700">
            <p class="font-medium mb-2">認証に成功しました</p>
            <div class="space-y-1 text-left">
              <p><strong>アクセス可能な会社数:</strong> {companies?.length || 0}社</p>
              {#if companies && companies.length > 0}
                <div>
                  <strong>会社一覧:</strong>
                  <ul class="list-disc list-inside ml-4 mt-1">
                    {#each companies as company}
                      <li>{company.display_name} ({company.role})</li>
                    {/each}
                  </ul>
                </div>
              {/if}
              {#if tokenExpiresAt}
                <p><strong>トークン有効期限:</strong> {new Date(tokenExpiresAt).toLocaleString('ja-JP')}</p>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="space-y-4">
          <p class="text-gray-600">
            3秒後に自動的にダッシュボードに戻ります...
          </p>
          
          <div class="space-x-4">
            <a 
              href="/budget2/"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              ダッシュボードに戻る
            </a>
            
            <a 
              href="/budget2/transactions"
              class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              取引データを同期
            </a>
          </div>
        </div>
        
      {:else}
        <div class="mb-6">
          <svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h1 class="text-2xl font-bold text-gray-900 mb-4">
          認証に失敗しました
        </h1>
        
        <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div class="text-sm text-red-700">
            <p class="font-medium mb-2">エラーが発生しました</p>
            <p>{error}</p>
          </div>
        </div>
        
        <div class="space-x-4">
          <a 
            href="/budget2/auth/freee"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            再度認証する
          </a>
          
          <a 
            href="{base}/"
            class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            ダッシュボードに戻る
          </a>
        </div>
      {/if}
    </div>
  </div>
</div>