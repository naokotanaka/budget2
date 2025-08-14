<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let open = false;
  export let title = '削除確認';
  export let message = '';
  export let itemName = '';
  export let itemType = '';
  export let relatedDataWarning = '';
  export let loading = false;
  
  function handleCancel() {
    if (loading) return;
    dispatch('cancel');
  }
  
  function handleConfirm() {
    if (loading) return;
    dispatch('confirm');
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
      <div class="flex items-start space-x-3 mb-4">
        <!-- 警告アイコン -->
        <div class="flex-shrink-0">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <div class="flex-1">
          <h3 class="text-lg font-medium text-gray-900 mb-2">
            {title}
          </h3>
          
          <div class="text-sm text-gray-700 space-y-2">
            {#if message}
              <p>{message}</p>
            {/if}
            
            {#if itemName}
              <p class="font-medium">
                {itemType}「<span class="text-red-600">{itemName}</span>」を削除しますか？
              </p>
            {/if}
            
            {#if relatedDataWarning}
              <p class="text-orange-600 font-medium bg-orange-50 p-2 rounded">
                ⚠️ {relatedDataWarning}
              </p>
            {/if}
            
            <p class="text-red-600 font-medium">
              この操作は取り消すことができません。
            </p>
          </div>
        </div>
      </div>
      
      <div class="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
          on:click={handleCancel}
        >
          キャンセル
        </button>
        
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
          on:click={handleConfirm}
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {/if}
          削除する
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ダイアログのアニメーション */
  .fixed {
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>