<script lang="ts">
  import { createRouteUrl } from '$lib/utils/routing';
  
  export let data;
  
  $: ({ tokenInfo, apiTests } = data || {});
  
  let testResults = {};
  let testing = false;
  
  async function runAPITests() {
    testing = true;
    testResults = {};
    
    const baseUrl = createRouteUrl.apiFreeeData().replace('/freee/data', '/freee/test');
    const endpoints = [
      { name: 'companies', url: `${baseUrl}/companies` },
      { name: 'deals', url: `${baseUrl}/deals` },
      { name: 'walletables', url: `${baseUrl}/walletables` }
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint.name} at ${endpoint.url}`);
        const response = await fetch(endpoint.url);
        const result = await response.json();
        testResults[endpoint.name] = {
          success: response.ok,
          status: response.status,
          data: result
        };
      } catch (error: any) {
        console.error(`Error testing ${endpoint.name}:`, error);
        testResults[endpoint.name] = {
          success: false,
          error: error.message
        };
      }
    }
    
    testing = false;
    testResults = { ...testResults }; // Trigger reactivity
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-gray-900">freee API診断</h2>
    <p class="mt-2 text-sm text-gray-600">
      freee APIの権限とデータ取得状況を診断します
    </p>
  </div>

  <!-- Token情報 -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
        認証トークン情報
      </h3>
      
      {#if tokenInfo}
        <dl class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-gray-500">スコープ（権限）</dt>
            <dd class="mt-1 text-sm text-gray-900">
              {#if tokenInfo.scope}
                <div class="space-y-1">
                  {#each tokenInfo.scope.split(' ') as scope}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                          {scope.includes('read') ? 'bg-green-100 text-green-800' : 
                           scope.includes('write') ? 'bg-blue-100 text-blue-800' : 
                           'bg-gray-100 text-gray-800'}">
                      {scope}
                    </span>
                  {/each}
                </div>
              {:else}
                <span class="text-red-600">スコープ情報なし</span>
              {/if}
            </dd>
          </div>
          
          <div>
            <dt class="text-sm font-medium text-gray-500">有効期限</dt>
            <dd class="mt-1 text-sm text-gray-900">
              {new Date(tokenInfo.expiresAt).toLocaleString('ja-JP')}
            </dd>
          </div>
          
          <div>
            <dt class="text-sm font-medium text-gray-500">トークンタイプ</dt>
            <dd class="mt-1 text-sm text-gray-900">{tokenInfo.tokenType}</dd>
          </div>
          
          <div>
            <dt class="text-sm font-medium text-gray-500">ステータス</dt>
            <dd class="mt-1 text-sm">
              {#if new Date() < new Date(tokenInfo.expiresAt)}
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  有効
                </span>
              {:else}
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  期限切れ
                </span>
              {/if}
            </dd>
          </div>
        </dl>
      {:else}
        <p class="text-red-600">トークン情報が取得できません</p>
      {/if}
    </div>
  </div>

  <!-- API権限テスト -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
        API権限テスト
      </h3>
      
      <button 
        on:click={runAPITests}
        disabled={testing}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {#if testing}
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          テスト中...
        {:else}
          APIテスト実行
        {/if}
      </button>
      
      {#if Object.keys(testResults).length > 0}
        <div class="mt-4 space-y-3">
          {#each Object.entries(testResults) as [endpoint, result]}
            <div class="border rounded-lg p-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium text-gray-900">{endpoint} API</h4>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                      {result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                  {result.success ? '成功' : '失敗'}
                </span>
              </div>
              
              {#if result.success}
                <p class="mt-1 text-xs text-gray-600">
                  ステータス: {result.status} | データ件数: {result.data?.count || 0}
                </p>
                {#if result.data?.sample}
                  <details class="mt-2">
                    <summary class="text-xs text-blue-600 cursor-pointer">サンプルデータを表示</summary>
                    <pre class="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">{JSON.stringify(result.data.sample, null, 2)}</pre>
                  </details>
                {/if}
                {#if result.data?.rawData}
                  <details class="mt-2">
                    <summary class="text-xs text-green-600 cursor-pointer">freee生データを表示（重要）</summary>
                    <div class="mt-1 space-y-2">
                      <div>
                        <p class="text-xs font-medium text-gray-700">利用可能フィールド:</p>
                        <div class="flex flex-wrap gap-1">
                          {#each result.data.allFields || [] as field}
                            <span class="text-xs bg-blue-100 text-blue-800 px-1 rounded">{field}</span>
                          {/each}
                        </div>
                      </div>
                      <div>
                        <p class="text-xs font-medium text-gray-700">完全なデータ構造:</p>
                        <pre class="text-xs bg-green-50 p-2 rounded overflow-x-auto max-h-64">{JSON.stringify(result.data.rawData, null, 2)}</pre>
                      </div>
                      {#if result.data.detailsSample}
                        <div>
                          <p class="text-xs font-medium text-gray-700">details[0] の構造:</p>
                          <pre class="text-xs bg-yellow-50 p-2 rounded overflow-x-auto">{JSON.stringify(result.data.detailsSample, null, 2)}</pre>
                        </div>
                      {/if}
                    </div>
                  </details>
                {/if}
              {:else}
                <div class="mt-1 space-y-1">
                  <p class="text-xs text-red-600">
                    エラー: {result.data?.error || result.error || `HTTP ${result.status}`}
                  </p>
                  {#if result.data?.originalError}
                    <p class="text-xs text-red-500">
                      詳細: {result.data.originalError}
                    </p>
                  {/if}
                  {#if result.data?.errorDetails}
                    <div class="text-xs text-orange-600">
                      <p>💡 {result.data.errorDetails.suggestion}</p>
                      {#if result.data.errorDetails.requiredScope}
                        <p>必要なスコープ: <code class="bg-gray-100 px-1 rounded">{result.data.errorDetails.requiredScope}</code></p>
                      {/if}
                    </div>
                  {/if}
                  {#if result.data?.debug}
                    <details class="mt-1">
                      <summary class="text-xs text-gray-500 cursor-pointer">デバッグ情報を表示</summary>
                      <pre class="mt-1 text-xs bg-red-50 p-2 rounded overflow-x-auto">{JSON.stringify(result.data.debug, null, 2)}</pre>
                    </details>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- 推奨設定 -->
  <div class="bg-yellow-50 border border-yellow-200 rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-yellow-800 mb-4">
        ⚠️ freee アプリ設定の確認事項
      </h3>
      
      <div class="text-sm text-yellow-700 space-y-2">
        <p><strong>必要な権限スコープ:</strong></p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li><code>read</code> - 基本的な読み取り権限</li>
          <li><code>deals:read</code> - 取引データの読み取り</li>
          <li><code>walletables:read</code> - 仕訳データの読み取り</li>
          <li><code>companies:read</code> - 会社情報の読み取り</li>
        </ul>
        
        <p class="mt-4"><strong>freee 開発者コンソールでの設定確認:</strong></p>
        <ol class="list-decimal list-inside ml-4 space-y-1">
          <li>freee 開発者コンソール にログイン</li>
          <li>アプリケーション設定 > OAuth 設定</li>
          <li>スコープに上記権限が含まれているか確認</li>
          <li>必要に応じて権限を追加して再認証</li>
        </ol>
      </div>
    </div>
  </div>
</div>