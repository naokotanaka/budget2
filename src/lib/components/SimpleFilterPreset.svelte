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
      
      // デフォルトプリセットを追加（まだ存在しない場合）
      addDefaultPresets();
    } catch (e) {
      console.error('プリセット読み込みエラー:', e);
    }
  }
  
  function addDefaultPresets() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // 日付をyyyy-MM-dd形式にフォーマット
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // 月の最初と最後の日を取得
    const getMonthRange = (year: number, month: number) => {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0); // 次月の0日 = 当月の最終日
      return {
        startDate: formatDate(start),
        endDate: formatDate(end)
      };
    };
    
    // デフォルトプリセットの定義
    const defaultPresets = [
      {
        id: 'default-this-month',
        name: '今月',
        filters: getMonthRange(currentYear, currentMonth),
        sorts: null,
        budgetFilters: null
      },
      {
        id: 'default-last-month',
        name: '先月',
        filters: getMonthRange(
          currentMonth === 0 ? currentYear - 1 : currentYear,
          currentMonth === 0 ? 11 : currentMonth - 1
        ),
        sorts: null,
        budgetFilters: null
      },
      {
        id: 'default-two-months-ago',
        name: '先々月',
        filters: getMonthRange(
          currentMonth <= 1 ? currentYear - 1 : currentYear,
          currentMonth <= 1 ? currentMonth + 10 : currentMonth - 2
        ),
        sorts: null,
        budgetFilters: null
      },
      {
        id: 'default-three-months',
        name: '3ヶ月',
        filters: {
          startDate: formatDate(new Date(currentYear, currentMonth - 2, 1)),
          endDate: formatDate(new Date(currentYear, currentMonth + 1, 0))
        },
        sorts: null,
        budgetFilters: null
      }
    ];
    
    // 既存のプリセットIDのセット
    const existingIds = new Set(presets.map(p => p.id));
    
    // デフォルトプリセットを追加（存在しない場合のみ）
    let presetsAdded = false;
    defaultPresets.forEach(defaultPreset => {
      if (!existingIds.has(defaultPreset.id)) {
        presets = [...presets, defaultPreset];
        presetsAdded = true;
      }
    });
    
    // 新しいプリセットが追加された場合は保存
    if (presetsAdded) {
      savePresets();
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
      console.log('Applying preset:', preset);
      console.log('Preset filters:', preset.filters);
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

  // 助成期間プリセットを自動登録する関数を公開
  export function registerGrantPeriodPreset(grantName: string, startDate: string, endDate: string) {
    const presetName = `${grantName}助成期間 (${startDate} ~ ${endDate})`;
    
    // 既存の同名プリセットをチェック
    const existingPreset = presets.find(p => p.name === presetName);
    if (existingPreset) {
      // 既存のプリセットがある場合は何もしない
      return;
    }

    // 助成期間のフィルターデータを作成（日付のみ、他のフィルターは設定しない）
    const grantPeriodFilters = {
      startDate: startDate,
      endDate: endDate
    };

    const newPreset: Preset = {
      id: Date.now().toString(),
      name: presetName,
      filters: grantPeriodFilters,
      sorts: null,
      budgetFilters: null
    };

    presets = [...presets, newPreset];
    savePresets();
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