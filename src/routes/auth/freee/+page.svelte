<script>
  import { base } from '$app/paths';
  
  export let data;
  
  $: ({ authUrl, needsConfig, error } = data);
</script>

<div class="max-w-2xl mx-auto">
  <div class="bg-white shadow-sm rounded-lg p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">
        freee連携設定
      </h1>
      
      {#if needsConfig}
        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">
                設定が必要です
              </h3>
              <div class="mt-2 text-sm text-yellow-700">
                <p>{error}</p>
                <div class="mt-4">
                  <h4 class="font-medium">設定手順：</h4>
                  <ol class="list-decimal list-inside mt-2 space-y-1">
                    <li>freee developers (https://developer.freee.co.jp/) でアプリケーションを作成</li>
                    <li>Client IDとClient Secretを取得</li>
                    <li>リダイレクトURIに以下を設定：<br>
                        <code class="bg-gray-100 px-2 py-1 rounded text-xs">https://nagaiku.top/budget2/auth/freee/callback</code>
                    </li>
                    <li>.envファイルに設定を追加</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-50 rounded-md p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">
            .envファイルの設定例：
          </h4>
          <pre class="text-xs text-gray-600 text-left overflow-auto">
FREEE_CLIENT_ID=your_actual_client_id
FREEE_CLIENT_SECRET=your_actual_client_secret
FREEE_REDIRECT_URI=https://nagaiku.top/budget2/auth/freee/callback
FREEE_BASE_URL=https://api.freee.co.jp
          </pre>
        </div>
      {:else}
        <p class="text-gray-600 mb-6">
          freee会計システムと連携するために認証を行います。<br>
          以下のボタンをクリックしてfreeeにログインしてください。
        </p>
        
        <div class="space-y-4">
          <a 
            href={authUrl}
            class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            freeeで認証する
          </a>
          
          <div class="text-sm text-gray-500">
            freeeアカウントにログインして、このアプリケーションにデータアクセスの許可を与えてください。
          </div>
        </div>
      {/if}
      
      <div class="mt-8">
        <a href="/budget2/" class="text-blue-600 hover:text-blue-500 text-sm">
          ← ダッシュボードに戻る
        </a>
      </div>
    </div>
  </div>
</div>