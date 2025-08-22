<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  const dispatch = createEventDispatcher();
  
  // プロパティ
  export let currentFilters: any;
  export let currentSorts: any;
  export let budgetItemFilters: any;
  
  // プリセット型定義
  interface Preset {
    id: string;
    name: string;
    filters: any;
    sorts: any;
    budgetFilters: any;
  }
  
  // 状態
  let presets: Preset[] = [];
  let selectedPresetId = '';
  let showSaveDialog = false;
  let newPresetName = '';
  
  const STORAGE_KEY = 'filter-presets-simple';
  
  onMount(() => {
    if (browser) {
      loadPresets();
    }
  });
  
  function loadPresets() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        presets = JSON.parse(stored);
      }
    } catch (e) {
      console.error('プリセット読み込みエラー:', e);
    }
  }
  
  function savePresets() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('プリセット保存エラー:', e);
    }
  }
  
  function saveNewPreset() {
    if (!newPresetName.trim()) return;
    
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: newPresetName,
      filters: currentFilters,
      sorts: currentSorts,
      budgetFilters: budgetItemFilters
    };
    
    presets = [...presets, newPreset];
    savePresets();
    
    newPresetName = '';
    showSaveDialog = false;
  }
  
  function applyPreset(presetId: string) {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      dispatch('apply', preset);
    }
  }
  
  function deletePresetById(id: string) {
    if (confirm('このプリセットを削除しますか？')) {
      presets = presets.filter(p => p.id !== id);
      savePresets();
      if (selectedPresetId === id) {
        selectedPresetId = '';
      }
    }
  }
  
  // プリセット選択をリセットする関数を公開
  export function resetSelection() {
    selectedPresetId = '';
  }
</script>

<div class="flex items-center gap-2">
  <!-- プリセット選択 -->
  <select 
    bind:value={selectedPresetId}
    on:change={() => applyPreset(selectedPresetId)}
    class="select select-sm select-bordered"
  >
    <option value="">プリセット選択...</option>
    {#each presets as preset}
      <option value={preset.id}>{preset.name}</option>
    {/each}
  </select>
  
  <!-- 保存ボタン -->
  <button 
    class="btn btn-sm px-4 bg-white border border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600"
    on:click={() => showSaveDialog = true}
    title="現在の条件を保存"
  >
    💾 保存
  </button>
  
  <!-- 削除ボタン -->
  {#if selectedPresetId}
    <button 
      class="btn btn-sm px-4 bg-white border border-red-400 text-red-600 hover:bg-red-50 hover:border-red-600"
      on:click={() => deletePresetById(selectedPresetId)}
      title="選択中のプリセットを削除"
    >
      🗑️ 削除
    </button>
  {/if}
</div>

<!-- 保存ダイアログ -->
{#if showSaveDialog}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-4 w-80">
      <h3 class="font-bold mb-3">プリセット保存</h3>
      <input 
        type="text"
        bind:value={newPresetName}
        placeholder="プリセット名"
        class="input input-bordered input-sm w-full mb-3"
        on:keydown={(e) => e.key === 'Enter' && saveNewPreset()}
      />
      <div class="flex justify-end gap-2">
        <button 
          class="btn btn-sm btn-ghost"
          on:click={() => {
            showSaveDialog = false;
            newPresetName = '';
          }}
        >
          キャンセル
        </button>
        <button 
          class="btn btn-sm btn-primary"
          on:click={saveNewPreset}
          disabled={!newPresetName.trim()}
        >
          保存
        </button>
      </div>
    </div>
  </div>
{/if}