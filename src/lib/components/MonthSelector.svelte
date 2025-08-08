<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { 
    extractMonthsFromAllGrants, 
    groupMonthsByFiscalYear, 
    groupMonthsByQuarter,
    getFiscalQuarterLabel,
    getMonthSelectionStats,
    type MonthInfo 
  } from '$lib/utils/month-extractor';

  export let grants: any[] = [];
  export let selectedMonths: string[] = []; // YYYY-MM形式のキー配列
  export let title = '利用予定月';
  export let showGrouping = true;
  export let enableKeyboardNavigation = true;

  const dispatch = createEventDispatcher();

  // 状態管理
  let availableMonths: MonthInfo[] = [];
  let viewMode: 'grid' | 'grouped' | 'compact' = 'grid';
  let groupBy: 'none' | 'fiscalYear' | 'quarter' = 'fiscalYear';
  let currentFocusIndex = -1;
  let containerElement: HTMLElement;
  let showStats = false;

  // レスポンシブ対応の列数
  let columnCount = 3; // デフォルトはデスクトップ用

  // grants が変更されたら月データを再生成
  $: {
    if (grants && grants.length > 0) {
      availableMonths = extractMonthsFromAllGrants(grants);
      console.log('📅 抽出された月数:', availableMonths.length);
    }
  }

  // 選択統計情報
  $: selectionStats = getMonthSelectionStats(availableMonths, selectedMonths);

  // グループ化されたデータ
  $: groupedMonths = (() => {
    if (groupBy === 'fiscalYear') {
      return groupMonthsByFiscalYear(availableMonths);
    } else if (groupBy === 'quarter') {
      // 年度別の四半期にグループ化
      const grouped: { [key: string]: MonthInfo[] } = {};
      availableMonths.forEach(month => {
        const key = getFiscalQuarterLabel(month.fiscalYear, month.fiscalQuarter);
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(month);
      });
      return grouped;
    }
    return { '全期間': availableMonths };
  })();

  // 月の選択/解除
  function toggleMonth(monthKey: string) {
    if (selectedMonths.includes(monthKey)) {
      selectedMonths = selectedMonths.filter(key => key !== monthKey);
    } else {
      selectedMonths = [...selectedMonths, monthKey];
    }
    dispatch('change', selectedMonths);
  }

  // グループ単位の選択/解除
  function toggleGroup(groupKey: string) {
    const groupMonths = groupedMonths[groupKey] || [];
    const groupKeys = groupMonths.map(m => m.key);
    
    const allSelected = groupKeys.every(key => selectedMonths.includes(key));
    
    if (allSelected) {
      selectedMonths = selectedMonths.filter(key => !groupKeys.includes(key));
    } else {
      const newKeys = groupKeys.filter(key => !selectedMonths.includes(key));
      selectedMonths = [...selectedMonths, ...newKeys];
    }
    dispatch('change', selectedMonths);
  }

  // 全選択/全解除
  function toggleAllMonths() {
    if (selectedMonths.length === availableMonths.length) {
      selectedMonths = [];
    } else {
      selectedMonths = availableMonths.map(m => m.key);
    }
    dispatch('change', selectedMonths);
  }

  // クイック選択（最近のN月を選択）
  function selectRecentMonths(count: number) {
    const recentMonths = availableMonths.slice(0, count);
    selectedMonths = recentMonths.map(m => m.key);
    dispatch('change', selectedMonths);
  }

  // 範囲選択（Shiftキー押下時）
  let lastSelectedIndex = -1;
  function handleMonthClick(event: MouseEvent, monthKey: string, index: number) {
    if (event.shiftKey && lastSelectedIndex !== -1) {
      // Shift+クリックで範囲選択
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeMonths = availableMonths.slice(start, end + 1);
      const rangeKeys = rangeMonths.map(m => m.key);
      
      // 既存の選択を保持しつつ、範囲を追加
      const newKeys = rangeKeys.filter(key => !selectedMonths.includes(key));
      selectedMonths = [...selectedMonths, ...newKeys];
      dispatch('change', selectedMonths);
    } else {
      toggleMonth(monthKey);
      lastSelectedIndex = index;
    }
  }

  // キーボードナビゲーション
  function handleKeyDown(event: KeyboardEvent) {
    if (!enableKeyboardNavigation) return;

    const cells = containerElement?.querySelectorAll('.month-cell-button');
    if (!cells || cells.length === 0) return;

    let handled = true;
    const currentColumns = getColumnCount();

    switch (event.key) {
      case 'ArrowRight':
        currentFocusIndex = Math.min(currentFocusIndex + 1, cells.length - 1);
        break;
      case 'ArrowLeft':
        currentFocusIndex = Math.max(currentFocusIndex - 1, 0);
        break;
      case 'ArrowDown':
        currentFocusIndex = Math.min(currentFocusIndex + currentColumns, cells.length - 1);
        break;
      case 'ArrowUp':
        currentFocusIndex = Math.max(currentFocusIndex - currentColumns, 0);
        break;
      case ' ':
      case 'Enter':
        event.preventDefault();
        const monthKey = (cells[currentFocusIndex] as HTMLElement)?.dataset.monthKey;
        if (monthKey) {
          toggleMonth(monthKey);
        }
        break;
      case 'Home':
        currentFocusIndex = 0;
        break;
      case 'End':
        currentFocusIndex = cells.length - 1;
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      (cells[currentFocusIndex] as HTMLElement)?.focus();
    }
  }

  // 現在の列数を取得
  function getColumnCount(): number {
    if (viewMode === 'compact') return 6;
    if (typeof window === 'undefined') return 3;
    
    const width = window.innerWidth;
    if (width < 640) return 1; // モバイル
    if (width < 1024) return 2; // タブレット
    return 3; // デスクトップ
  }

  // レスポンシブ対応
  function handleResize() {
    columnCount = getColumnCount();
  }

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  // 月が選択されているか
  function isMonthSelected(monthKey: string): boolean {
    return selectedMonths.includes(monthKey);
  }

  // グループの選択状態を取得
  function getGroupSelectionState(groupKey: string): 'all' | 'partial' | 'none' {
    const groupMonths = groupedMonths[groupKey] || [];
    const groupKeys = groupMonths.map(m => m.key);
    const selectedCount = groupKeys.filter(key => selectedMonths.includes(key)).length;
    
    if (selectedCount === 0) return 'none';
    if (selectedCount === groupKeys.length) return 'all';
    return 'partial';
  }

  // ビューモードのアイコン取得
  function getViewModeIcon(mode: string): string {
    switch (mode) {
      case 'grid': return '⊞';
      case 'grouped': return '▤';
      case 'compact': return '⋮⋮';
      default: return '⊞';
    }
  }
</script>

<div class="month-selector" bind:this={containerElement}>
  <!-- ヘッダー -->
  <div class="selector-header">
    <div class="header-left">
      <h3 class="selector-title">{title}</h3>
      <div class="selection-info">
        <span class="selected-count">{selectedMonths.length}</span>
        <span class="separator">/</span>
        <span class="total-count">{availableMonths.length}</span>
        <span class="selection-label">選択中</span>
        {#if selectedMonths.length > 0}
          <span class="selection-percentage">({selectionStats.percentage}%)</span>
        {/if}
      </div>
    </div>

    <div class="header-controls">
      <!-- 統計表示トグル -->
      <button
        class="control-button"
        class:active={showStats}
        on:click={() => showStats = !showStats}
        title="統計情報を表示"
      >
        📊
      </button>

      <!-- ビューモード切り替え -->
      <div class="view-mode-selector" role="tablist">
        {#each ['grid', 'grouped', 'compact'] as mode}
          <button
            role="tab"
            aria-selected={viewMode === mode}
            class="view-mode-button"
            class:active={viewMode === mode}
            on:click={() => viewMode = mode}
            title="{mode === 'grid' ? 'グリッド表示' : mode === 'grouped' ? 'グループ表示' : 'コンパクト表示'}"
          >
            {getViewModeIcon(mode)}
          </button>
        {/each}
      </div>

      {#if showGrouping && viewMode === 'grouped'}
        <!-- グループ化方法選択 -->
        <select
          bind:value={groupBy}
          class="group-selector"
          aria-label="グループ化方法"
        >
          <option value="none">グループなし</option>
          <option value="fiscalYear">年度別</option>
          <option value="quarter">四半期別</option>
        </select>
      {/if}
    </div>
  </div>

  <!-- 統計情報パネル -->
  {#if showStats && selectedMonths.length > 0}
    <div class="stats-panel">
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">年度別選択状況</span>
          <div class="stat-bars">
            {#each Object.entries(selectionStats.fiscalYears) as [fyKey, stats]}
              <div class="stat-bar">
                <span class="bar-label">{fyKey}</span>
                <div class="bar-track">
                  <div 
                    class="bar-fill"
                    style="width: {(stats.selected / stats.total) * 100}%"
                  ></div>
                </div>
                <span class="bar-value">{stats.selected}/{stats.total}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- クイックアクション -->
  <div class="quick-actions">
    <button
      class="action-button primary"
      on:click={toggleAllMonths}
    >
      {selectedMonths.length === availableMonths.length ? '全解除' : '全選択'}
    </button>
    
    <div class="action-group">
      <button
        class="action-button"
        on:click={() => selectRecentMonths(3)}
      >
        直近3ヶ月
      </button>
      <button
        class="action-button"
        on:click={() => selectRecentMonths(6)}
      >
        直近6ヶ月
      </button>
      <button
        class="action-button"
        on:click={() => selectRecentMonths(12)}
      >
        直近12ヶ月
      </button>
    </div>

    {#if viewMode === 'grouped' && groupBy !== 'none'}
      <div class="group-actions">
        {#each Object.keys(groupedMonths) as groupKey}
          <button
            class="group-action-button"
            class:selected-all={getGroupSelectionState(groupKey) === 'all'}
            class:selected-partial={getGroupSelectionState(groupKey) === 'partial'}
            on:click={() => toggleGroup(groupKey)}
            title="{groupKey}を選択/解除"
          >
            <span class="group-checkbox">
              {getGroupSelectionState(groupKey) === 'all' ? '☑' : getGroupSelectionState(groupKey) === 'partial' ? '☐' : '☐'}
            </span>
            {groupKey}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 月選択グリッド -->
  {#if availableMonths.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📅</div>
      <h3 class="empty-title">助成期間が設定されていません</h3>
      <p class="empty-description">
        助成金に開始日と終了日を設定すると、自動的に月一覧が表示されます。
      </p>
    </div>
  {:else}
    <div 
      class="month-grid-container"
      class:view-grid={viewMode === 'grid'}
      class:view-grouped={viewMode === 'grouped'}
      class:view-compact={viewMode === 'compact'}
      on:keydown={handleKeyDown}
      role="grid"
      aria-label="月選択グリッド"
    >
      {#if viewMode === 'grid'}
        <!-- 標準グリッドビュー -->
        <div class="month-grid standard-grid">
          {#each availableMonths as month, index}
            <button
              class="month-cell-button"
              class:selected={isMonthSelected(month.key)}
              class:start-of-quarter={month.isStartOfQuarter}
              class:start-of-fiscal-year={month.isStartOfFiscalYear}
              on:click={(e) => handleMonthClick(e, month.key, index)}
              data-month-key={month.key}
              tabindex={currentFocusIndex === index ? 0 : -1}
              role="gridcell"
              aria-selected={isMonthSelected(month.key)}
              aria-label="{month.label}"
            >
              <div class="month-cell-content">
                <span class="month-year">{month.year}</span>
                <span class="month-number">{month.displayName}</span>
                {#if month.isStartOfFiscalYear}
                  <span class="month-badge fiscal-year">年度開始</span>
                {/if}
                {#if month.isStartOfQuarter}
                  <span class="month-badge quarter">Q{month.fiscalQuarter}</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>

      {:else if viewMode === 'grouped'}
        <!-- グループ化ビュー -->
        <div class="grouped-container">
          {#each Object.entries(groupedMonths) as [groupKey, months]}
            <div class="month-group">
              <div class="group-header">
                <button
                  class="group-toggle"
                  on:click={() => toggleGroup(groupKey)}
                  aria-label="{groupKey}を選択/解除"
                >
                  <span class="group-checkbox-large">
                    {getGroupSelectionState(groupKey) === 'all' ? '☑' : getGroupSelectionState(groupKey) === 'partial' ? '☐' : '☐'}
                  </span>
                  <span class="group-title">{groupKey}</span>
                  <span class="group-count">
                    ({months.filter(m => isMonthSelected(m.key)).length}/{months.length})
                  </span>
                </button>
              </div>
              <div class="month-grid group-grid">
                {#each months as month, index}
                  <button
                    class="month-cell-button grouped"
                    class:selected={isMonthSelected(month.key)}
                    on:click={(e) => handleMonthClick(e, month.key, index)}
                    data-month-key={month.key}
                    role="gridcell"
                    aria-selected={isMonthSelected(month.key)}
                    aria-label="{month.label}"
                  >
                    <span class="month-compact">{month.month}月</span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>

      {:else if viewMode === 'compact'}
        <!-- コンパクトビュー -->
        <div class="month-grid compact-grid">
          {#each availableMonths as month, index}
            <button
              class="month-cell-button compact"
              class:selected={isMonthSelected(month.key)}
              on:click={(e) => handleMonthClick(e, month.key, index)}
              data-month-key={month.key}
              tabindex={currentFocusIndex === index ? 0 : -1}
              role="gridcell"
              aria-selected={isMonthSelected(month.key)}
              aria-label="{month.label}"
              title="{month.label}"
            >
              <span class="compact-month">{month.month}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- キーボードショートカットのヒント -->
  {#if enableKeyboardNavigation}
    <div class="keyboard-hint">
      <span class="hint-icon">⌨️</span>
      <span class="hint-text">
        矢印キーで移動、Space/Enterで選択、Shift+クリックで範囲選択
      </span>
    </div>
  {/if}
</div>

<style>
  /* コンテナとベース構造 */
  .month-selector {
    @apply bg-white rounded-lg border border-gray-200 shadow-sm;
    padding: 1.5rem;
  }

  /* ヘッダー部分 */
  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .selector-title {
    @apply text-lg font-semibold text-gray-900;
    margin: 0;
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    @apply text-sm text-gray-600;
  }

  .selected-count {
    @apply font-semibold text-blue-600;
  }

  .total-count {
    @apply font-medium;
  }

  .selection-percentage {
    @apply text-xs text-gray-500;
  }

  /* コントロール部分 */
  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .control-button {
    @apply px-3 py-1.5 text-sm border border-gray-300 rounded-md;
    @apply hover:bg-gray-50 transition-colors;
  }

  .control-button.active {
    @apply bg-blue-50 border-blue-300 text-blue-700;
  }

  .view-mode-selector {
    display: flex;
    @apply bg-gray-100 rounded-lg p-1;
  }

  .view-mode-button {
    @apply px-3 py-1.5 text-sm rounded-md transition-all;
    @apply hover:bg-gray-200;
    font-family: monospace;
  }

  .view-mode-button.active {
    @apply bg-white shadow-sm;
  }

  .group-selector {
    @apply px-3 py-1.5 text-sm border border-gray-300 rounded-md;
    @apply focus:outline-none focus:ring-2 focus:ring-blue-500;
  }

  /* 統計パネル */
  .stats-panel {
    @apply bg-gray-50 rounded-lg p-4 mb-4;
  }

  .stats-grid {
    display: grid;
    gap: 1rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stat-label {
    @apply text-sm font-medium text-gray-700;
  }

  .stat-bars {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stat-bar {
    display: grid;
    grid-template-columns: 100px 1fr 60px;
    align-items: center;
    gap: 0.5rem;
  }

  .bar-label {
    @apply text-xs text-gray-600;
  }

  .bar-track {
    @apply bg-gray-200 rounded-full h-2 relative overflow-hidden;
  }

  .bar-fill {
    @apply bg-blue-500 h-full rounded-full transition-all duration-300;
  }

  .bar-value {
    @apply text-xs text-gray-600 text-right;
  }

  /* クイックアクション */
  .quick-actions {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .action-button {
    @apply px-4 py-2 text-sm font-medium rounded-md;
    @apply bg-gray-100 text-gray-700 hover:bg-gray-200;
    @apply transition-colors;
  }

  .action-button.primary {
    @apply bg-blue-600 text-white hover:bg-blue-700;
  }

  .action-group {
    display: flex;
    gap: 0.5rem;
    @apply bg-gray-50 rounded-md p-1;
  }

  .group-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .group-action-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    @apply px-3 py-1.5 text-sm rounded-md;
    @apply bg-white border border-gray-300;
    @apply hover:bg-gray-50 transition-colors;
  }

  .group-action-button.selected-all {
    @apply bg-blue-50 border-blue-300 text-blue-700;
  }

  .group-action-button.selected-partial {
    @apply bg-blue-50/50 border-blue-200;
  }

  /* メイングリッドコンテナ */
  .month-grid-container {
    position: relative;
    min-height: 200px;
  }

  /* CSS Grid レイアウト - 標準グリッド */
  .month-grid {
    display: grid;
    gap: 0.75rem;
  }

  .standard-grid {
    /* レスポンシブグリッド: デスクトップ3列、タブレット2列、モバイル1列 */
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  @media (min-width: 1024px) {
    .standard-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 640px) and (max-width: 1023px) {
    .standard-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 639px) {
    .standard-grid {
      grid-template-columns: 1fr;
    }
  }

  /* グループ化ビュー用グリッド */
  .grouped-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .month-group {
    @apply border border-gray-200 rounded-lg p-4;
  }

  .group-header {
    margin-bottom: 1rem;
  }

  .group-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    @apply text-sm font-medium text-gray-700;
    @apply hover:text-gray-900 transition-colors;
  }

  .group-checkbox-large {
    font-size: 1.25rem;
  }

  .group-title {
    @apply font-semibold;
  }

  .group-count {
    @apply text-gray-500;
  }

  .group-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }

  /* コンパクトビュー用グリッド */
  .compact-grid {
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 0.5rem;
  }

  @media (min-width: 640px) {
    .compact-grid {
      grid-template-columns: repeat(6, 1fr);
    }
  }

  /* 月セルボタン */
  .month-cell-button {
    @apply relative rounded-lg border-2 transition-all duration-200;
    @apply hover:shadow-md hover:scale-105;
    @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
    padding: 0.75rem;
    background: white;
    border-color: #e5e7eb;
    cursor: pointer;
  }

  .month-cell-button.selected {
    @apply bg-blue-50 border-blue-500;
  }

  .month-cell-button.start-of-quarter {
    border-left-width: 4px;
    border-left-color: #10b981;
  }

  .month-cell-button.start-of-fiscal-year {
    border-top-width: 4px;
    border-top-color: #f59e0b;
  }

  .month-cell-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .month-year {
    @apply text-xs text-gray-500;
  }

  .month-number {
    @apply text-lg font-bold text-gray-900;
  }

  .month-cell-button.selected .month-number {
    @apply text-blue-700;
  }

  .month-badge {
    @apply text-xs px-2 py-0.5 rounded-full;
  }

  .month-badge.fiscal-year {
    @apply bg-amber-100 text-amber-700;
  }

  .month-badge.quarter {
    @apply bg-green-100 text-green-700;
  }

  /* グループ化ビューの月セル */
  .month-cell-button.grouped {
    padding: 0.5rem;
  }

  .month-compact {
    @apply text-sm font-medium;
  }

  /* コンパクトビューの月セル */
  .month-cell-button.compact {
    padding: 0.5rem;
    min-width: 50px;
  }

  .compact-month {
    @apply text-sm font-bold;
  }

  /* 空状態 */
  .empty-state {
    @apply text-center py-12;
  }

  .empty-icon {
    @apply text-5xl mb-4;
  }

  .empty-title {
    @apply text-lg font-medium text-gray-900 mb-2;
  }

  .empty-description {
    @apply text-sm text-gray-500;
  }

  /* キーボードヒント */
  .keyboard-hint {
    @apply mt-4 pt-4 border-t border-gray-200;
    @apply text-xs text-gray-500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hint-icon {
    font-size: 1rem;
  }

  /* アニメーション */
  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }

  .month-cell-button:active {
    animation: pulse 0.2s ease-in-out;
  }

  /* アクセシビリティ向上 */
  @media (prefers-reduced-motion: reduce) {
    .month-cell-button {
      transition: none;
    }
    .month-cell-button:hover {
      transform: none;
    }
    .month-cell-button:active {
      animation: none;
    }
  }

  /* ダークモード対応（オプション） */
  @media (prefers-color-scheme: dark) {
    .month-selector {
      @apply bg-gray-800 border-gray-700;
    }
    
    .selector-title {
      @apply text-gray-100;
    }
    
    .month-cell-button {
      @apply bg-gray-800 border-gray-600;
    }
    
    .month-cell-button:hover {
      @apply bg-gray-700;
    }
    
    .month-cell-button.selected {
      @apply bg-blue-900 border-blue-600;
    }
  }
</style>