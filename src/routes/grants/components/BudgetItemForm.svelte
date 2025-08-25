<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { base } from '$app/paths';

  import type { Grant, BudgetItem } from '$lib/types/models';

  export let show: boolean = false;
  export let budgetItemForm: Partial<BudgetItem> = {};
  export let grants: Grant[] = [];
  export let budgetItems: BudgetItem[] = [];
  export let selectedMonths: Set<string> = new Set();
  
  // 月別予算額を管理する配列
  let monthlyBudgets: Array<{year: number, month: number, amount: number}> = [];

  const dispatch = createEventDispatcher();
  let error = '';
  let availableCategories: string[] = [];
  let showCategoryDropdown = false;
  let availableMonths: Array<{year: number, month: number, label: string, daysInMonth: number}> = [];
  let showDeleteConfirm = false;
  let deleteLoading = false;

  const statusLabels = {
    active: '進行中',
    completed: '終了',
    applied: '報告済み',
    reported: '報告済み'
  };

  // 月別予算額の合計を計算
  $: totalMonthlyBudget = monthlyBudgets.reduce((sum, item) => sum + (item.amount || 0), 0);

  // フォームで選択された助成金
  $: formGrant = grants.find(g => g.id === parseInt(String(budgetItemForm.grantId || '0')));
  
  // 助成金が選択されたら月リストを更新
  $: if (budgetItemForm.grantId && formGrant) {
    availableMonths = generateMonthsFromGrant(formGrant);
    // 月別予算配列を更新
    monthlyBudgets = availableMonths.map(month => ({
      year: month.year,
      month: month.month,
      amount: 0
    }));
    
    // 既存項目の場合はデータを読み込み
    if (budgetItemForm.id) {
      loadExistingMonthlyBudgets();
    }
  }

  onMount(() => {
    updateAvailableCategories();
    if (budgetItemForm.grantId) {
      updateAvailableMonths();
      // 既存の月別予算額を読み込む
      if (budgetItemForm.id) {
        loadExistingMonthlyBudgets();
      }
    }
  });
  
  // 既存の月別予算額を読み込む関数
  async function loadExistingMonthlyBudgets() {
    if (!budgetItemForm.id) return;
    
    // まず全月を0で初期化
    monthlyBudgets = availableMonths.map(month => ({
      year: month.year,
      month: month.month,
      amount: 0
    }));
    
    try {
      const response = await fetch(`${base}/api/budget-items/${budgetItemForm.id}/schedule`);
      if (response.ok) {
        const data = await response.json();
        if (data.schedules && Array.isArray(data.schedules)) {
          // スケジュールデータで上書き
          data.schedules.forEach((schedule: any) => {
            const monthlyItem = monthlyBudgets.find(item => 
              item.year === schedule.year && item.month === schedule.month
            );
            if (monthlyItem) {
              monthlyItem.amount = schedule.monthlyBudget || 0;
            }
          });
          // 強制的に再レンダリング
          monthlyBudgets = [...monthlyBudgets];
        }
      }
    } catch (err) {
      console.error('月別予算額の読み込みエラー:', err);
    }
  }

  // budgetItemsが更新されたらカテゴリも更新
  $: if (budgetItems) {
    updateAvailableCategories();
  }

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

  function updateAvailableMonths() {
    if (!budgetItemForm.grantId) {
      availableMonths = [];
      return;
    }

    const grant = grants.find(g => g.id === parseInt(String(budgetItemForm.grantId)));
    if (!grant) {
      availableMonths = [];
      return;
    }

    availableMonths = generateMonthsFromGrant(grant);
    
    // 月別予算を初期化（新規・編集両方で必要）
    monthlyBudgets = availableMonths.map(month => ({
      year: month.year,
      month: month.month,
      amount: 0
    }));
    
    // 既存項目の場合は、データ読み込み後に値が上書きされる
  }

  // 月別予算額を均等に配分する関数
  function distributeEquallyToMonths() {
    if (!budgetItemForm.budgetedAmount || !availableMonths.length) return;
    
    // 10日以上ある月のみフィルタリング
    const targetMonths = availableMonths.filter(month => month.daysInMonth >= 10);
    if (!targetMonths.length) {
      alert('10日以上ある月がありません');
      return;
    }
    
    const amountPerMonth = Math.floor(budgetItemForm.budgetedAmount / targetMonths.length);
    const remainder = budgetItemForm.budgetedAmount % targetMonths.length;
    
    // まず全ての月を0にリセット
    monthlyBudgets.forEach(item => {
      item.amount = 0;
    });
    
    // 10日以上ある月のみに配分
    targetMonths.forEach((month, index) => {
      const monthlyItem = monthlyBudgets.find(item => 
        item.year === month.year && item.month === month.month
      );
      if (monthlyItem) {
        // 余りを最初の月に追加
        monthlyItem.amount = amountPerMonth + (index === 0 ? remainder : 0);
      }
    });
    
    // 強制的に再レンダリング
    monthlyBudgets = [...monthlyBudgets];
  }
  
  function generateMonthsFromGrant(grant: Grant): Array<{year: number, month: number, label: string, daysInMonth: number}> {
    if (!grant.startDate || !grant.endDate) return [];
    
    const startDate = new Date(grant.startDate);
    const endDate = new Date(grant.endDate);
    const months = [];
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    
    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      
      // その月に何日間あるか計算
      let monthStart = new Date(year, month - 1, 1);
      let monthEnd = new Date(year, month, 0); // 月末日
      
      // 開始月の場合、実際の開始日から計算
      if (year === startDate.getFullYear() && month === startDate.getMonth() + 1) {
        monthStart = startDate;
      }
      
      // 終了月の場合、実際の終了日まで計算  
      if (year === endDate.getFullYear() && month === endDate.getMonth() + 1) {
        monthEnd = endDate;
      }
      
      // その月の日数を計算
      const daysInMonth = Math.floor((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      months.push({
        year,
        month,
        label: `${year}年${month}月`,
        daysInMonth // 日数情報を追加
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  }

  async function saveBudgetItem() {
    if (!budgetItemForm.grantId) {
      error = '助成金を選択してください';
      return;
    }
    
    try {
      const url = budgetItemForm.id ? 
        `${base}/api/grants/${budgetItemForm.grantId}/budget-items/${budgetItemForm.id}` : 
        `${base}/api/grants/${budgetItemForm.grantId}/budget-items`;
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
        
        dispatch('save', data);
        closeModal();
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
      
      // 月別予算額が入力された月のみスケジュールを作成
      const schedules = monthlyBudgets
        .filter(item => item.amount > 0)
        .map(item => ({
          year: item.year,
          month: item.month,
          isActive: true,
          monthlyBudget: item.amount // 各月の個別金額を設定
        }));
      
      
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

  function openDeleteConfirm() {
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
  }

  async function handleDelete() {
    if (!budgetItemForm.id) return;
    
    deleteLoading = true;
    error = '';
    
    try {
      const response = await fetch(`${base}/api/budget-items/${budgetItemForm.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        dispatch('delete', { id: budgetItemForm.id });
        closeDeleteConfirm();
        closeModal();
      } else {
        const data = await response.json();
        error = data.error || '削除に失敗しました';
        closeDeleteConfirm();
      }
    } catch (err) {
      error = '削除中にエラーが発生しました';
      console.error('Delete error:', err);
      closeDeleteConfirm();
    } finally {
      deleteLoading = false;
    }
  }

  function closeModal() {
    error = '';
    showCategoryDropdown = false;
    dispatch('close');
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    saveBudgetItem();
  }

  function handleGrantChange() {
    updateAvailableMonths();
    // 助成金変更時は選択済み月をクリア（新規作成時のみ）
    if (!budgetItemForm.id) {
      selectedMonths.clear();
    }
  }

  // 外側をクリックしたときにドロップダウンを閉じる
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.category-dropdown')) {
      showCategoryDropdown = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

{#if show}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-10 mx-auto p-5 border max-w-3xl w-full shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        {budgetItemForm.id ? '予算項目編集' : '新規予算項目作成'}
      </h3>
      
      {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      {/if}
      
      <form on:submit={handleSubmit}>
        <!-- 上部の基本情報 -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <!-- 左側 -->
          <div class="space-y-4">
            <!-- 助成金 -->
            <div>
              <label for="grant-select" class="block text-sm font-medium text-gray-700 mb-2">助成金 *</label>
              <select 
                id="grant-select"
                bind:value={budgetItemForm.grantId}
                on:change={handleGrantChange}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">助成金を選択してください</option>
                {#each grants as grant}
                  <option value={grant.id}>
                    {grant.grantCode ? `[${grant.grantCode}] ` : ''}{grant.name} ({statusLabels[grant.status]})
                  </option>
                {/each}
              </select>
            </div>
            
            <!-- 項目名 -->
            <div>
              <label for="item-name" class="block text-sm font-medium text-gray-700 mb-2">項目名 *</label>
              <input 
                id="item-name"
                type="text" 
                bind:value={budgetItemForm.name}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 消耗品費"
              />
            </div>
            
            <!-- カテゴリ -->
            <div>
              <label for="category-input" class="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
              <div class="relative category-dropdown">
                <input 
                  id="category-input"
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
            
            <!-- 予算額 -->
            <div>
              <label for="budget-amount" class="block text-sm font-medium text-gray-700 mb-2">予算額（円）</label>
              <input 
                id="budget-amount"
                type="number" 
                bind:value={budgetItemForm.budgetedAmount}
                min="0"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="498000"
              />
            </div>
            
            <!-- 備考 -->
            <div>
              <label for="note-textarea" class="block text-sm font-medium text-gray-700 mb-2">備考</label>
              <textarea 
                id="note-textarea"
                bind:value={budgetItemForm.note}
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="備考や説明を入力"
              ></textarea>
            </div>
          </div>
          
          <!-- 右側：月別予算配分 -->
          <div>
            {#if formGrant}
              <div class="block text-sm font-medium text-gray-700 mb-2">
                月別予算配分
                {#if totalMonthlyBudget > 0}
                  <span class="ml-2 text-xs text-gray-500">
                    (合計: ¥{totalMonthlyBudget.toLocaleString()})
                  </span>
                {/if}
              </div>
              
              <!-- 均等割りボタン -->
              {#if budgetItemForm.budgetedAmount}
                <div class="mb-3">
                  <button 
                    type="button"
                    on:click={distributeEquallyToMonths}
                    class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
                  >
                    総額を均等に配分 (¥{budgetItemForm.budgetedAmount.toLocaleString()})
                  </button>
                  <p class="mt-1 text-xs text-gray-500">
                    ※10日以上ある月のみに均等配分されます
                  </p>
                </div>
              {/if}
              
              <!-- 月別入力フィールド -->
              <div class="border border-gray-200 rounded-md p-3" style="max-height: 450px; overflow-y: auto;">
                <div class="space-y-2">
                  {#if monthlyBudgets && monthlyBudgets.length > 0}
                    {#each monthlyBudgets as monthlyItem, index}
                      <div class="flex items-center gap-2">
                        <label for="monthly-budget-{index}" class="text-sm text-gray-700 min-w-[100px]">
                          {monthlyItem.year}年{monthlyItem.month}月:
                        </label>
                        <input 
                          id="monthly-budget-{index}"
                          type="number"
                          value={monthlyItem.amount}
                          on:input={(e) => {
                            const target = e.target as HTMLInputElement;
                            monthlyBudgets[index].amount = parseInt(target.value) || 0;
                            monthlyBudgets = monthlyBudgets; // 再代入でリアクティビティをトリガー
                          }}
                          min="0"
                          class="flex-1 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    {/each}
                  {:else}
                    <div>データがありません</div>
                  {/if}
                </div>
              </div>
              
              <!-- 合計チェック -->
              {#if budgetItemForm.budgetedAmount && totalMonthlyBudget !== budgetItemForm.budgetedAmount}
                <div class="mt-2 text-sm text-orange-600">
                  ⚠️ 月別合計と総予算額が一致しません
                  (差額: ¥{Math.abs(budgetItemForm.budgetedAmount - totalMonthlyBudget).toLocaleString()})
                </div>
              {/if}
            {:else}
              <div class="text-sm text-gray-500">
                助成金を選択すると月別予算配分が表示されます
              </div>
            {/if}
          </div>
        </div>
        
        <div class="flex justify-between">
          {#if budgetItemForm.id}
            <button 
              type="button"
              on:click={openDeleteConfirm}
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              削除
            </button>
          {:else}
            <div></div>
          {/if}
          
          <div class="flex space-x-3">
            <button 
              type="button"
              on:click={closeModal}
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
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 削除確認ダイアログ -->
{#if showDeleteConfirm}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-medium text-gray-900 mb-4">削除確認</h3>
      
      <div class="mb-4">
        <p class="text-sm text-gray-600">
          予算項目「<span class="font-semibold">{budgetItemForm.name}</span>」を削除しますか？
        </p>
        <p class="text-sm text-red-600 mt-2">
          ※ この操作は取り消せません。関連する割当データも削除されます。
        </p>
      </div>
      
      <div class="flex justify-end space-x-3">
        <button 
          type="button"
          on:click={closeDeleteConfirm}
          disabled={deleteLoading}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
        >
          キャンセル
        </button>
        <button 
          type="button"
          on:click={handleDelete}
          disabled={deleteLoading}
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
        >
          {deleteLoading ? '削除中...' : '削除実行'}
        </button>
      </div>
    </div>
  </div>
{/if}