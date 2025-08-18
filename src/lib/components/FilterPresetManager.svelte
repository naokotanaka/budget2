<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { FilterPreset } from '$lib/utils/filterPresets';
  import {
    getPresets,
    savePreset,
    updatePreset,
    deletePreset,
    setDefaultPreset,
    clearDefaultPreset,
    exportPresets,
    importPresets
  } from '$lib/utils/filterPresets';

  const dispatch = createEventDispatcher<{
    presetApplied: FilterPreset;
    presetSaved: string;
  }>();

  // プロパティ
  export let currentFilters: any;
  export let currentSorts: any;
  export let budgetItemFilters: any;

  // 状態
  let presets: FilterPreset[] = [];
  let showSaveDialog = false;
  let showManageDialog = false;
  let showImportDialog = false;
  let newPresetName = '';
  let editingPreset: FilterPreset | null = null;
  let editingName = '';
  let importData = '';
  let selectedPresetId = '';

  // エラー・成功メッセージ
  let saveMessage = '';
  let saveMessageType: 'success' | 'error' = 'success';
  let manageMessage = '';
  let manageMessageType: 'success' | 'error' = 'success';
  let importMessage = '';
  let importMessageType: 'success' | 'error' = 'success';

  onMount(() => {
    if (browser) {
      loadPresets();
    }
  });

  function loadPresets() {
    presets = getPresets();
  }

  function clearMessage(type: 'save' | 'manage' | 'import') {
    setTimeout(() => {
      if (type === 'save') saveMessage = '';
      if (type === 'manage') manageMessage = '';
      if (type === 'import') importMessage = '';
    }, 3000);
  }

  function openSaveDialog() {
    newPresetName = '';
    saveMessage = '';
    showSaveDialog = true;
  }

  function closeSaveDialog() {
    showSaveDialog = false;
    newPresetName = '';
    saveMessage = '';
  }

  function openManageDialog() {
    manageMessage = '';
    showManageDialog = true;
    loadPresets();
  }

  function closeManageDialog() {
    showManageDialog = false;
    editingPreset = null;
    editingName = '';
    manageMessage = '';
  }

  function openImportDialog() {
    importData = '';
    importMessage = '';
    showImportDialog = true;
  }

  function closeImportDialog() {
    showImportDialog = false;
    importData = '';
    importMessage = '';
  }

  function getCurrentState(): Omit<FilterPreset, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      name: newPresetName,
      filters: {
        headerFilters: { ...currentFilters },
        checkboxFilters: {
          allocationStatus: Array.from(currentFilters.checkboxFilters?.allocationStatus || []),
          account: Array.from(currentFilters.checkboxFilters?.account || []),
          department: Array.from(currentFilters.checkboxFilters?.department || []),
          supplier: Array.from(currentFilters.checkboxFilters?.supplier || []),
          item: Array.from(currentFilters.checkboxFilters?.item || []),
          primaryGrantName: Array.from(currentFilters.checkboxFilters?.primaryGrantName || []),
          primaryBudgetItemName: Array.from(currentFilters.checkboxFilters?.primaryBudgetItemName || [])
        },
        budgetItemStatusFilter: budgetItemFilters.budgetItemStatusFilter,
        budgetItemGrantFilter: budgetItemFilters.budgetItemGrantFilter,
        budgetItemCategoryFilter: budgetItemFilters.budgetItemCategoryFilter
      },
      sortConditions: {
        budgetItemSortFields: [...(currentSorts.budgetItemSortFields || [])],
        transactionSortFields: [...(currentSorts.transactionSortFields || [])]
      }
    };
  }

  async function handleSavePreset() {
    if (!newPresetName.trim()) {
      saveMessage = 'プリセット名を入力してください';
      saveMessageType = 'error';
      clearMessage('save');
      return;
    }

    try {
      const presetData = getCurrentState();
      const id = savePreset(presetData);
      
      saveMessage = 'プリセットを保存しました';
      saveMessageType = 'success';
      
      loadPresets();
      dispatch('presetSaved', id);
      
      clearMessage('save');
      setTimeout(() => closeSaveDialog(), 1000);
    } catch (error) {
      saveMessage = error.message;
      saveMessageType = 'error';
      clearMessage('save');
    }
  }

  function applyPreset(preset: FilterPreset) {
    selectedPresetId = preset.id;
    dispatch('presetApplied', preset);
  }

  function startEdit(preset: FilterPreset) {
    editingPreset = preset;
    editingName = preset.name;
  }

  function cancelEdit() {
    editingPreset = null;
    editingName = '';
  }

  async function saveEdit() {
    if (!editingName.trim()) {
      manageMessage = 'プリセット名を入力してください';
      manageMessageType = 'error';
      clearMessage('manage');
      return;
    }

    try {
      updatePreset(editingPreset!.id, { name: editingName });
      
      manageMessage = 'プリセット名を更新しました';
      manageMessageType = 'success';
      
      loadPresets();
      editingPreset = null;
      editingName = '';
      
      clearMessage('manage');
    } catch (error) {
      manageMessage = error.message;
      manageMessageType = 'error';
      clearMessage('manage');
    }
  }

  async function handleDelete(preset: FilterPreset) {
    if (!confirm(`プリセット「${preset.name}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      deletePreset(preset.id);
      
      manageMessage = 'プリセットを削除しました';
      manageMessageType = 'success';
      
      loadPresets();
      
      if (selectedPresetId === preset.id) {
        selectedPresetId = '';
      }
      
      clearMessage('manage');
    } catch (error) {
      manageMessage = error.message;
      manageMessageType = 'error';
      clearMessage('manage');
    }
  }

  async function handleSetDefault(preset: FilterPreset) {
    try {
      if (preset.isDefault) {
        clearDefaultPreset();
        manageMessage = 'デフォルトプリセットを解除しました';
      } else {
        setDefaultPreset(preset.id);
        manageMessage = `「${preset.name}」をデフォルトプリセットに設定しました`;
      }
      
      manageMessageType = 'success';
      loadPresets();
      clearMessage('manage');
    } catch (error) {
      manageMessage = error.message;
      manageMessageType = 'error';
      clearMessage('manage');
    }
  }

  function handleExport() {
    try {
      const data = exportPresets();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filter-presets-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      manageMessage = 'プリセットをエクスポートしました';
      manageMessageType = 'success';
      clearMessage('manage');
    } catch (error) {
      manageMessage = `エクスポートエラー: ${error.message}`;
      manageMessageType = 'error';
      clearMessage('manage');
    }
  }

  async function handleImport() {
    if (!importData.trim()) {
      importMessage = 'インポートデータを入力してください';
      importMessageType = 'error';
      clearMessage('import');
      return;
    }

    try {
      importPresets(importData);
      
      importMessage = 'プリセットをインポートしました';
      importMessageType = 'success';
      
      loadPresets();
      clearMessage('import');
      setTimeout(() => closeImportDialog(), 1000);
    } catch (error) {
      importMessage = error.message;
      importMessageType = 'error';
      clearMessage('import');
    }
  }

  function handleFileImport(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      importData = e.target?.result as string;
    };
    reader.readAsText(file);
  }
</script>

<div class="flex items-center gap-2">
  <!-- プリセット選択ドロップダウン -->
  <div class="dropdown">
    <label tabindex="0" class="btn btn-sm btn-outline">
      📋 プリセット
      {#if selectedPresetId}
        <span class="text-xs text-blue-600">
          ({presets.find(p => p.id === selectedPresetId)?.name})
        </span>
      {/if}
    </label>
    <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-64">
      {#if presets.length === 0}
        <li><span class="text-gray-500 text-sm">保存されたプリセットがありません</span></li>
      {:else}
        {#each presets as preset (preset.id)}
          <li>
            <button
              class="flex justify-between items-center text-left"
              class:bg-blue-50={selectedPresetId === preset.id}
              on:click={() => applyPreset(preset)}
            >
              <span class="flex items-center gap-1">
                {preset.name}
                {#if preset.isDefault}
                  <span class="badge badge-xs badge-primary">デフォルト</span>
                {/if}
              </span>
              <span class="text-xs text-gray-400">
                {new Date(preset.updatedAt).toLocaleDateString()}
              </span>
            </button>
          </li>
        {/each}
      {/if}
      <div class="divider my-1"></div>
      <li><button on:click={openSaveDialog}>💾 現在の条件を保存</button></li>
      <li><button on:click={openManageDialog}>⚙️ プリセット管理</button></li>
    </ul>
  </div>

  <!-- 保存ボタン（クイックアクセス） -->
  <button
    class="btn btn-sm btn-primary"
    on:click={openSaveDialog}
    title="現在のフィルター・ソート条件を保存"
  >
    💾 保存
  </button>
</div>

<!-- プリセット保存ダイアログ -->
{#if showSaveDialog}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">プリセットの保存</h3>
      
      <div class="py-4">
        <label class="label">
          <span class="label-text">プリセット名</span>
        </label>
        <input
          type="text"
          class="input input-bordered w-full"
          bind:value={newPresetName}
          placeholder="例: 今月の支出 - 人件費"
          maxlength="100"
        />
        
        <div class="mt-4 p-3 bg-gray-50 rounded text-sm">
          <h4 class="font-semibold mb-2">保存される内容:</h4>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li>すべてのフィルター条件（日付、金額、文字列検索など）</li>
            <li>ソート条件（複数ソート含む）</li>
            <li>左ペインのフィルター・ソート設定</li>
          </ul>
        </div>
      </div>

      {#if saveMessage}
        <div class="alert" class:alert-success={saveMessageType === 'success'} class:alert-error={saveMessageType === 'error'}>
          {saveMessage}
        </div>
      {/if}

      <div class="modal-action">
        <button class="btn btn-ghost" on:click={closeSaveDialog}>キャンセル</button>
        <button class="btn btn-primary" on:click={handleSavePreset}>保存</button>
      </div>
    </div>
  </div>
{/if}

<!-- プリセット管理ダイアログ -->
{#if showManageDialog}
  <div class="modal modal-open">
    <div class="modal-box max-w-4xl">
      <h3 class="font-bold text-lg">プリセット管理</h3>
      
      <div class="py-4">
        {#if presets.length === 0}
          <div class="text-center py-8 text-gray-500">
            保存されたプリセットがありません
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>作成日</th>
                  <th>更新日</th>
                  <th>デフォルト</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {#each presets as preset (preset.id)}
                  <tr>
                    <td>
                      {#if editingPreset?.id === preset.id}
                        <input
                          type="text"
                          class="input input-sm input-bordered"
                          bind:value={editingName}
                          maxlength="100"
                        />
                      {:else}
                        <span class="font-medium">{preset.name}</span>
                      {/if}
                    </td>
                    <td class="text-sm text-gray-500">
                      {new Date(preset.createdAt).toLocaleDateString()}
                    </td>
                    <td class="text-sm text-gray-500">
                      {new Date(preset.updatedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        class="btn btn-xs"
                        class:btn-primary={preset.isDefault}
                        class:btn-ghost={!preset.isDefault}
                        on:click={() => handleSetDefault(preset)}
                      >
                        {preset.isDefault ? '✓' : '○'}
                      </button>
                    </td>
                    <td>
                      <div class="flex gap-1">
                        {#if editingPreset?.id === preset.id}
                          <button class="btn btn-xs btn-success" on:click={saveEdit}>保存</button>
                          <button class="btn btn-xs btn-ghost" on:click={cancelEdit}>キャンセル</button>
                        {:else}
                          <button class="btn btn-xs btn-outline" on:click={() => applyPreset(preset)}>適用</button>
                          <button class="btn btn-xs btn-ghost" on:click={() => startEdit(preset)}>編集</button>
                          <button class="btn btn-xs btn-error btn-outline" on:click={() => handleDelete(preset)}>削除</button>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <div class="divider"></div>
        
        <div class="flex gap-2">
          <button class="btn btn-sm btn-outline" on:click={handleExport}>
            📤 エクスポート
          </button>
          <button class="btn btn-sm btn-outline" on:click={openImportDialog}>
            📥 インポート
          </button>
        </div>
      </div>

      {#if manageMessage}
        <div class="alert" class:alert-success={manageMessageType === 'success'} class:alert-error={manageMessageType === 'error'}>
          {manageMessage}
        </div>
      {/if}

      <div class="modal-action">
        <button class="btn" on:click={closeManageDialog}>閉じる</button>
      </div>
    </div>
  </div>
{/if}

<!-- インポートダイアログ -->
{#if showImportDialog}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">プリセットのインポート</h3>
      
      <div class="py-4">
        <label class="label">
          <span class="label-text">ファイルを選択</span>
        </label>
        <input
          type="file"
          class="file-input file-input-bordered w-full"
          accept=".json"
          on:change={handleFileImport}
        />
        
        <label class="label mt-4">
          <span class="label-text">またはJSONデータを直接入力</span>
        </label>
        <textarea
          class="textarea textarea-bordered w-full h-32"
          bind:value={importData}
          placeholder="エクスポートしたJSONデータをペースト..."
        ></textarea>
      </div>

      {#if importMessage}
        <div class="alert" class:alert-success={importMessageType === 'success'} class:alert-error={importMessageType === 'error'}>
          {importMessage}
        </div>
      {/if}

      <div class="modal-action">
        <button class="btn btn-ghost" on:click={closeImportDialog}>キャンセル</button>
        <button class="btn btn-primary" on:click={handleImport}>インポート</button>
      </div>
    </div>
  </div>
{/if}