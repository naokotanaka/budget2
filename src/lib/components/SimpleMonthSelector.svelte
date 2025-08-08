<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let selectedMonths: string[] = []; // "YYYY-MM"形式の配列
  export let title = '対象月';
  export let availableYearMonths: string[] = []; // 利用可能な年月のリスト

  const dispatch = createEventDispatcher();

  // 利用可能な年月から年ごとにグループ化
  $: yearGroups = (() => {
    console.log('🔍 SimpleMonthSelector - availableYearMonths:', availableYearMonths);
    console.log('🔍 SimpleMonthSelector - availableYearMonths length:', availableYearMonths?.length || 0);
    
    const groups: { [year: string]: string[] } = {};
    
    if (!availableYearMonths || availableYearMonths.length === 0) {
      console.log('⚠️ SimpleMonthSelector - availableYearMonths is empty or undefined');
      return groups;
    }
    
    availableYearMonths.forEach(yearMonth => {
      const [year, month] = yearMonth.split('-');
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(yearMonth);
    });
    
    // 年でソートし、各年の月もソート
    Object.keys(groups).forEach(year => {
      groups[year].sort();
    });
    
    console.log('📊 SimpleMonthSelector - yearGroups:', groups);
    return groups;
  })();

  function toggleMonth(yearMonth: string) {
    if (selectedMonths.includes(yearMonth)) {
      selectedMonths = selectedMonths.filter(m => m !== yearMonth);
    } else {
      selectedMonths = [...selectedMonths, yearMonth];
    }
    dispatch('change', selectedMonths);
  }

  function isSelected(yearMonth: string): boolean {
    return selectedMonths.includes(yearMonth);
  }

  function formatMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split('-');
    return `${parseInt(month)}月`;
  }
</script>

<div class="month-selector">
  <label class="title">{title}</label>
  
  {#if Object.keys(yearGroups).length === 0}
    <p class="no-months">利用可能な月がありません</p>
  {:else}
    {#each Object.entries(yearGroups) as [year, months]}
      <div class="year-group">
        <h4 class="year-title">{year}年</h4>
        <div class="months">
          {#each months as yearMonth}
            <label class="month">
              <input
                type="checkbox"
                checked={isSelected(yearMonth)}
                on:change={() => toggleMonth(yearMonth)}
              />
              <span>{formatMonth(yearMonth)}</span>
            </label>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .month-selector {
    margin-bottom: 1rem;
  }

  .title {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #374151;
  }

  .no-months {
    color: #6b7280;
    font-style: italic;
    padding: 1rem;
    text-align: center;
  }

  .year-group {
    margin-bottom: 1rem;
  }

  .year-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .months {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .month {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }

  .month input {
    margin: 0;
  }

  .month span {
    font-size: 0.875rem;
  }

  @media (max-width: 640px) {
    .months {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>