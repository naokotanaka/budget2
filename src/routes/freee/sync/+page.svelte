<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';
  
  export let data;
  export let form: ActionData;
  
  // 日付のデフォルト値を設定
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };
  
  let startDate = formatDate(firstDay);
  let endDate = formatDate(lastDay);
  let isLoading = false;
</script>

<div class="max-w-2xl mx-auto">
  <div class="bg-white shadow-sm rounded-lg p-6">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">freee取引データ同期</h1>
    
    {#if !data.authenticated}
      <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div class="flex">
          <svg class="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div>
            <h3 class="text-sm font-medium text-yellow-800">{data.message}</h3>
            {#if data.isExpired}
              <a href="/budget2/auth/freee" class="mt-2 inline-block text-sm text-blue-600 hover:text-blue-500">
                再認証する →
              </a>
            {:else}
              <a href="/budget2/auth/freee" class="mt-2 inline-block text-sm text-blue-600 hover:text-blue-500">
                freee連携を設定する →
              </a>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <div class="bg-green-50 border border-green-200 rounded-md p-3 mb-6">
        <div class="flex items-center">
          <svg class="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          <div>
            <p class="text-sm font-medium text-green-800">同期対象会社</p>
            <p class="text-sm text-green-700">{data.companyName}</p>
          </div>
        </div>
      </div>

      {#if data.lastSyncAt}
        <div class="bg-blue-50 border border-blue-200 rounded-md p-3 mb-6">
          <p class="text-sm text-blue-800">
            最終同期: {new Date(data.lastSyncAt).toLocaleString('ja-JP')}
          </p>
        </div>
      {/if}
      
      <form method="POST" use:enhance={() => {
        isLoading = true;
        return ({ update }) => {
          isLoading = false;
          update();
        };
      }}>
        <div class="space-y-4">
          <div>
            <label for="startDate" class="block text-sm font-medium text-gray-700">
              開始日
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              bind:value={startDate}
              required
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label for="endDate" class="block text-sm font-medium text-gray-700">
              終了日
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              bind:value={endDate}
              required
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {#if isLoading}
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              同期中...
            {:else}
              取引データを同期
            {/if}
          </button>
        </div>
      </form>
      
      {#if form?.success}
        <div class="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
          <div class="flex">
            <svg class="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <h3 class="text-sm font-medium text-green-800">同期完了</h3>
              <p class="mt-1 text-sm text-green-700">{form.message}</p>
            </div>
          </div>
        </div>
      {/if}
      
      {#if form && !form.success}
        <div class="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex">
            <svg class="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div>
              <h3 class="text-sm font-medium text-red-800">エラー</h3>
              <p class="mt-1 text-sm text-red-700">{form.message}</p>
            </div>
          </div>
        </div>
      {/if}
    {/if}
    
    <div class="mt-8 space-y-2">
      <a href="/budget2/transactions" class="text-blue-600 hover:text-blue-500 text-sm block">
        → 取引一覧を見る
      </a>
      <a href="/budget2/" class="text-blue-600 hover:text-blue-500 text-sm block">
        ← ダッシュボードに戻る
      </a>
    </div>
  </div>
</div>