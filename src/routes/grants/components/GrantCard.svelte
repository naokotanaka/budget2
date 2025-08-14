<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getPeriodColor, getAmountColor } from '$lib/utils/color-rules';
  import type { Grant } from '$lib/types/models';

  export let grant: Grant;
  export let isSelected: boolean = false;
  export let statusLabels: Record<string, string>;
  export let statusColors: Record<string, string>;
  export let opacity: string = '';

  const dispatch = createEventDispatcher();

  function formatAmount(amount?: number, includeYen: boolean = true): string {
    if (amount == null || amount === undefined) return includeYen ? '¥0' : '0';
    const formatted = amount.toLocaleString();
    return includeYen ? `¥${formatted}` : formatted;
  }

  function handleSelect() {
    dispatch('select', grant);
  }

  function handleEdit(event: MouseEvent) {
    event.stopPropagation();
    dispatch('edit', grant);
  }

  function handleDelete(event: MouseEvent) {
    event.stopPropagation();
    dispatch('delete', grant);
  }
</script>

<div 
  class="border rounded-lg px-3 py-3 hover:shadow-md transition-shadow {isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} {opacity} relative group"
>
  <div 
    class="cursor-pointer"
    on:click={handleSelect}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && handleSelect()}
  >
    <!-- 1行目: 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
    <div class="flex justify-between items-start mb-2">
      <div class="flex items-start gap-2 flex-1 min-w-0">
        <h3 class="font-semibold text-sm truncate">{grant.name}</h3>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <span class="px-1.5 py-0.5 rounded text-xs font-medium {statusColors[grant.status]}">
          {statusLabels[grant.status]}
        </span>
        <button 
          on:click={handleEdit}
          class="px-2 py-1 hover:bg-gray-200 rounded text-xs text-gray-500 hover:text-gray-700"
        >
          編集
        </button>
        <button 
          on:click={handleDelete}
          class="px-2 py-1 hover:bg-red-100 rounded text-xs text-gray-500 hover:text-red-700"
          title="削除"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 2行目: 助成金コード + ID -->
    <div class="mb-2 flex items-center gap-2">
      {#if grant.grantCode}
        <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
          {grant.grantCode}
        </span>
      {/if}
      <span class="text-xs text-gray-500">
        ID: {grant.id}
      </span>
    </div>
    
    <!-- 3行目: 期間 + 予算額 -->
    <div class="flex justify-between items-center mb-2 text-xs">
      <div class="{getPeriodColor(grant.endDate)}">
        {#if grant.startDate && grant.endDate}
          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
        {:else}
          期間未設定
        {/if}
      </div>
      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
    </div>

    <!-- 4行目: 使用額 + 残額 -->
    <div class="flex justify-between items-center text-xs">
      <div class="text-gray-600">
        使用済: {formatAmount(grant.usedAmount || 0)}
      </div>
      <div class="font-medium {getAmountColor((grant.totalAmount || 0) - (grant.usedAmount || 0), null, grant.endDate)}">
        残額: {formatAmount((grant.totalAmount || 0) - (grant.usedAmount || 0))}
      </div>
    </div>
  </div>
</div>