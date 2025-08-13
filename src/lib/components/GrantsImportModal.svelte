<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let showImportModal = false;
  export let importType: 'grants' | 'budgetItems' = 'grants';
  export let importFile: File | null = null;
  export let importPreview: any[] = [];
  export let importError = '';
  export let importProgress = 0;
  export let isImporting = false;
  
  const dispatch = createEventDispatcher();
  
  function handleFileChange(event: Event) {
    dispatch('fileChange', event);
  }
  
  function handleImportTypeChange(type: 'grants' | 'budgetItems') {
    importType = type;
    dispatch('typeChange', type);
  }
  
  function handleDownloadSample() {
    dispatch('downloadSample');
  }
  
  function handleImportSubmit() {
    dispatch('import');
  }
  
  function closeModal() {
    showImportModal = false;
    dispatch('close');
  }
</script>

{#if showImportModal}
<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
  <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
    <div class="mb-4">
      <h3 class="text-lg font-bold text-gray-900">データインポート</h3>
      <button 
        on:click={closeModal}
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">インポートタイプ</label>
        <div class="flex gap-2">
          <button
            on:click={() => handleImportTypeChange('grants')}
            class="px-4 py-2 rounded {importType === 'grants' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}"
          >
            助成金
          </button>
          <button
            on:click={() => handleImportTypeChange('budgetItems')}
            class="px-4 py-2 rounded {importType === 'budgetItems' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}"
          >
            予算項目
          </button>
        </div>
      </div>
      
      <div>
        <label for="csv-file" class="block text-sm font-medium text-gray-700 mb-2">
          CSVファイルを選択
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv"
          on:change={handleFileChange}
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      
      {#if importType === 'grants'}
        <div class="text-sm text-gray-600">
          <p>必須カラム: name, grantCode, totalAmount, startDate, endDate, status</p>
        </div>
      {:else}
        <div class="text-sm text-gray-600">
          <p>必須カラム: name, category, budgetedAmount, grantCode</p>
        </div>
      {/if}
      
      <button
        on:click={handleDownloadSample}
        class="text-blue-600 hover:text-blue-700 text-sm underline"
      >
        サンプルCSVをダウンロード
      </button>
      
      {#if importPreview.length > 0}
        <div class="border border-gray-200 rounded p-2 max-h-48 overflow-y-auto">
          <h4 class="font-medium text-sm mb-2">
            インポートプレビュー ({importPreview.length}件の{importType === 'grants' ? '助成金' : '予算項目'})
          </h4>
          <div class="text-xs space-y-1">
            {#if importType === 'grants'}
              {#each importPreview.slice(0, 5) as grant}
                <div class="border-b pb-1">
                  {grant.name} ({grant.grantCode}) - ¥{grant.totalAmount?.toLocaleString()}
                </div>
              {/each}
            {:else}
              {#each importPreview.slice(0, 5) as item}
                <div class="border-b pb-1">
                  {item.name} ({item.category}) - ¥{item.budgetedAmount?.toLocaleString()}
                </div>
              {/each}
            {/if}
            {#if importPreview.length > 5}
              <div class="text-gray-500">...他 {importPreview.length - 5} 件</div>
            {/if}
          </div>
        </div>
      {/if}
      
      {#if importError}
        <div class="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {importError}
        </div>
      {/if}
      
      {#if isImporting}
        <div class="space-y-2">
          <div class="text-sm text-gray-600">インポート中... {importProgress}%</div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full" style="width: {importProgress}%"></div>
          </div>
        </div>
      {/if}
      
      <div class="flex justify-end gap-2">
        <button
          on:click={closeModal}
          class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          disabled={isImporting}
        >
          キャンセル
        </button>
        <button
          on:click={handleImportSubmit}
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          disabled={!importFile || importPreview.length === 0 || isImporting}
        >
          {isImporting ? 'インポート中...' : 'インポート実行'}
        </button>
      </div>
    </div>
  </div>
</div>
{/if}