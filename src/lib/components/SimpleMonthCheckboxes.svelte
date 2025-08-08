<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let availableMonths: string[] = []; // YYYY-MM形式の配列
  export let selectedMonths: string[] = [];
  export let title = '利用予定月';

  const dispatch = createEventDispatcher();

  function toggleMonth(month: string) {
    if (selectedMonths.includes(month)) {
      selectedMonths = selectedMonths.filter(m => m !== month);
    } else {
      selectedMonths = [...selectedMonths, month];
    }
    dispatch('change', selectedMonths);
  }

  function toggleAll() {
    if (selectedMonths.length === availableMonths.length) {
      selectedMonths = [];
    } else {
      selectedMonths = [...availableMonths];
    }
    dispatch('change', selectedMonths);
  }

  function formatMonth(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    return `${year}年${parseInt(month)}月`;
  }
</script>

<div class="month-checkboxes">
  <div class="header">
    <h4>{title}</h4>
    <button 
      type="button"
      class="toggle-all-btn"
      on:click={toggleAll}
    >
      {selectedMonths.length === availableMonths.length ? '全解除' : '全選択'}
    </button>
  </div>
  
  {#if availableMonths.length === 0}
    <div class="no-months">
      期間が設定されていません
    </div>
  {:else}
    <div class="checkbox-grid">
      {#each availableMonths as month}
        <label class="checkbox-label">
          <input
            type="checkbox"
            checked={selectedMonths.includes(month)}
            on:change={() => toggleMonth(month)}
          />
          <span>{formatMonth(month)}</span>
        </label>
      {/each}
    </div>
  {/if}
</div>

<style>
  .month-checkboxes {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    background: white;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .header h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .toggle-all-btn {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .toggle-all-btn:hover {
    background: #2563eb;
  }

  .no-months {
    padding: 1rem;
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .checkbox-label:hover {
    color: #111827;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }
</style>