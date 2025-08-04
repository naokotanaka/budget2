<script lang="ts">
  export let data;
</script>

<div class="max-w-2xl mx-auto">
  <div class="bg-white shadow-sm rounded-lg p-6">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">freee連携状態</h1>
    
    <div class="space-y-4">
      {#if data.authenticated}
        <div class="bg-green-50 border border-green-200 rounded-md p-4">
          <div class="flex items-center">
            <svg class="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span class="text-green-800 font-medium">認証済み</span>
          </div>
          <p class="mt-2 text-sm text-green-700">{data.message}</p>
          
          {#if data.isExpired}
            <div class="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
              <p class="text-sm text-yellow-800">
                トークンの有効期限が切れています。再認証が必要です。
              </p>
              <a 
                href="/budget2/auth/freee" 
                class="mt-2 inline-block text-sm text-blue-600 hover:text-blue-500"
              >
                再認証する →
              </a>
            </div>
          {:else if data.expiresAt}
            <p class="mt-2 text-xs text-gray-500">
              有効期限: {new Date(data.expiresAt).toLocaleString('ja-JP')}
            </p>
          {/if}
        </div>
        
        <div class="mt-6 space-y-3">
          <a 
            href="/budget2/freee/sync"
            class="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            取引データを同期
          </a>
          
          <a 
            href="/budget2/transactions"
            class="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            取引一覧を見る
          </a>
        </div>
      {:else}
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex items-center">
            <svg class="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span class="text-red-800 font-medium">未認証</span>
          </div>
          <p class="mt-2 text-sm text-red-700">{data.message}</p>
          
          {#if data.error}
            <p class="mt-2 text-xs text-red-600">エラー: {data.error}</p>
          {/if}
          
          <a 
            href="/budget2/auth/freee" 
            class="mt-3 inline-block text-sm text-blue-600 hover:text-blue-500"
          >
            freee連携を設定する →
          </a>
        </div>
      {/if}
    </div>
    
    <div class="mt-8">
      <a href="/budget2/" class="text-blue-600 hover:text-blue-500 text-sm">
        ← ダッシュボードに戻る
      </a>
    </div>
  </div>
</div>