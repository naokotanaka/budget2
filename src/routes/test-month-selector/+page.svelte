<script lang="ts">
  import MonthSelector from '$lib/components/MonthSelector.svelte';
  
  // テスト用の助成金データ
  const testGrants = [
    {
      id: 1,
      name: '令和6年度助成金A',
      startDate: '2024-04-01',
      endDate: '2025-03-31'
    },
    {
      id: 2,
      name: '令和6年度助成金B',
      startDate: '2024-07-01',
      endDate: '2025-06-30'
    },
    {
      id: 3,
      name: '令和7年度助成金C',
      startDate: '2025-01-01',
      endDate: '2025-12-31'
    }
  ];
  
  let selectedMonths: string[] = [];
  
  function handleMonthsChange(event: CustomEvent<string[]>) {
    console.log('選択された月:', event.detail);
    selectedMonths = event.detail;
  }
</script>

<div class="container mx-auto p-8">
  <h1 class="text-2xl font-bold mb-8">MonthSelector コンポーネント テスト</h1>
  
  <div class="mb-8">
    <h2 class="text-lg font-semibold mb-4">テスト情報</h2>
    <div class="bg-gray-100 p-4 rounded-lg">
      <p class="text-sm mb-2">
        <strong>助成金数:</strong> {testGrants.length}件
      </p>
      <p class="text-sm mb-2">
        <strong>期間:</strong> 2024年4月 〜 2025年12月
      </p>
      <p class="text-sm">
        <strong>選択中の月数:</strong> {selectedMonths.length}月
      </p>
      {#if selectedMonths.length > 0}
        <div class="mt-2">
          <strong class="text-sm">選択された月:</strong>
          <div class="flex flex-wrap gap-2 mt-2">
            {#each selectedMonths as month}
              <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                {month}
              </span>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="space-y-8">
    <!-- デフォルト設定 -->
    <section>
      <h3 class="text-lg font-semibold mb-4">1. デフォルト設定（全機能有効）</h3>
      <MonthSelector 
        grants={testGrants}
        bind:selectedMonths
        on:change={handleMonthsChange}
      />
    </section>
    
    <!-- グループ化無効 -->
    <section>
      <h3 class="text-lg font-semibold mb-4">2. グループ化機能無効</h3>
      <MonthSelector 
        grants={testGrants}
        bind:selectedMonths
        showGrouping={false}
        title="シンプルな月選択"
        on:change={handleMonthsChange}
      />
    </section>
    
    <!-- キーボードナビゲーション無効 -->
    <section>
      <h3 class="text-lg font-semibold mb-4">3. キーボードナビゲーション無効</h3>
      <MonthSelector 
        grants={testGrants}
        bind:selectedMonths
        enableKeyboardNavigation={false}
        title="マウス操作のみ"
        on:change={handleMonthsChange}
      />
    </section>
    
    <!-- 空の状態 -->
    <section>
      <h3 class="text-lg font-semibold mb-4">4. 助成金データなし（空の状態）</h3>
      <MonthSelector 
        grants={[]}
        bind:selectedMonths
        title="データなし"
        on:change={handleMonthsChange}
      />
    </section>
  </div>
</div>

<style>
  :global(body) {
    background-color: #f9fafb;
  }
</style>