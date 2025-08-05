<script lang="ts">
  import { createRouteUrl } from '$lib/utils/routing';
  
  export let data;
  
  $: ({ isConnected, companies, lastSyncAt, connectionError } = data || {});
  
  // Phase 2 用の状態管理
  let startDate = getDefaultStartDate(); // 30日前
  let endDate = getDefaultEndDate();     // 今日
  let selectedCompanyId = (companies && companies[0]) ? companies[0].id : null;
  let transactions: any[] = [];
  let loading = false;
  let errorMessage = '';
  let successMessage = '';
  
  // デフォルト日付取得
  function getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30); // 30日前
    return date.toISOString().split('T')[0];
  }
  
  function getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0]; // 今日
  }
  
  // フォーマット関数
  function formatDate(date: string | null): string {
    if (!date) return '未実行';
    return new Date(date).toLocaleString('ja-JP');
  }
  
  function formatCurrency(amount: number): string {
    return '¥' + amount.toLocaleString();
  }
  
  // データ取得関数
  async function fetchData() {
    if (!isConnected) {
      errorMessage = 'freee接続が必要です。管理者にお問い合わせください。';
      return;
    }
    
    if (!startDate || !endDate) {
      errorMessage = '開始日と終了日を入力してください。';
      return;
    }
    
    loading = true;
    errorMessage = '';
    successMessage = '';
    
    try {
      const requestUrl = createRouteUrl.apiFreeeData();
      const requestBody = {
        startDate,
        endDate,
        companyId: selectedCompanyId
      };
      
      console.log('=== リクエスト詳細 ===');
      console.log('URL:', requestUrl);
      console.log('Body:', requestBody);
      console.log('Headers:', { 'Content-Type': 'application/json' });
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('=== レスポンス詳細 ===');
      console.log('Status:', response.status);
      console.log('StatusText:', response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      console.log('OK:', response.ok);
      
      // レスポンステキストを先に取得（デバッグ用）
      const responseText = await response.text();
      console.log('Response Text Length:', responseText.length);
      console.log('Response Text Preview:', responseText.substring(0, 200));
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed JSON:', result);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.log('Raw Response Text:', responseText);
        throw new Error(`JSON解析エラー: ${parseError.message}`);
      }
      
      if (!response.ok) {
        console.error('HTTP Error - Status:', response.status, 'Response:', result);
        throw new Error(`HTTP ${response.status}: ${result?.error || response.statusText}`);
      }
      
      if (result.success) {
        transactions = result.data;
        successMessage = result.message;
        console.log('=== 取得したデータ詳細 ===');
        console.log('件数:', transactions.length);
        console.log('最初のデータ:', transactions[0]);
        console.log('全データ:', transactions);
        
        // 各フィールドの値を確認
        if (transactions.length > 0) {
          const sample = transactions[0];
          console.log('=== サンプルデータのフィールド値 ===');
          Object.keys(sample).forEach(key => {
            console.log(`${key}:`, sample[key], `(type: ${typeof sample[key]})`);
          });
        }
      } else {
        errorMessage = result.error;
        if (result.needsSetup) {
          errorMessage += ' 管理者による設定が必要です。';
        }
      }
    } catch (error) {
      console.error('=== エラー詳細 ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      errorMessage = `データ取得中にエラーが発生しました: ${error.message}`;
    } finally {
      loading = false;
    }
  }
  
  // companies が更新されたときに selectedCompanyId を設定
  $: if (companies && companies.length > 0 && !selectedCompanyId) {
    selectedCompanyId = companies[0].id;
  }
</script>

<div class="space-y-6">
  <!-- ページヘッダー -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900">
      freee連携 - データ表示
    </h2>
    <p class="mt-2 text-sm text-gray-600">
      freeeから取引データを取得して表示します
    </p>
  </div>

  <!-- freee接続状態表示 -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
        freee接続状態
      </h3>
      
      <div class="flex items-center space-x-4">
        <!-- 接続状態アイコン -->
        <div class="flex-shrink-0">
          {#if isConnected}
            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          {:else}
            <div class="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
          {/if}
        </div>
        
        <!-- 接続状態テキスト -->
        <div class="flex-1">
          {#if isConnected}
            <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              freee接続済み ✓
            </div>
            <p class="mt-1 text-sm text-gray-600">
              最終更新: {formatDate(lastSyncAt)}
            </p>
          {:else}
            <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              freee未接続
            </div>
            <p class="mt-1 text-sm text-gray-600">
              管理者による設定が必要です
            </p>
          {/if}
          
          {#if connectionError}
            <p class="mt-1 text-sm text-red-600">
              ⚠️ {connectionError}
            </p>
          {/if}
        </div>
        
        <!-- 設定リンク（管理者向け） -->
        {#if !isConnected}
          <div class="flex-shrink-0">
            <a 
              href={createRouteUrl.freeeAuth()} 
              class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              管理者設定
            </a>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- データ取得フォーム（Phase 2実装） -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
        データ取得
      </h3>
      
      <!-- Phase 2で有効化 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label for="startDate" class="block text-sm font-medium text-gray-700">
            開始日
          </label>
          <input 
            type="date" 
            id="startDate"
            bind:value={startDate}
            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={!isConnected || loading}
          />
        </div>
        
        <div>
          <label for="endDate" class="block text-sm font-medium text-gray-700">
            終了日
          </label>
          <input 
            type="date" 
            id="endDate"
            bind:value={endDate}
            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={!isConnected || loading}
          />
        </div>
        
        <div>
          <label for="company" class="block text-sm font-medium text-gray-700">
            会社
          </label>
          <select 
            id="company"
            bind:value={selectedCompanyId}
            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={!isConnected || loading || !companies || companies.length === 0}
          >
            <option value="">会社を選択...</option>
            {#each companies || [] as company}
              <option value={company.id}>{company.name}</option>
            {/each}
          </select>
        </div>
      </div>
      
      <div class="mt-4">
        <button 
          type="button"
          on:click={fetchData}
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isConnected || loading || !startDate || !endDate}
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            取得中...
          {:else}
            データ取得
          {/if}
        </button>
      </div>
      
      <!-- メッセージ表示 -->
      {#if successMessage}
        <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-700">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      {/if}
      
      {#if errorMessage}
        <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      {/if}
      
      {#if !isConnected}
        <div class="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-orange-800">
                freee接続が必要です
              </h3>
              <p class="mt-1 text-sm text-orange-700">
                データを取得するには、まず管理者がfreeeとの接続設定を行ってください。
              </p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- データ表示エリア（Phase 2実装） -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
        取得結果
      </h3>
      
      {#if transactions.length > 0}
        <div class="mt-4">
          <p class="text-sm text-gray-600 mb-4">
            {transactions.length}件のデータを表示中
            <span class="text-xs text-gray-500 ml-2">
              ※ freee APIの制限により、一部の詳細情報が取得できない場合があります
            </span>
          </p>
          
          <!-- シンプルなHTMLテーブル（Phase 2版） -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    発生日
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    取引先
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    摘要
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    勘定科目
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    金額
                  </th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    freee ID
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each transactions as transaction}
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.issue_date ? new Date(transaction.issue_date).toLocaleDateString('ja-JP') : '日付なし'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {#if transaction.partner_name && transaction.partner_name !== '－'}
                        {transaction.partner_name}
                      {:else}
                        <span class="text-gray-400 italic">取引先情報なし</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                      <div class="max-w-xs truncate" title={transaction.description || '摘要情報なし'}>
                        {#if transaction.description && !transaction.description.includes('不明')}
                          {transaction.description}
                        {:else}
                          <span class="text-gray-400 italic">
                            {transaction.type === 'income' ? '収入' : '支出'} (ID: {transaction.id})
                          </span>
                        {/if}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {#if transaction.account_item_name && transaction.account_item_name !== '不明'}
                        {transaction.account_item_name}
                      {:else}
                        <span class="text-gray-400 italic">勘定科目情報なし</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {transaction.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        {transaction.amount ? formatCurrency(transaction.amount) : '¥0'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {transaction.id || 'ID不明'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {:else}
        <div class="text-center py-8 text-gray-500">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path>
          </svg>
          <p class="mt-2 text-sm">
            まだデータが取得されていません
          </p>
          <p class="text-xs text-gray-400">
            上のフォームからデータを取得してください
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>