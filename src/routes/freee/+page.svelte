<script>
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  export let data;

  $: ({ isConnected, companies, lastSyncAt, connectionError } = data);

  let startDate = new Date().toISOString().split('T')[0].slice(0, 7) + '-01';
  let endDate = new Date().toISOString().split('T')[0];
  let isLoading = false;
  let previewData = [];
  let tableElement;
  let table;
  let selectedCompany = null;
  let fetchError = null;
  let filterMode = 'all'; // 'all', 'business', 'admin', 'custom'
  let customFilter = '';
  let Tabulator = null;

  onMount(async () => {
    console.log('freee認証ページ表示:', { isConnected, companies: companies?.length, lastSyncAt });
    if (companies && companies.length > 0) {
      selectedCompany = companies[0].id;
    }
    
    // ブラウザ環境でのみTabulatorをインポート
    if (browser) {
      const TabulatorModule = await import('tabulator-tables');
      Tabulator = TabulatorModule.TabulatorFull;
      await import('tabulator-tables/dist/css/tabulator.min.css');
    }
  });

  function handleConnect() {
    window.location.href = '/budget2/auth/freee/';
  }

  function handleDisconnect() {
    if (confirm('freee連携を解除しますか？')) {
      console.log('freee連携解除');
    }
  }

  // freee APIからデータ取得（プレビュー用）
  async function fetchPreviewData() {
    console.log('=== fetchPreviewData 開始 ===');
    console.log('開始日:', startDate);
    console.log('終了日:', endDate);
    console.log('会社ID:', selectedCompany);
    
    isLoading = true;
    fetchError = null;
    previewData = [];
    
    // 既存のテーブルを破棄
    if (table) {
      table.destroy();
      table = null;
    }
    
    try {
      console.log('APIリクエスト送信中...');
      const response = await fetch('/budget2/api/freee/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          companyId: selectedCompany
        })
      });

      console.log('レスポンスステータス:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('APIレスポンス:', result);
      
      if (result.success) {
        previewData = result.deals || [];
        console.log(`${previewData.length}件のデータを取得しました`);
        
        // DOM更新を確実に待ってからテーブル初期化
        // tick()でSvelteのDOM更新完了を待機してから更に安全のためsetTimeout
        await tick(); // Svelteの次の更新サイクルを待つ
        setTimeout(() => {
          console.log('テーブル初期化スケジュール実行');
          initTable();
        }, 100);
      } else {
        fetchError = result.error;
        console.error('APIエラー:', result.error);
      }
    } catch (error) {
      fetchError = `データ取得エラー: ${error.message}`;
      console.error('Preview fetch error:', error);
    } finally {
      isLoading = false;
      console.log('=== fetchPreviewData 終了 ===');
    }
  }

  // フィルター適用
  function applyFilter() {
    if (!previewData || previewData.length === 0) {
      console.log('フィルター適用スキップ: データがありません');
      return;
    }
    
    if (!table) {
      console.log('フィルター適用スキップ: テーブルが初期化されていません');
      return;
    }
    
    console.log('フィルター適用開始:', filterMode);
    
    let filteredData = [...previewData];
    
    switch (filterMode) {
      case 'business':
        // 【事】で始まる勘定科目のみ
        filteredData = previewData.filter(deal => {
          if (deal.details && deal.details[0]) {
            const accountName = deal.details[0].account_item_name || '';
            return accountName.startsWith('【事】');
          }
          return false;
        });
        break;
      case 'admin':
        // 【管】で始まる勘定科目のみ
        filteredData = previewData.filter(deal => {
          if (deal.details && deal.details[0]) {
            const accountName = deal.details[0].account_item_name || '';
            return accountName.startsWith('【管】');
          }
          return false;
        });
        break;
      case 'custom':
        // カスタムフィルター
        if (customFilter) {
          filteredData = previewData.filter(deal => {
            if (deal.details && deal.details[0]) {
              const accountName = deal.details[0].account_item_name || '';
              return accountName.includes(customFilter);
            }
            return false;
          });
        }
        break;
      // 'all' の場合はフィルターなし
    }
    
    console.log(`フィルター結果: ${filteredData.length}件 / ${previewData.length}件`);
    
    // テーブルデータを更新（既存の選択状態を保持）
    try {
      const currentData = table.getData();
      const selectedIds = new Set(currentData.filter(row => row.selected).map(row => row.id));
      
      const tableData = filteredData.map(deal => ({
        ...deal,
        selected: selectedIds.has(deal.id) // 既存の選択状態を保持
      }));
      
      table.replaceData(tableData);
      console.log(`テーブルデータ更新完了: ${tableData.length}件表示 (選択状態${selectedIds.size}件保持)`);
    } catch (error) {
      console.error('テーブルデータ更新エラー:', error);
    }
    
    return filteredData;
  }

  // フィルターモード変更時
  function handleFilterChange() {
    applyFilter();
  }

  // Tabulatorテーブル初期化
  function initTable() {
    console.log('=== initTable 開始 ===');
    console.log('tableElement:', !!tableElement);
    console.log('previewData.length:', previewData.length);
    console.log('Tabulator loaded:', !!Tabulator);
    
    // Tabulatorがロードされていない場合は待機
    if (!Tabulator) {
      console.warn('Tabulatorがまだロードされていません。再試行します。');
      setTimeout(() => initTable(), 100);
      return;
    }
    
    // DOM要素の存在チェック（より厳密に）
    if (!tableElement) {
      console.warn('tableElementが存在しません。DOM要素のバインディングを確認してください。');
      return;
    }
    
    if (previewData.length === 0) {
      console.warn('プレビューデータが空です。テーブル初期化をスキップします。');
      return;
    }

    // DOM要素が実際に描画され、サイズが確定しているかチェック
    const rect = tableElement.getBoundingClientRect();
    if (!tableElement.parentNode || rect.width === 0 || rect.height === 0) {
      console.warn('tableElementが完全に描画されていません。DOM更新を待機します。', {
        hasParent: !!tableElement.parentNode,
        width: rect.width,
        height: rect.height
      });
      setTimeout(() => initTable(), 50);
      return;
    }

    // 列定義（API項目名と日本語名を両方表示）
    const columns = [
      {
        title: "選択",
        field: "selected",
        width: 60,
        hozAlign: "center",
        headerHozAlign: "center",
        formatter: function(cell) {
          const isChecked = cell.getValue();
          return `<input type="checkbox" ${isChecked ? 'checked' : ''} style="cursor: pointer;">`;
        },
        cellClick: function(e, cell) {
          e.stopPropagation();
          const currentValue = cell.getValue();
          const newValue = !currentValue;
          
          // セルの値を更新
          cell.setValue(newValue);
          
          // 行データも更新してテーブル全体の整合性を保つ
          const rowData = cell.getRow().getData();
          rowData.selected = newValue;
          
          console.log(`Row ID ${rowData.id}: ${newValue ? '選択' : '選択解除'}`);
          
          // チェックボックスの表示を更新
          const checkbox = cell.getElement().querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.checked = newValue;
          }
        },
        headerSort: false
      },
      {
        title: "ID<br>id",
        field: "id",
        width: 100,
        sorter: "number"
      },
      {
        title: "発生日<br>issue_date",
        field: "issue_date",
        width: 100,
        sorter: function(a, b) {
          // カスタム日付ソーター（Luxon不要）
          const dateA = a ? new Date(a) : new Date(0);
          const dateB = b ? new Date(b) : new Date(0);
          return dateA.getTime() - dateB.getTime();
        },
        formatter: function(cell) {
          const val = cell.getValue();
          if (!val) return '';
          try {
            const date = new Date(val);
            return date.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
          } catch (error) {
            return val; // エラー時は元の値をそのまま表示
          }
        }
      },
      {
        title: "金額<br>amount",
        field: "amount",
        width: 100,
        sorter: "number",
        hozAlign: "right",
        formatter: function(cell) {
          const val = cell.getValue();
          return val ? `¥${Math.abs(val).toLocaleString()}` : '';
        }
      },
      {
        title: "取引先<br>partner_name",
        field: "partner_name",
        width: 150
      },
      {
        title: "取引内容<br>description",
        field: "description",
        width: 150
      },
      {
        title: "勘定科目<br>account_item_name",
        field: "account_item_name",
        width: 150,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details[0]) {
            return row.details[0].account_item_name || '(未設定)';
          }
          return '(未設定)';
        }
      },
      {
        title: "部門<br>section_name",
        field: "section_name",
        width: 100,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details[0]) {
            return row.details[0].section_name || '';
          }
          return '';
        }
      },
      {
        title: "品目<br>item_name",
        field: "item_name",
        width: 100,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details[0]) {
            return row.details[0].item_name || '';
          }
          return '';
        }
      },
      {
        title: "管理番号<br>ref_number",
        field: "ref_number",
        width: 100
      },
      {
        title: "メモ<br>memo",
        field: "memo",
        width: 150
      },
      {
        title: "明細備考<br>detail.description",
        field: "detail_description",
        width: 150,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details[0]) {
            return row.details[0].description || '';
          }
          return '';
        }
      },
      {
        title: "ステータス<br>status",
        field: "status",
        width: 100
      },
      {
        title: "タイプ<br>type",
        field: "type",
        width: 100
      }
    ];

    // 既存のテーブルを破棄
    if (table) {
      try {
        table.destroy();
        console.log('既存のテーブルを破棄しました');
      } catch (error) {
        console.warn('テーブル破棄時にエラー:', error);
      }
      table = null;
    }

    const tableData = previewData.map(deal => ({
      ...deal,
      selected: false
    }));

    console.log(`テーブル初期化開始: ${tableData.length}件のデータ`);

    try {
      table = new Tabulator(tableElement, {
        data: tableData,
        columns: columns,
        layout: "fitDataStretch",
        height: "500px",
        pagination: "local",
        paginationSize: 20,
        paginationSizeSelector: [10, 20, 50, 100],
        movableColumns: true,
        resizableColumns: true,
        headerVisible: true,
        responsiveLayout: "hide",
        tooltips: true,
        addRowPos: "top",
        history: true,
        langs: {
          "ja-jp": {
            "pagination": {
              "first": "最初",
              "first_title": "最初のページ",
              "last": "最後",
              "last_title": "最後のページ",
              "prev": "前",
              "prev_title": "前のページ",
              "next": "次",
              "next_title": "次のページ",
              "counter": {
                "showing": "表示中",
                "of": "の",
                "rows": "行"
              }
            }
          }
        },
        locale: "ja-jp"
      });

      // テーブルの初期化完了を待つ
      table.on("tableBuilt", function(){
        console.log('✅ Tabulatorテーブルが正常に構築されました');
        // フィルターを適用
        applyFilter();
      });

      table.on("dataLoadError", function(error){
        console.error('❌ Tabulatorデータ読み込みエラー:', error);
        fetchError = 'データ読み込みエラー: ' + error;
      });

      console.log('✅ Tabulatorテーブル初期化成功');
    } catch (error) {
      console.error('❌ Tabulatorテーブル初期化エラー:', error);
      fetchError = 'テーブル表示エラー: ' + error.message;
    }
    console.log('=== initTable 終了 ===');
  }

  // 選択されたデータを同期
  async function syncSelectedData() {
    if (!table) return;
    
    const selectedRows = table.getData().filter(row => row.selected);
    
    if (selectedRows.length === 0) {
      alert('同期するデータを選択してください');
      return;
    }

    if (!confirm(`${selectedRows.length}件のデータを同期しますか？`)) {
      return;
    }

    isLoading = true;
    
    try {
      const response = await fetch('/budget2/api/freee/sync-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deals: selectedRows,
          companyId: selectedCompany
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`同期完了: ${result.message}`);
        // 成功したらテーブルをクリア
        previewData = [];
        if (table) {
          table.destroy();
          table = null;
        }
      } else {
        alert(`同期エラー: ${result.error}`);
      }
    } catch (error) {
      alert(`同期エラー: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  // 全選択/全解除
  function toggleSelectAll() {
    if (!table) {
      console.log('toggleSelectAll: テーブルが初期化されていません');
      return;
    }
    
    const data = table.getData();
    if (data.length === 0) {
      console.log('toggleSelectAll: データが空です');
      return;
    }
    
    // 現在の選択状態をチェック
    const allSelected = data.every(row => row.selected === true);
    const newState = !allSelected;
    
    console.log(`toggleSelectAll: ${allSelected ? '全解除' : '全選択'} (${data.length}件)`);
    
    // テーブル内の各行の選択状態を更新
    data.forEach(row => {
      table.updateRow(row.id, { selected: newState });
    });
    
    console.log(`toggleSelectAll完了: 新しい状態=${newState}`);
  }

  function goToSync() {
    goto('/budget2/freee/sync/');
  }
</script>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- ヘッダー -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">freee連携</h1>
      <p class="text-gray-600">会計データをfreee APIから取得・同期します</p>
    </div>

    <!-- 接続状況 -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">接続状況</h2>
      
      {#if isConnected}
        <div class="flex items-center space-x-3 mb-4">
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          <span class="text-green-700 font-medium">接続済み</span>
        </div>
        
        {#if companies && companies.length > 0}
          <div class="mb-4">
            <p class="text-sm text-gray-600 mb-2">連携中の会社:</p>
            <select 
              bind:value={selectedCompany}
              class="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {#each companies as company}
                <option value={company.id}>
                  {company.display_name} (ID: {company.id})
                </option>
              {/each}
            </select>
          </div>
        {/if}

        {#if lastSyncAt}
          <p class="text-sm text-gray-500">
            最終同期: {new Date(lastSyncAt).toLocaleString('ja-JP')}
          </p>
        {/if}
      {:else}
        <div class="flex items-center space-x-3 mb-4">
          <div class="w-3 h-3 bg-red-500 rounded-full"></div>
          <span class="text-red-700 font-medium">未接続</span>
        </div>
        
        {#if connectionError}
          <div class="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p class="text-red-800 text-sm">{connectionError}</p>
          </div>
        {/if}
        
        <button
          on:click={handleConnect}
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          freee認証を開始
        </button>
      {/if}
    </div>

    {#if isConnected}
      <!-- データ取得設定 -->
      <div class="bg-white rounded-lg shadow p-6 mb-8">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">データ取得</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              type="date"
              bind:value={startDate}
              class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              終了日
            </label>
            <input
              type="date"
              bind:value={endDate}
              class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div class="flex items-end">
            <button
              on:click={fetchPreviewData}
              disabled={isLoading}
              class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'データ取得中...' : 'データ取得'}
            </button>
          </div>
        </div>
        
        {#if fetchError}
          <div class="bg-red-50 border border-red-200 rounded p-3">
            <p class="text-red-800 text-sm">{fetchError}</p>
          </div>
        {/if}
      </div>

      <!-- データプレビュー -->
      {#if previewData.length > 0}
        <div class="bg-white rounded-lg shadow p-6 mb-8">
          <!-- フィルター設定 -->
          <div class="border-b pb-4 mb-4">
            <h3 class="text-lg font-medium text-gray-900 mb-3">フィルター設定</h3>
            <div class="flex flex-wrap gap-4 items-end">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  勘定科目フィルター
                </label>
                <select 
                  bind:value={filterMode}
                  on:change={handleFilterChange}
                  class="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">すべて表示</option>
                  <option value="business">【事】事業費のみ</option>
                  <option value="admin">【管】管理費のみ</option>
                  <option value="custom">カスタムフィルター</option>
                </select>
              </div>
              
              {#if filterMode === 'custom'}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    検索文字列
                  </label>
                  <input
                    type="text"
                    bind:value={customFilter}
                    on:input={handleFilterChange}
                    placeholder="例: 消耗品"
                    class="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              {/if}
              
              <div class="text-sm text-gray-600">
                {#if table}
                  表示中: {table.getData().length}件 / 全{previewData.length}件
                {/if}
              </div>
            </div>
          </div>

          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-gray-900">
              取得データ
            </h2>
            <div class="space-x-2">
              <button
                on:click={toggleSelectAll}
                class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                全選択/解除
              </button>
              <button
                on:click={syncSelectedData}
                disabled={isLoading}
                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                選択したデータを同期
              </button>
            </div>
          </div>
          
          <div bind:this={tableElement} class="min-h-[500px] w-full">
            {#if !table && previewData.length > 0}
              <div class="flex items-center justify-center h-32">
                <div class="text-center">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p class="text-gray-600">テーブルを初期化しています...</p>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- 既存機能へのリンク -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">その他の機能</h3>
        <button
          on:click={goToSync}
          class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          従来の同期画面へ
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Tabulatorのスタイルカスタマイズ */
  :global(.tabulator) {
    background-color: white !important;
    border: 1px solid #e5e7eb !important;
  }
  
  :global(.tabulator-header) {
    background-color: #f9fafb !important;
    border-bottom: 2px solid #e5e7eb !important;
  }
  
  :global(.tabulator-header .tabulator-col-title) {
    white-space: normal !important;
    line-height: 1.2;
    padding: 8px 4px !important;
    font-size: 12px;
    font-weight: 600 !important;
  }
  
  :global(.tabulator-cell) {
    padding: 4px !important;
    font-size: 13px;
    border-right: 1px solid #f3f4f6 !important;
  }
  
  :global(.tabulator-row) {
    border-bottom: 1px solid #f3f4f6 !important;
  }
  
  :global(.tabulator-row.tabulator-row-even) {
    background-color: #f9fafb !important;
  }
  
  :global(.tabulator-footer) {
    background-color: #f9fafb !important;
    border-top: 1px solid #e5e7eb !important;
  }
</style>