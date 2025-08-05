<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { getPeriodColor, getAmountColor } from '$lib/utils/color-rules';

  interface Grant {
    id: number;
    name: string;
    grantCode?: string;
    totalAmount?: number;
    startDate?: string;
    endDate?: string;
    status: 'in_progress' | 'completed' | 'reported';
    budgetItemsCount?: number;
    usedAmount?: number;
  }

  interface BudgetItem {
    id: number;
    name: string;
    category?: string;
    budgetedAmount?: number;
    usedAmount?: number;
    note?: string;
  }

  let grants: Grant[] = [];
  let selectedGrant: Grant | null = null;
  let budgetItems: BudgetItem[] = [];
  let allBudgetItems: BudgetItem[] = []; // 全予算項目（フィルタリング前）
  let loading = false;
  let error = '';
  let showGrantForm = false;
  let showBudgetItemForm = false;
  let showCompletedGrants = false; // 終了・報告済み表示切り替え
  let filterYear = ''; // 年度フィルター

  // 新規・編集用フォームデータ
  let grantForm: Partial<Grant> = {};
  let budgetItemForm: Partial<BudgetItem> = {};

  const statusLabels = {
    in_progress: '進行中',
    completed: '終了',
    reported: '報告済み'
  };

  const statusColors = {
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-yellow-100 text-yellow-800',
    reported: 'bg-green-100 text-green-800'
  };

  onMount(() => {
    loadGrants();
    loadAllBudgetItems();
    
    // 外クリックでドロップダウンを閉じる
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  async function loadGrants() {
    loading = true;
    try {
      const response = await fetch(`${base}/api/grants`);
      const data = await response.json();
      
      if (data.success) {
        grants = data.grants || [];
      } else {
        error = data.error || '助成金データの取得に失敗しました';
      }
    } catch (err) {
      error = '助成金データの取得中にエラーが発生しました';
      console.error('Load grants error:', err);
    } finally {
      loading = false;
    }
  }

  function selectGrant(grant: Grant) {
    if (selectedGrant?.id === grant.id) {
      // 同じ助成金をクリックした場合は絞り込みを解除
      selectedGrant = null;
      budgetItems = getFilteredBudgetItems(allBudgetItems);
    } else {
      // 助成金で絞り込み
      selectedGrant = grant;
      budgetItems = getFilteredBudgetItems(allBudgetItems.filter(item => item.grantId === grant.id));
    }
  }

  // 終了・報告ステータスを除外するフィルター関数
  function getFilteredBudgetItems(items: any[]) {
    return items.filter(item => item.grant?.status !== 'completed' && item.grant?.status !== 'reported');
  }

  async function loadBudgetItems(grantId: number) {
    try {
      const response = await fetch(`${base}/api/grants/${grantId}/budget-items`);
      const data = await response.json();
      
      if (data.success) {
        budgetItems = data.budgetItems || [];
      } else {
        error = data.error || '予算項目の取得に失敗しました';
      }
    } catch (err) {
      error = '予算項目の取得中にエラーが発生しました';
      console.error('Load budget items error:', err);
    }
  }

  async function loadAllBudgetItems() {
    try {
      const response = await fetch(`${base}/api/budget-items`);
      const data = await response.json();
      
      if (data.success) {
        allBudgetItems = data.budgetItems || [];
        // 初期表示は全項目（終了・報告ステータス除く）
        if (!selectedGrant) {
          budgetItems = getFilteredBudgetItems(allBudgetItems);
        }
        console.log('全予算項目取得完了:', allBudgetItems.length, '件');
      } else {
        error = data.error || '予算項目の取得に失敗しました';
      }
    } catch (err) {
      error = '予算項目の読み込み中にエラーが発生しました';
      console.error('Load all budget items error:', err);
    }
  }

  function openGrantForm(grant?: Grant) {
    if (grant) {
      grantForm = {
        ...grant,
        startDate: formatDateForInput(grant.startDate),
        endDate: formatDateForInput(grant.endDate)
      };
    } else {
      grantForm = { status: 'in_progress' };
    }
    showGrantForm = true;
  }

  async function openBudgetItemForm(budgetItem?: BudgetItem) {
    budgetItemForm = budgetItem ? { ...budgetItem } : {};
    
    if (budgetItem?.id) {
      // 既存項目の場合、スケジュールデータを読み込み
      await loadBudgetItemSchedule(budgetItem.id);
    } else {
      // 新規作成時は全月をデフォルトでチェック
      if (availableMonths.length > 0) {
        selectedMonths = new Set(availableMonths.map(m => getMonthKey(m.year, m.month)));
      } else {
        selectedMonths.clear();
      }
    }
    
    showBudgetItemForm = true;
  }

  async function loadBudgetItemSchedule(budgetItemId: number) {
    try {
      const response = await fetch(`${base}/api/budget-items/${budgetItemId}/schedule`);
      if (response.ok) {
        const data = await response.json();
        selectedMonths = new Set(data.schedules.map((s: any) => getMonthKey(s.year, s.month)));
      }
    } catch (err) {
      console.log('スケジュールデータなし:', err);
      selectedMonths.clear();
    }
  }

  async function saveGrant() {
    try {
      const url = grantForm.id ? `${base}/api/grants/${grantForm.id}` : `${base}/api/grants`;
      const method = grantForm.id ? 'PUT' : 'POST';
      
      // 日付フィールドを適切な形式に変換してから送信
      const formData = {
        ...grantForm,
        startDate: formatDateForAPI(grantForm.startDate),
        endDate: formatDateForAPI(grantForm.endDate)
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showGrantForm = false;
        await loadGrants();
      } else {
        error = data.error || '助成金の保存に失敗しました';
      }
    } catch (err) {
      error = '助成金の保存中にエラーが発生しました';
      console.error('Save grant error:', err);
    }
  }

  async function saveBudgetItem() {
    if (!selectedGrant) return;
    
    try {
      const url = budgetItemForm.id ? 
        `${base}/api/grants/${selectedGrant.id}/budget-items/${budgetItemForm.id}` : 
        `${base}/api/grants/${selectedGrant.id}/budget-items`;
      const method = budgetItemForm.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetItemForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // スケジュールデータも保存
        if (data.budgetItem?.id) {
          await saveBudgetItemSchedule(data.budgetItem.id);
        }
        
        showBudgetItemForm = false;
        await loadAllBudgetItems();
        // 絞り込み状態を維持
        if (selectedGrant) {
          budgetItems = getFilteredBudgetItems(allBudgetItems.filter(item => item.grantId === selectedGrant.id));
        }
      } else {
        error = data.error || '予算項目の保存に失敗しました';
      }
    } catch (err) {
      error = '予算項目の保存中にエラーが発生しました';
      console.error('Save budget item error:', err);
    }
  }

  async function saveBudgetItemSchedule(budgetItemId: number) {
    try {
      const schedules = Array.from(selectedMonths).map(monthKey => {
        const [year, month] = monthKey.split('-');
        return {
          year: parseInt(year),
          month: parseInt(month),
          isActive: true
        };
      });

      const response = await fetch(`${base}/api/budget-items/${budgetItemId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules })
      });

      if (!response.ok) {
        console.error('スケジュール保存失敗');
      }
    } catch (err) {
      console.error('スケジュール保存エラー:', err);
    }
  }

  // 複数条件ソート機能
  let sortCriteria: Array<{field: string, direction: 'asc' | 'desc', priority: number}> = [];

  // カテゴリ管理
  let availableCategories: string[] = [];
  let showCategoryDropdown = false;

  // 月別スケジュール管理
  let availableMonths: Array<{year: number, month: number, label: string}> = [];
  let selectedMonths: Set<string> = new Set(); // "2025-04" 形式
  
  // 既存の予算項目からカテゴリを取得
  function updateAvailableCategories() {
    const categories = new Set<string>();
    budgetItems.forEach(item => {
      if (item.category && item.category.trim()) {
        categories.add(item.category.trim());
      }
    });
    availableCategories = Array.from(categories).sort();
  }
  
  // 予算項目が変更された時にカテゴリを更新
  $: if (budgetItems.length > 0) {
    updateAvailableCategories();
  }
  
  function selectCategory(category: string) {
    budgetItemForm.category = category;
    showCategoryDropdown = false;
  }
  
  function filterCategories(input: string) {
    if (!input) return availableCategories;
    return availableCategories.filter(cat => 
      cat.toLowerCase().includes(input.toLowerCase())
    );
  }
  
  // ドロップダウン外クリックで閉じる
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.category-dropdown')) {
      showCategoryDropdown = false;
    }
  }

  // 助成金期間から利用可能な月を生成
  function generateAvailableMonths(grant: any) {
    if (!grant?.startDate || !grant?.endDate) {
      availableMonths = [];
      return;
    }

    const startDate = new Date(grant.startDate);
    const endDate = new Date(grant.endDate);
    const months = [];

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      months.push({
        year,
        month,
        label: `${year.toString().slice(-2)}/${month.toString().padStart(2, '0')}`
      });
      current.setMonth(current.getMonth() + 1);
    }

    availableMonths = months;
  }

  // 選択中の助成金が変更された時に利用可能月を更新
  $: if (selectedGrant) {
    generateAvailableMonths(selectedGrant);
    // 新規作成時（既存データがない場合）は全月をデフォルトでチェック  
    if (!budgetItemForm.id && availableMonths.length > 0) {
      selectedMonths = new Set(availableMonths.map(m => getMonthKey(m.year, m.month)));
    }
  }

  function toggleMonth(yearMonth: string) {
    if (selectedMonths.has(yearMonth)) {
      selectedMonths.delete(yearMonth);
    } else {
      selectedMonths.add(yearMonth);
    }
    selectedMonths = new Set(selectedMonths); // リアクティブ更新
  }

  function getMonthKey(year: number, month: number): string {
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  function selectAllMonths() {
    selectedMonths = new Set(availableMonths.map(m => getMonthKey(m.year, m.month)));
  }

  function clearAllMonths() {
    selectedMonths = new Set();
  }

  // 予算項目の選択月を表示用に取得
  let budgetItemSchedules = new Map(); // budgetItemId -> schedules

  async function loadBudgetItemSchedules() {
    budgetItemSchedules.clear();
    
    for (const item of budgetItems) {
      try {
        const response = await fetch(`${base}/api/budget-items/${item.id}/schedule`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.schedules.length > 0) {
            const months = data.schedules.map(s => `${s.year.toString().slice(-2)}/${s.month.toString().padStart(2, '0')}`);
            budgetItemSchedules.set(item.id, months);
          }
        }
      } catch (err) {
        // スケジュールデータがない場合は無視
      }
    }
    budgetItemSchedules = new Map(budgetItemSchedules); // リアクティブ更新
  }

  // 予算項目が変更されたときにスケジュールを読み込み
  $: if (budgetItems.length > 0) {
    loadBudgetItemSchedules();
  }
  
  function toggleSort(field: string) {
    const existingIndex = sortCriteria.findIndex(s => s.field === field);
    
    if (existingIndex >= 0) {
      // 既存の条件がある場合は方向を切り替え
      const existing = sortCriteria[existingIndex];
      if (existing.direction === 'asc') {
        existing.direction = 'desc';
      } else {
        // 降順から再度クリックで削除
        sortCriteria.splice(existingIndex, 1);
      }
    } else {
      // 新しい条件を追加
      const newPriority = sortCriteria.length > 0 ? Math.max(...sortCriteria.map(s => s.priority)) + 1 : 1;
      sortCriteria.push({
        field,
        direction: 'asc',
        priority: newPriority
      });
    }
    
    // 優先度順にソート条件を並び替え
    sortCriteria.sort((a, b) => a.priority - b.priority);
    
    // Svelteのリアクティブ更新のために新しい配列を作成
    sortCriteria = [...sortCriteria];
    
    sortBudgetItems();
  }
  
  function sortBudgetItems() {
    if (sortCriteria.length === 0) return;
    
    budgetItems.sort((a, b) => {
      for (const criterion of sortCriteria) {
        let aValue: any, bValue: any;
        
        switch (criterion.field) {
          case 'grantName':
            aValue = (a.grantName || '').toLowerCase();
            bValue = (b.grantName || '').toLowerCase();
            break;
          case 'name':
            aValue = (a.name || '').toLowerCase();
            bValue = (b.name || '').toLowerCase();
            break;
          case 'category':
            aValue = (a.category || '').toLowerCase();
            bValue = (b.category || '').toLowerCase();
            break;
          case 'budgetedAmount':
            aValue = a.budgetedAmount || 0;
            bValue = b.budgetedAmount || 0;
            break;
          case 'usedAmount':
            aValue = a.usedAmount || 0;
            bValue = b.usedAmount || 0;
            break;
          case 'remainingAmount':
            aValue = (a.budgetedAmount || 0) - (a.usedAmount || 0);
            bValue = (b.budgetedAmount || 0) - (b.usedAmount || 0);
            break;
          default:
            continue;
        }
        
        if (aValue < bValue) return criterion.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return criterion.direction === 'asc' ? 1 : -1;
        // 同じ値の場合は次の条件で比較
      }
      return 0;
    });
    
    budgetItems = [...budgetItems]; // リアクティブ更新
  }
  
  function getSortIcon(field: string) {
    const criterion = sortCriteria.find(s => s.field === field);
    if (!criterion) return '';
    
    const icon = criterion.direction === 'asc' ? '▲' : '▼';
    return `${icon}${criterion.priority}`;
  }
  
  function getSortClass(field: string) {
    const criterion = sortCriteria.find(s => s.field === field);
    if (criterion) {
      return 'bg-blue-100 text-blue-800';
    }
    return '';
  }
  
  function clearSort() {
    sortCriteria = [];
    // データを元の順序に戻す（サーバーから再読み込み）
    if (selectedGrant) {
      loadBudgetItems(selectedGrant.id);
    }
  }

  function formatAmount(amount?: number): string {
    if (!amount) return '¥0';
    return `¥${amount.toLocaleString()}`;
  }

  // ISO文字列をYYYY-MM-DD形式に変換（HTML input[type="date"]用）
  function formatDateForInput(dateString?: string): string {
    if (!dateString) return '';
    return dateString.split('T')[0]; // '2025-04-01T00:00:00.000Z' -> '2025-04-01'
  }

  // YYYY-MM-DD形式をISO文字列に変換（API送信用）
  function formatDateForAPI(dateString?: string): string | undefined {
    if (!dateString) return undefined;
    return dateString; // input[type="date"]は既にYYYY-MM-DD形式なのでそのまま
  }

  function calculateProgress(used?: number, total?: number): number {
    if (!total || total === 0) return 0;
    return Math.round((used || 0) / total * 100);
  }

  // 完了済み助成金の年度フィルタリング
  function getFilteredCompletedGrants(grants: Grant[]): Grant[] {
    const completedGrants = grants.filter(g => g.status === 'completed' || g.status === 'reported');
    
    if (!filterYear) {
      return completedGrants;
    }
    
    return completedGrants.filter(grant => {
      if (!grant.endDate) return false;
      const endYear = new Date(grant.endDate).getFullYear();
      return endYear.toString() === filterYear;
    });
  }

  // 利用可能な年度を取得
  function getAvailableYears(grants: Grant[]): string[] {
    const years = new Set<string>();
    grants
      .filter(g => g.status === 'completed' || g.status === 'reported')
      .forEach(grant => {
        if (grant.endDate) {
          const year = new Date(grant.endDate).getFullYear().toString();
          years.add(year);
        }
      });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)); // 新しい年順
  }

</script>

<svelte:head>
  <title>助成金管理 - nagaiku budget</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold text-gray-900">助成金管理</h1>
    <button 
      on:click={() => openGrantForm()}
      class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
      新規助成金
    </button>
  </div>

  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {error}
    </div>
  {/if}

  <!-- 上部: 助成金一覧 -->
  <div class="bg-white shadow rounded-lg mb-2">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">助成金一覧</h2>
        
        <!-- フィルターコントロール -->
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="showCompleted" 
              bind:checked={showCompletedGrants}
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label for="showCompleted" class="text-sm font-medium text-gray-700">
              終了・報告済みを表示
            </label>
          </div>
          
          {#if showCompletedGrants && getAvailableYears(grants).length > 0}
            <div class="flex items-center gap-2">
              <label for="yearFilter" class="text-sm text-gray-600">年度:</label>
              <select 
                id="yearFilter"
                bind:value={filterYear}
                class="text-sm border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value="">全て</option>
                {#each getAvailableYears(grants) as year}
                  <option value={year}>{year}年</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <div class="p-6">
      
      {#if loading}
        <div class="flex justify-center items-center h-32">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      {:else if grants.length === 0}
        <div class="text-center text-gray-500 py-8">
          <p>助成金が登録されていません</p>
          <button 
            on:click={() => openGrantForm()}
            class="mt-2 text-blue-600 hover:text-blue-800"
          >
            最初の助成金を作成
          </button>
        </div>
      {:else}
        <!-- 稼働中の助成金（水平スクロール） -->
        {#if grants.filter(g => g.status === 'in_progress').length > 0}
          <div>
            <div class="flex gap-4 overflow-x-auto" style="height: 200px;">
              {#each grants.filter(g => g.status === 'in_progress') as grant}
                <div 
                  class="border rounded-lg px-3 py-2 hover:shadow-md transition-shadow {selectedGrant?.id === grant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} flex-shrink-0 w-80 h-24 relative group"
                >
                  <div 
                    class="cursor-pointer h-full"
                    on:click={() => selectGrant(grant)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && selectGrant(grant)}
                  >
                    <!-- 1行目: 助成金コード + 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
                    <div class="flex justify-between items-start mb-1">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        {#if grant.grantCode}
                          <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {grant.grantCode}
                          </span>
                        {/if}
                        <h3 class="font-semibold text-sm truncate">{grant.name}</h3>
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <span class="px-1.5 py-0.5 rounded text-xs font-medium {statusColors[grant.status]}">
                          {statusLabels[grant.status]}
                        </span>
                        <button 
                          on:click|stopPropagation={() => openGrantForm(grant)}
                          class="px-2 py-1 hover:bg-gray-200 rounded text-xs text-gray-500 hover:text-gray-700"
                        >
                          編集
                        </button>
                      </div>
                    </div>

                    <!-- 2行目: 期間 + 予算額 -->
                    <div class="flex justify-between items-center mb-1 text-xs">
                      <div class="{getPeriodColor(grant.endDate)}">
                        {#if grant.startDate && grant.endDate}
                          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
                        {:else}
                          期間未設定
                        {/if}
                      </div>
                      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
                    </div>

                    <!-- 3行目: 使用額 + 残額 -->
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
              {/each}
            </div>
          </div>
        {/if}

        <!-- 終了・報告済みの助成金 -->
        {#if showCompletedGrants}
          {@const filteredCompletedGrants = getFilteredCompletedGrants(grants)}
          {#if filteredCompletedGrants.length > 0}
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                終了・報告済み
                <span class="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                  {filteredCompletedGrants.length}件
                </span>
              </h3>
              <div class="flex gap-4 overflow-x-auto" style="height: 200px;">
                {#each filteredCompletedGrants as grant}
                <div 
                  class="border rounded-lg px-3 py-2 hover:shadow-md transition-shadow {selectedGrant?.id === grant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} opacity-75 flex-shrink-0 w-80 h-24 relative group"
                >
                  <div 
                    class="cursor-pointer h-full"
                    on:click={() => selectGrant(grant)}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && selectGrant(grant)}
                  >
                    <!-- 1行目: 助成金コード + 助成金名 + ステータス（右上）+ 編集ボタン（右） -->
                    <div class="flex justify-between items-start mb-1">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        {#if grant.grantCode}
                          <span class="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {grant.grantCode}
                          </span>
                        {/if}
                        <h3 class="font-semibold text-sm truncate">{grant.name}</h3>
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <span class="px-1.5 py-0.5 rounded text-xs font-medium {statusColors[grant.status]}">
                          {statusLabels[grant.status]}
                        </span>
                        <button 
                          on:click|stopPropagation={() => openGrantForm(grant)}
                          class="px-2 py-1 hover:bg-gray-200 rounded text-xs text-gray-500 hover:text-gray-700"
                        >
                          編集
                        </button>
                      </div>
                    </div>

                    <!-- 2行目: 期間 + 予算額 -->
                    <div class="flex justify-between items-center mb-1 text-xs">
                      <div class="{getPeriodColor(grant.endDate)}">
                        {#if grant.startDate && grant.endDate}
                          {new Date(grant.startDate).toLocaleDateString()} 〜 {new Date(grant.endDate).toLocaleDateString()}
                        {:else}
                          期間未設定
                        {/if}
                      </div>
                      <div class="font-medium text-gray-900">{formatAmount(grant.totalAmount)}</div>
                    </div>

                    <!-- 3行目: 使用額 + 残額 -->
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
                {/each}
              </div>
            </div>
          {/if}
        {/if}
      {/if}
    </div>

  </div>

  <!-- 下部: 予算項目管理 -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-4">
          <h2 class="text-xl font-semibold">予算項目</h2>
          <button 
            on:click={() => selectedGrant && openBudgetItemForm()}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium {selectedGrant ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
            disabled={!selectedGrant}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            追加
          </button>
        </div>
        
        <div class="flex items-center gap-6">
          {#if selectedGrant}
            <div class="text-right">
              <p class="text-sm text-gray-600">
                <span class="font-medium text-blue-600">{selectedGrant.name}</span> で絞り込み中
                <button 
                  on:click={() => selectGrant(selectedGrant)}
                  class="ml-2 text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  解除
                </button>
              </p>
            </div>
          {/if}
          
          {#if budgetItems.length > 0}
            <div class="text-right">
              <p class="text-sm text-gray-600">予算合計 ({budgetItems.length}件)</p>
              <p class="text-lg font-bold text-blue-600">
                {formatAmount(budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0))}
              </p>
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <div class="p-4">
          
          <!-- ソートリセットボタン -->
          {#if budgetItems.length > 0 && sortCriteria.length > 0}
            <div class="mb-3 text-right">
              <button 
                on:click={clearSort}
                class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 border rounded-md transition-colors"
              >
                ソートをリセット
              </button>
            </div>
          {/if}
          
          {#if budgetItems.length === 0}
            <div class="text-center text-gray-500 py-8">
              <div class="mb-4">
                <svg class="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
              <p class="text-lg font-medium text-gray-600 mb-2">予算項目がありません</p>
              <p class="text-sm text-gray-500 mb-4">上の「追加」ボタンから最初の予算項目を作成してください</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors {getSortClass('grantName')}"
                        on:click={() => toggleSort('grantName')}>
                      <div class="flex items-center justify-between">
                        助成金
                        <span class="text-blue-600 font-bold text-sm">{getSortIcon('grantName')}</span>
                      </div>
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors {getSortClass('name')}" 
                        on:click={() => toggleSort('name')}>
                      <div class="flex items-center justify-between">
                        項目名
                        <span class="text-blue-600 font-bold text-sm">{getSortIcon('name')}</span>
                      </div>
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors {getSortClass('category')}"
                        on:click={() => toggleSort('category')}>
                      <div class="flex items-center justify-between">
                        カテゴリ
                        <span class="text-blue-600 font-bold text-sm">{getSortIcon('category')}</span>
                      </div>
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors {getSortClass('budgetedAmount')}"
                        on:click={() => toggleSort('budgetedAmount')}>
                      <div class="flex items-center justify-end">
                        <span class="text-blue-600 font-bold text-sm mr-1">{getSortIcon('budgetedAmount')}</span>
                        予算額
                      </div>
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors {getSortClass('usedAmount')}"
                        on:click={() => toggleSort('usedAmount')}>
                      <div class="flex items-center justify-end">
                        <span class="text-blue-600 font-bold text-sm mr-1">{getSortIcon('usedAmount')}</span>
                        使用済み
                      </div>
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors {getSortClass('remainingAmount')}"
                        on:click={() => toggleSort('remainingAmount')}>
                      <div class="flex items-center justify-end">
                        <span class="text-blue-600 font-bold text-sm mr-1">{getSortIcon('remainingAmount')}</span>
                        残額
                      </div>
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">利用予定月</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each budgetItems as item, index}
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <div class="font-medium text-gray-900">{item.grantName || '-'}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">{item.name}</div>
                        {#if item.note}
                          <div class="text-sm text-gray-500">{item.note}</div>
                        {/if}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.category || '-'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatAmount(item.budgetedAmount)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatAmount(item.usedAmount)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span class="{getAmountColor((item.budgetedAmount || 0) - (item.usedAmount || 0), null, item.grantEndDate)}">
                          {formatAmount((item.budgetedAmount || 0) - (item.usedAmount || 0))}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600">
                        {#if budgetItemSchedules.has(item.id)}
                          <div class="flex flex-wrap gap-1">
                            {#each budgetItemSchedules.get(item.id) as month}
                              <span class="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {month}
                              </span>
                            {/each}
                          </div>
                        {:else}
                          <span class="text-gray-400">未設定</span>
                        {/if}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          on:click={() => openBudgetItemForm(item)}
                          class="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          編集
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
    </div>
  </div>

<!-- 助成金作成・編集モーダル -->
{#if showGrantForm}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        {grantForm.id ? '助成金編集' : '新規助成金作成'}
      </h3>
      
      <form on:submit|preventDefault={saveGrant}>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">助成金名 *</label>
          <input 
            type="text" 
            bind:value={grantForm.name}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: WAM補助金"
          />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">助成金コード</label>
          <input 
            type="text" 
            bind:value={grantForm.grantCode}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: WAM2025"
          />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">総額（円）</label>
          <input 
            type="number" 
            bind:value={grantForm.totalAmount}
            min="0"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="7000000"
          />
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">開始日</label>
            <input 
              type="date" 
              bind:value={grantForm.startDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">終了日</label>
            <input 
              type="date" 
              bind:value={grantForm.endDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">ステータス</label>
          <select 
            bind:value={grantForm.status}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="in_progress">進行中</option>
            <option value="completed">終了</option>
            <option value="reported">報告済み</option>
          </select>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button 
            type="button"
            on:click={() => showGrantForm = false}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            キャンセル
          </button>
          <button 
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 予算項目作成・編集モーダル -->
{#if showBudgetItemForm}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        {budgetItemForm.id ? '予算項目編集' : '新規予算項目作成'}
      </h3>
      
      <form on:submit|preventDefault={saveBudgetItem}>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">項目名 *</label>
          <input 
            type="text" 
            bind:value={budgetItemForm.name}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 消耗品費"
          />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
          <div class="relative category-dropdown">
            <input 
              type="text" 
              bind:value={budgetItemForm.category}
              on:focus={() => showCategoryDropdown = true}
              on:input={() => showCategoryDropdown = true}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 消耗品（入力またはドロップダウンから選択）"
            />
            
            {#if showCategoryDropdown && availableCategories.length > 0}
              <div class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {#each filterCategories(budgetItemForm.category || '') as category}
                  <button
                    type="button"
                    class="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    on:click={() => selectCategory(category)}
                  >
                    {category}
                  </button>
                {/each}
                
                {#if filterCategories(budgetItemForm.category || '').length === 0 && budgetItemForm.category}
                  <div class="px-3 py-2 text-gray-500 text-sm">
                    「{budgetItemForm.category}」で新規作成
                  </div>
                {/if}
              </div>
            {/if}
            
            {#if availableCategories.length === 0}
              <div class="mt-1 text-xs text-gray-500">
                新しいカテゴリを入力してください
              </div>
            {/if}
          </div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">予算額（円）</label>
          <input 
            type="number" 
            bind:value={budgetItemForm.budgetedAmount}
            min="0"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="498000"
          />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">備考</label>
          <textarea 
            bind:value={budgetItemForm.note}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="備考や説明を入力"
          ></textarea>
        </div>

        <!-- 月別スケジュール選択 -->
        {#if availableMonths.length > 0}
          <div class="mb-6">
            <div class="flex items-center justify-between mb-3">
              <label class="block text-sm font-medium text-gray-700">利用予定月</label>
              <div class="flex space-x-2">
                <button 
                  type="button" 
                  on:click={selectAllMonths}
                  class="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                >
                  全選択
                </button>
                <button 
                  type="button" 
                  on:click={clearAllMonths}
                  class="text-xs px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
                >
                  全解除
                </button>
              </div>
            </div>
            <p class="text-sm text-gray-500 mb-3">この予算項目を利用する予定の月をチェックしてください</p>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-4 bg-gray-50">
              {#each availableMonths as month}
                <label class="flex items-center space-x-2 text-sm cursor-pointer hover:bg-white rounded px-3 py-2 border border-transparent hover:border-gray-300 transition-all">
                  <input 
                    type="checkbox" 
                    checked={selectedMonths.has(getMonthKey(month.year, month.month))}
                    on:change={() => toggleMonth(getMonthKey(month.year, month.month))}
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  />
                  <span class="text-gray-700 font-medium min-w-0">{month.label}</span>
                </label>
              {/each}
            </div>
            
            {#if selectedMonths.size > 0}
              <div class="mt-2 text-sm text-blue-600">
                {selectedMonths.size}ヶ月選択中
              </div>
            {/if}
          </div>
        {:else}
          <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p class="text-sm text-yellow-800">
              助成金の期間が設定されていないため、月別スケジュールを選択できません。
            </p>
          </div>
        {/if}
        
        <div class="flex justify-end space-x-3">
          <button 
            type="button"
            on:click={() => showBudgetItemForm = false}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            キャンセル
          </button>
          <button 
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}