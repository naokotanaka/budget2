<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { FilterPreset, HeaderFilters, BudgetItemFilters, SortField } from '$lib/types/presets';
  import { PRESET_STORAGE_KEY, DEFAULT_PRESET_IDS, MAX_CUSTOM_PRESETS, MAX_PRESET_NAME_LENGTH } from '$lib/types/presets';
  import { safeGetItem, safeSetItem } from '$lib/utils/storageUtils';
  import { formatDateForInput, getMonthRange, calculateMonthOffset, convertToISOFormat } from '$lib/utils/dateUtils';
  
  const dispatch = createEventDispatcher();
  
  // プロパティ
  export let currentFilters: HeaderFilters;
  export let currentSorts: SortField[] | null;
  export let budgetItemFilters: BudgetItemFilters | null;
  
  // 状態
  let presets: FilterPreset[] = [];
  let selectedPresetId = '';
  let showSaveDialog = false;
  let newPresetName = '';
  let storageError: string | null = null;
  
  onMount(() => {
    if (browser) {
      loadPresets();
    }
  });
  
  /**
   * Load presets from localStorage with error handling
   */
  function loadPresets(): void {
    const result = safeGetItem<FilterPreset[]>(PRESET_STORAGE_KEY);
    
    if (result.success && result.data) {
      presets = result.data;
    } else if (result.error) {
      storageError = `プリセットの読み込みに失敗しました: ${result.error.message}`;
      // Initialize with empty array on error
      presets = [];
    }
    
    // Add default presets if they don't exist
    addDefaultPresets();
  }
  
  /**
   * Add default presets for common date ranges
   */
  function addDefaultPresets(): void {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // Calculate month offsets with proper year boundary handling
    const lastMonth = calculateMonthOffset(currentYear, currentMonth, -1);
    const twoMonthsAgo = calculateMonthOffset(currentYear, currentMonth, -2);
    
    // Define default presets with proper typing
    const defaultPresets: FilterPreset[] = [
      {
        id: DEFAULT_PRESET_IDS.THIS_MONTH,
        name: '今月',
        filters: getMonthRange(currentYear, currentMonth),
        sorts: null,
        budgetFilters: null,
        isDefault: true
      },
      {
        id: DEFAULT_PRESET_IDS.LAST_MONTH,
        name: '先月',
        filters: getMonthRange(lastMonth.year, lastMonth.month),
        sorts: null,
        budgetFilters: null,
        isDefault: true
      },
      {
        id: DEFAULT_PRESET_IDS.TWO_MONTHS_AGO,
        name: '先々月',
        filters: getMonthRange(twoMonthsAgo.year, twoMonthsAgo.month),
        sorts: null,
        budgetFilters: null,
        isDefault: true
      },
      {
        id: DEFAULT_PRESET_IDS.THREE_MONTHS,
        name: '3ヶ月',
        filters: {
          startDate: formatDateForInput(new Date(twoMonthsAgo.year, twoMonthsAgo.month, 1)),
          endDate: formatDateForInput(new Date(currentYear, currentMonth + 1, 0))
        },
        sorts: null,
        budgetFilters: null,
        isDefault: true
      }
    ];
    
    // Check existing preset IDs
    const existingIds = new Set(presets.map(p => p.id));
    
    // Add default presets if they don't exist
    let presetsAdded = false;
    for (const defaultPreset of defaultPresets) {
      if (!existingIds.has(defaultPreset.id)) {
        presets = [...presets, defaultPreset];
        presetsAdded = true;
      }
    }
    
    // Save if new presets were added
    if (presetsAdded) {
      savePresets();
    }
  }
  
  /**
   * Save presets to localStorage with error handling
   */
  function savePresets(): void {
    const result = safeSetItem(PRESET_STORAGE_KEY, presets);
    
    if (!result.success && result.error) {
      storageError = `プリセットの保存に失敗しました: ${result.error.message}`;
      // Show temporary error message
      setTimeout(() => {
        storageError = null;
      }, 5000);
    }
  }
  
  /**
   * Save current filters as a new preset
   */
  function saveNewPreset(): void {
    const trimmedName = newPresetName.trim();
    
    // Validate preset name
    if (!trimmedName) {
      storageError = 'プリセット名を入力してください';
      return;
    }
    
    if (trimmedName.length > MAX_PRESET_NAME_LENGTH) {
      storageError = `プリセット名は${MAX_PRESET_NAME_LENGTH}文字以内で入力してください`;
      return;
    }
    
    // Check if name already exists
    if (presets.some(p => p.name === trimmedName && !p.isDefault)) {
      storageError = '同じ名前のプリセットが既に存在します';
      return;
    }
    
    // Check maximum presets limit
    const customPresetsCount = presets.filter(p => !p.isDefault).length;
    if (customPresetsCount >= MAX_CUSTOM_PRESETS) {
      storageError = `カスタムプリセットは最大${MAX_CUSTOM_PRESETS}個まで保存できます`;
      return;
    }
    
    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      filters: currentFilters,
      sorts: currentSorts,
      budgetFilters: budgetItemFilters,
      createdAt: new Date().toISOString(),
      isDefault: false
    };
    
    presets = [...presets, newPreset];
    savePresets();
    
    newPresetName = '';
    showSaveDialog = false;
    storageError = null;
  }
  
  /**
   * Apply selected preset
   */
  function applyPreset(presetId: string): void {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      dispatch('apply', preset);
    }
  }
  
  /**
   * Delete a preset by ID (only custom presets can be deleted)
   */
  function deletePresetById(id: string): void {
    const preset = presets.find(p => p.id === id);
    
    if (!preset) return;
    
    // Prevent deletion of default presets
    if (preset.isDefault) {
      storageError = 'デフォルトプリセットは削除できません';
      setTimeout(() => {
        storageError = null;
      }, 3000);
      return;
    }
    
    if (confirm(`プリセット「${preset.name}」を削除しますか？`)) {
      presets = presets.filter(p => p.id !== id);
      savePresets();
      
      if (selectedPresetId === id) {
        selectedPresetId = '';
      }
    }
  }
  
  /**
   * Reset preset selection
   */
  export function resetSelection(): void {
    selectedPresetId = '';
  }

  /**
   * Register grant period preset automatically when a grant is selected
   * @param grantName - Name of the grant
   * @param startDate - Grant start date (any format)
   * @param endDate - Grant end date (any format)
   */
  export function registerGrantPeriodPreset(grantName: string, startDate: string, endDate: string): void {
    if (!grantName || !startDate || !endDate) return;
    
    // Convert dates to ISO format for consistency
    const isoStartDate = convertToISOFormat(startDate);
    const isoEndDate = convertToISOFormat(endDate);
    
    if (!isoStartDate || !isoEndDate) {
      // Invalid dates, skip registration
      return;
    }
    
    const presetName = `${grantName}助成期間 (${isoStartDate} ~ ${isoEndDate})`;
    
    // Check for existing preset with same name
    const existingPreset = presets.find(p => p.name === presetName);
    if (existingPreset) {
      // Preset already exists, no need to add
      return;
    }

    // Create grant period filter (only dates, no other filters)
    const grantPeriodFilters: HeaderFilters = {
      startDate: isoStartDate,
      endDate: isoEndDate
    };

    const newPreset: FilterPreset = {
      id: `grant-${Date.now()}`,
      name: presetName,
      filters: grantPeriodFilters,
      sorts: null,
      budgetFilters: null,
      isAutoGenerated: true,
      createdAt: new Date().toISOString()
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
  {#if selectedPresetId && !presets.find(p => p.id === selectedPresetId)?.isDefault}
    <button 
      class="btn btn-sm px-4 bg-white border border-red-400 text-red-600 hover:bg-red-50 hover:border-red-600"
      on:click={() => deletePresetById(selectedPresetId)}
      title="選択中のプリセットを削除"
    >
      🗑️ 削除
    </button>
  {/if}
</div>

<!-- エラーメッセージ表示 -->
{#if storageError}
  <div class="alert alert-error mt-2">
    <span>{storageError}</span>
  </div>
{/if}

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