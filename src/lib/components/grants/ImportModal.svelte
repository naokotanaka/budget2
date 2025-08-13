<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let showImportModal = false;
  export let importType: 'grants' | 'budgetItems' = 'grants';
  export let importFile: File | null = null;
  export let importPreview: any[] = [];
  export let importError = '';
  export let importProgress = 0;
  export let isImporting = false;

  // Internal state
  let fileInput: HTMLInputElement;

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file && file.type === 'text/csv') {
      importFile = file;
      dispatch('file-selected', { file });
    } else {
      importError = 'CSVファイルを選択してください';
    }
  }

  function handlePreview() {
    if (importFile) {
      dispatch('preview-import', { file: importFile, type: importType });
    }
  }

  function handleExecuteImport() {
    if (importPreview.length > 0) {
      dispatch('execute-import', { data: importPreview, type: importType });
    }
  }

  function handleCloseModal() {
    showImportModal = false;
    importFile = null;
    importPreview = [];
    importError = '';
    importProgress = 0;
    isImporting = false;
    dispatch('modal-closed');
  }
</script>

{#if showImportModal}
  <div class="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded-lg w-full max-w-4xl max-h-96 overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-gray-900">CSVインポート</h2>
        <button 
          on:click={handleCloseModal}
          class="text-gray-500 hover:text-gray-700"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <!-- インポートタイプ選択 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">インポートタイプ</label>
          <select 
            bind:value={importType}
            class="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="grants">助成金</option>
            <option value="budgetItems">予算項目</option>
          </select>
        </div>

        <!-- ファイル選択 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">CSVファイル</label>
          <input 
            bind:this={fileInput}
            type="file" 
            accept=".csv" 
            on:change={handleFileSelect}
            class="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <!-- エラー表示 -->
        {#if importError}
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {importError}
          </div>
        {/if}

        <!-- プレビューボタン -->
        {#if importFile && !importPreview.length}
          <button 
            on:click={handlePreview}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            プレビュー
          </button>
        {/if}

        <!-- プレビュー結果 -->
        {#if importPreview.length > 0}
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              プレビュー ({importPreview.length}件)
            </h3>
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="max-h-64 overflow-y-auto">
                <table class="min-w-full table-auto">
                  <thead class="bg-gray-50">
                    <tr>
                      {#each Object.keys(importPreview[0] || {}) as key}
                        <th class="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">
                          {key}
                        </th>
                      {/each}
                    </tr>
                  </thead>
                  <tbody>
                    {#each importPreview.slice(0, 10) as row}
                      <tr class="hover:bg-gray-50">
                        {#each Object.values(row) as value}
                          <td class="px-4 py-2 text-sm text-gray-900 border-b">
                            {value}
                          </td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              {#if importPreview.length > 10}
                <div class="bg-gray-50 px-4 py-2 text-sm text-gray-600">
                  ... 他 {importPreview.length - 10} 件
                </div>
              {/if}
            </div>
          </div>

          <!-- インポート実行ボタン -->
          <div class="flex justify-end space-x-3">
            <button 
              on:click={handleCloseModal}
              class="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              キャンセル
            </button>
            <button 
              on:click={handleExecuteImport}
              disabled={isImporting}
              class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {#if isImporting}
                インポート中...
              {:else}
                インポート実行
              {/if}
            </button>
          </div>
        {/if}

        <!-- プログレスバー -->
        {#if isImporting}
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div 
              class="bg-green-600 h-2 rounded-full transition-all duration-300"
              style="width: {importProgress}%"
            ></div>
          </div>
          <p class="text-sm text-gray-600 text-center">{importProgress}% 完了</p>
        {/if}
      </div>
    </div>
  </div>
{/if}