<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import SimpleMonthCheckboxes from '$lib/components/SimpleMonthCheckboxes.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let showMonthlyBudget = true;
  export let showMonthlyUsed = true;
  export let showMonthlyRemaining = true;
  export let monthFilterStartYear = 2025;
  export let monthFilterStartMonth = 1;
  export let monthFilterEndYear = 2025;
  export let monthFilterEndMonth = 12;

  function handleSettingChange() {
    dispatch('settings-changed', {
      showMonthlyBudget,
      showMonthlyUsed,
      showMonthlyRemaining,
      monthFilterStartYear,
      monthFilterStartMonth,
      monthFilterEndYear,
      monthFilterEndMonth
    });
  }

  function handleRangeChange() {
    dispatch('filter-range-changed', {
      monthFilterStartYear,
      monthFilterStartMonth,
      monthFilterEndYear,
      monthFilterEndMonth
    });
  }

  // 進行中助成金の期間に基づいて月絞り込み範囲を設定
  export function setDefaultFilterRangeFromInProgressGrants(grants: any[]) {
    const inProgressGrants = grants.filter(grant => grant.status === 'active');
    
    if (inProgressGrants.length === 0) {
      console.log('📅 進行中の助成金がないため、デフォルト範囲を維持');
      return;
    }
    
    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;
    
    inProgressGrants.forEach(grant => {
      if (grant.startDate) {
        const startDate = new Date(grant.startDate);
        if (!earliestStart || startDate < earliestStart) {
          earliestStart = startDate;
        }
      }
      
      if (grant.endDate) {
        const endDate = new Date(grant.endDate);
        if (!latestEnd || endDate > latestEnd) {
          latestEnd = endDate;
        }
      }
    });
    
    console.log('📅 進行中助成金の期間調査:', {
      inProgressGrantsCount: inProgressGrants.length,
      earliestStart: earliestStart?.toISOString(),
      latestEnd: latestEnd?.toISOString()
    });
    
    // 初期値のままの場合のみ設定（ユーザーの手動設定を尊重）
    const isDefaultRange = (monthFilterStartYear === 2025 && monthFilterEndYear === 2025);
    
    if (isDefaultRange) {
      if (earliestStart) {
        monthFilterStartYear = earliestStart.getFullYear();
        monthFilterStartMonth = earliestStart.getMonth() + 1;
      }
      
      if (latestEnd) {
        monthFilterEndYear = latestEnd.getFullYear();
        monthFilterEndMonth = latestEnd.getMonth() + 1;
      }
      
      console.log('📅 進行中助成金の期間に基づいてフィルター範囲を設定:', {
        startYear: monthFilterStartYear,
        startMonth: monthFilterStartMonth,
        endYear: monthFilterEndYear,
        endMonth: monthFilterEndMonth
      });
      
      handleRangeChange();
    }
  }

  // 月列生成時に自動的にフィルター範囲を調整
  export function adjustFilterRangeToData(monthColumns: any[]) {
    if (monthColumns && monthColumns.length > 0) {
      const years = monthColumns.map(col => col.year);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      
      console.log('📅 データに基づくフィルター範囲調整:', {
        currentStartYear: monthFilterStartYear,
        currentEndYear: monthFilterEndYear,
        dataMinYear: minYear,
        dataMaxYear: maxYear
      });
      
      // フォールバック：月列データがある場合の調整
      if (monthFilterStartYear === 2025 && monthFilterEndYear === 2025) {
        monthFilterStartYear = minYear;
        monthFilterEndYear = maxYear;
        console.log('📅 フィルター範囲をフォールバック調整:', {
          newStartYear: monthFilterStartYear,
          newEndYear: monthFilterEndYear
        });
        
        handleRangeChange();
      }
    }
  }
</script>

<div class="bg-white border border-gray-200 rounded-lg p-4 mb-4">
  <h3 class="text-lg font-medium text-gray-900 mb-4">表示設定</h3>
  
  <!-- 月データ表示切り替え -->
  <div class="grid grid-cols-3 gap-4 mb-4">
    <label class="flex items-center">
      <input 
        type="checkbox" 
        bind:checked={showMonthlyBudget}
        on:change={handleSettingChange}
        class="mr-2"
      />
      <span class="text-sm text-gray-700">予算額表示</span>
    </label>
    <label class="flex items-center">
      <input 
        type="checkbox" 
        bind:checked={showMonthlyUsed}
        on:change={handleSettingChange}
        class="mr-2"
      />
      <span class="text-sm text-gray-700">使用額表示</span>
    </label>
    <label class="flex items-center">
      <input 
        type="checkbox" 
        bind:checked={showMonthlyRemaining}
        on:change={handleSettingChange}
        class="mr-2"
      />
      <span class="text-sm text-gray-700">残額表示</span>
    </label>
  </div>

  <!-- 月絞り込み範囲設定 -->
  <div class="border-t border-gray-200 pt-4">
    <h4 class="text-md font-medium text-gray-800 mb-2">月絞り込み範囲</h4>
    <div class="grid grid-cols-4 gap-2 items-center">
      <div>
        <label class="block text-xs text-gray-600 mb-1">開始年</label>
        <input 
          type="number" 
          bind:value={monthFilterStartYear}
          on:change={handleRangeChange}
          min="2020" 
          max="2030"
          class="w-full p-1 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-600 mb-1">開始月</label>
        <select 
          bind:value={monthFilterStartMonth}
          on:change={handleRangeChange}
          class="w-full p-1 border border-gray-300 rounded text-sm"
        >
          {#each Array(12).fill(0).map((_, i) => i + 1) as month}
            <option value={month}>{month}月</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-600 mb-1">終了年</label>
        <input 
          type="number" 
          bind:value={monthFilterEndYear}
          on:change={handleRangeChange}
          min="2020" 
          max="2030"
          class="w-full p-1 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-600 mb-1">終了月</label>
        <select 
          bind:value={monthFilterEndMonth}
          on:change={handleRangeChange}
          class="w-full p-1 border border-gray-300 rounded text-sm"
        >
          {#each Array(12).fill(0).map((_, i) => i + 1) as month}
            <option value={month}>{month}月</option>
          {/each}
        </select>
      </div>
    </div>
  </div>
</div>