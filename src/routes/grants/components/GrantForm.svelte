<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { base } from '$app/paths';
  
  export let show: boolean = false;
  export let grantForm: {
    id?: number;
    name?: string;
    grantCode?: string;
    totalAmount?: number;
    startDate?: string | null;
    endDate?: string | null;
    status?: string;
  } = {};

  const dispatch = createEventDispatcher();
  let error = '';
  let showDeleteConfirm = false;
  let deleteLoading = false;

  const statusLabels = {
    active: '進行中',
    completed: '終了',
    applied: '報告済み'
  };

  function formatDateForAPI(dateString?: string | null): string | null {
    if (!dateString) return null;
    
    // 既にISO形式の場合はそのまま返す
    if (dateString.includes('T')) {
      return dateString;
    }
    
    // YYYY-MM-DD形式をISO形式に変換
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date.toISOString();
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
        dispatch('save', data);
        closeModal();
      } else {
        error = data.error || '助成金の保存に失敗しました';
      }
    } catch (err) {
      error = '助成金の保存中にエラーが発生しました';
      console.error('Save grant error:', err);
    }
  }

  function closeModal() {
    error = '';
    showDeleteConfirm = false;
    dispatch('close');
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    saveGrant();
  }

  function openDeleteConfirm() {
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
  }

  async function handleDelete() {
    if (!grantForm.id) return;
    
    deleteLoading = true;
    error = '';
    
    try {
      const response = await fetch(`${base}/api/grants/${grantForm.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        dispatch('delete', { id: grantForm.id });
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
</script>

{#if show}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        {grantForm.id ? '助成金編集' : '新規助成金作成'}
      </h3>
      
      {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      {/if}
      
      <form on:submit={handleSubmit}>
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
            <option value="active">進行中</option>
            <option value="completed">終了</option>
            <option value="applied">報告済み</option>
          </select>
        </div>
        
        <div class="flex justify-between">
          {#if grantForm.id}
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
          助成金「<span class="font-semibold">{grantForm.name}</span>」を削除しますか？
        </p>
        <p class="text-sm text-red-600 mt-2">
          ※ この操作は取り消せません。関連する予算項目、割当データもすべて削除されます。
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