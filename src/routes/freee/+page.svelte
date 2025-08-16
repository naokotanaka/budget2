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

    // 列定義（横スクロール対応のため幅を調整）
    const columns = [
      {
        title: "明細ID<br><small>detail_id</small>",
        field: "primary_detail_id",
        width: 110,
        minWidth: 90,
        sorter: "number",
        frozen: true, // 固定列（重要なので固定）
        formatter: function(cell) {
          const val = cell.getValue();
          return val ? `<span class="text-blue-600 font-mono text-xs">${val}</span>` : '-';
        },
        tooltip: "明細の固有ID（不変の行識別子）",
        headerSort: true
      },
      {
        title: "取引ID<br><small>deal_id</small>",
        field: "id",
        width: 100,
        minWidth: 80,
        sorter: "number",
        frozen: true, // 固定列
        formatter: function(cell) {
          const val = cell.getValue();
          return val ? `<span class="text-gray-600 font-mono text-xs">${val}</span>` : '-';
        },
        headerSort: true
      },
      {
        title: "発生日",
        field: "issue_date",
        width: 90,
        minWidth: 80,
        sorter: function(a, b) {
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
              month: '2-digit',
              day: '2-digit'
            });
          } catch (error) {
            return val;
          }
        }
      },
      {
        title: "金額",
        field: "amount",
        width: 90,
        minWidth: 70,
        sorter: "number",
        hozAlign: "right",
        formatter: function(cell) {
          const val = cell.getValue();
          return val ? `¥${Math.abs(val).toLocaleString()}` : '';
        }
      },
      {
        title: "取引先<br><small>partner_id</small>",
        field: "partner_name",
        width: 120,
        minWidth: 80,
        sorter: "string",
        headerSort: true
      },
      {
        title: "取引内容<br><small>wallet_description</small>",
        field: "description",
        width: 180,
        minWidth: 120,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          // Wallet Txnsからの詳細説明のみ表示
          if (row.wallet_description) {
            return `<span class="text-indigo-600 font-medium" title="Wallet Txnsより">${row.wallet_description}</span>`;
          }
          return '';
        },
        sorter: "string",
        headerSort: true
      },
      {
        title: "勘定科目<br><small>details.account_item_id</small>",
        field: "account_item_name",
        width: 120,
        minWidth: 100,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details[0]) {
            return row.details[0].account_item_name || '(Not Set)';
          }
          return '(Not Set)';
        },
        sorter: function(a, b, aRow, bRow, column, dir, sorterParams) {
          const aVal = aRow.getData().details?.[0]?.account_item_name || '';
          const bVal = bRow.getData().details?.[0]?.account_item_name || '';
          return aVal.localeCompare(bVal, 'ja');
        },
        headerSort: true
      },
      {
        title: "部門<br><small>details.section_id</small>",
        field: "section_name",
        width: 80,
        minWidth: 60,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details[0]) {
            return row.details[0].section_name || '';
          }
          return '';
        },
        sorter: function(a, b, aRow, bRow, column, dir, sorterParams) {
          const aVal = aRow.getData().details?.[0]?.section_name || '';
          const bVal = bRow.getData().details?.[0]?.section_name || '';
          return aVal.localeCompare(bVal, 'ja');
        },
        headerSort: true
      },
      {
        title: "品目<br><small>details.item_id</small>",
        field: "item_name",
        width: 80,
        minWidth: 60,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details[0]) {
            return row.details[0].item_name || '';
          }
          return '';
        },
        sorter: function(a, b, aRow, bRow, column, dir, sorterParams) {
          const aVal = aRow.getData().details?.[0]?.item_name || '';
          const bVal = bRow.getData().details?.[0]?.item_name || '';
          return aVal.localeCompare(bVal, 'ja');
        },
        headerSort: true
      },
      {
        title: "メモタグ<br><small>tag_names</small>",
        field: "tag_names",
        width: 150,
        minWidth: 100,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          // 取引レベルのタグを優先表示
          if (row.tag_names) {
            return `<span class="text-orange-600 font-medium">${row.tag_names}</span>`;
          }
          // 明細レベルのタグを表示
          if (row.details && row.details[0] && row.details[0].tag_names) {
            return `<span class="text-orange-500">${row.details[0].tag_names}</span>`;
          }
          return '<span class="text-gray-400">-</span>';
        },
        tooltip: function(cell) {
          const row = cell.getRow().getData();
          const dealTags = row.tag_names;
          const detailTags = row.details?.[0]?.tag_names;
          if (dealTags && detailTags) {
            return `取引タグ: ${dealTags}
明細タグ: ${detailTags}`;
          } else if (dealTags) {
            return `取引タグ: ${dealTags}`;
          } else if (detailTags) {
            return `明細タグ: ${detailTags}`;
          }
          return 'メモタグなし';
        },
        sorter: function(a, b, aRow, bRow, column, dir, sorterParams) {
          const aVal = aRow.getData().tag_names || aRow.getData().details?.[0]?.tag_names || '';
          const bVal = bRow.getData().tag_names || bRow.getData().details?.[0]?.tag_names || '';
          return aVal.localeCompare(bVal, 'ja');
        },
        headerSort: true
      },
      {
        title: "管理番号<br><small>ref_number</small>",
        field: "ref_number",
        width: 100,
        minWidth: 80,
        formatter: function(cell) {
          const value = cell.getValue();
          return value ? `<span class="text-blue-600 font-medium">${value}</span>` : '<span class="text-gray-400">-</span>';
        },
        tooltip: "freee管理番号",
        sorter: "string",
        headerSort: true
      },
      {
        title: "明細備考<br><small>details.description</small>",
        field: "detail_description",
        width: 140,
        minWidth: 100,
        formatter: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details.length > 0 && row.details[0].description) {
            const desc = row.details[0].description;
            return `<span class="text-purple-600">${desc}</span>`;
          }
          return '<span class="text-gray-400">-</span>';
        },
        tooltip: function(cell) {
          const row = cell.getRow().getData();
          if (row.details && row.details.length > 0) {
            return row.details[0].description || '明細レベルの備考情報';
          }
          return '明細レベルの備考情報';
        },
        sorter: function(a, b, aRow, bRow, column, dir, sorterParams) {
          const aVal = aRow.getData().details?.[0]?.description || '';
          const bVal = bRow.getData().details?.[0]?.description || '';
          return aVal.localeCompare(bVal, 'ja');
        },
        headerSort: true
      },
      {
        title: "支払方法<br><small>walletable_type</small>",
        field: "walletable_type",
        width: 100,
        minWidth: 80,
        formatter: function(cell) {
          const value = cell.getValue();
          const row = cell.getRow().getData();
          if (value) {
            let displayText = value;
            let colorClass = "text-gray-600";
            switch(value) {
              case 'credit_card':
                displayText = 'カード';
                colorClass = "text-blue-600";
                break;
              case 'bank_account':
                displayText = '銀行';
                colorClass = "text-green-600";
                break;
              case 'wallet':
                displayText = '現金';
                colorClass = "text-yellow-600";
                break;
            }
            return `<span class="${colorClass} font-medium">${displayText}</span>`;
          }
          return '<span class="text-gray-400">-</span>';
        },
        sorter: "string",
        headerSort: true
      },
      {
        title: "ステータス",
        field: "status",
        width: 80,
        minWidth: 60,
        sorter: "string",
        headerSort: true
      },
      {
        title: "タイプ",
        field: "type",
        width: 80,
        minWidth: 60,
        sorter: "string",
        headerSort: true
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
      // 備考欄の表示用にフィールドを正規化
      account_item_name: deal.details && deal.details.length > 0 ? deal.details[0].account_item_name : '',
      section_name: deal.details && deal.details.length > 0 ? deal.details[0].section_name : '',
      item_name: deal.details && deal.details.length > 0 ? deal.details[0].item_name : '',
      detail_description: deal.details && deal.details.length > 0 ? deal.details[0].description : ''
    }));

    // 備考データが存在する取引をコンソールに出力（デバッグ用）
    const dealsWithMemo = tableData.filter(deal => deal.ref_number || deal.memo || deal.detail_description);
    console.log(`=== 備考データを持つ取引: ${dealsWithMemo.length}件 ===`);
    dealsWithMemo.forEach(deal => {
      console.log(`取引ID ${deal.id}:`, {
        ref_number: deal.ref_number,
        memo: deal.memo, 
        detail_description: deal.detail_description,
        partner_name: deal.partner_name
      });
    });

    console.log(`テーブル初期化開始: ${tableData.length}件のデータ`);

    try {
      table = new Tabulator(tableElement, {
        data: tableData,
        columns: columns,
        layout: "fitColumns", // 横スクロール対応レイアウト
        height: "600px", // 高さを少し増加
        pagination: "local",
        paginationSize: 20,
        paginationSizeSelector: [10, 20, 50, 100],
        movableColumns: true,
        resizableColumns: true,
        headerVisible: true,
        responsiveLayout: false, // レスポンシブ無効（普通のグリッド表示）
        tooltips: true,
        addRowPos: "top",
        history: true,
        virtualDomHoz: true, // 水平方向の仮想DOM（大きなテーブル対応）
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

  // すべてのデータを同期
  async function syncAllData() {
    if (!table || previewData.length === 0) {
      alert('同期するデータがありません');
      return;
    }

    if (!confirm(`${previewData.length}件のデータをすべて同期しますか？`)) {
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
          deals: previewData,
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
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">
                取得データ（支出・【事】【管】のみ）
              </h2>
              <p class="text-sm text-gray-600 mt-1">
                支出取引で勘定科目が【事】【管】で始まるもののみ表示しています。<br>
                <span class="text-blue-600 font-medium">管理番号</span>・
                <span class="text-purple-600 font-medium">明細備考</span>・
                <span class="text-orange-600 font-medium">メモタグ</span>
                が色付きで表示されます（横スクロールで確認）
              </p>
            </div>
            <div class="space-x-2">
              <button
                on:click={syncAllData}
                disabled={isLoading}
                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                すべて同期
              </button>
            </div>
          </div>
          
          <!-- テーブルコンテナ（備考欄表示を確実にするための横スクロール対応） -->
          <div class="border rounded-lg overflow-hidden">
            <div bind:this={tableElement} class="w-full" style="min-height: 600px;">
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
  /* Tabulatorのスタイルカスタマイズ（横スクロール対応） */
  :global(.tabulator) {
    background-color: white !important;
    border: 1px solid #e5e7eb !important;
    overflow-x: auto !important; /* 横スクロール有効化 */
  }
  
  :global(.tabulator-header) {
    background-color: #f9fafb !important;
    border-bottom: 2px solid #e5e7eb !important;
  }
  
  :global(.tabulator-header .tabulator-col-title) {
    white-space: normal !important;
    line-height: 1.4;
    padding: 6px 3px !important;
    font-size: 11px;
    font-weight: 600 !important;
  }
  
  /* ヘッダーの2行目（英語名）を表示 */
  :global(.tabulator-header .tabulator-col-title small) {
    display: block !important;
    font-size: 9px !important;
    font-weight: 400 !important;
    color: #6b7280 !important;
    margin-top: 2px !important;
  }
  
  /* 固定列のスタイル */
  :global(.tabulator .tabulator-col.tabulator-frozen) {
    background-color: #f8fafc !important;
    border-right: 2px solid #cbd5e1 !important;
  }
  
  :global(.tabulator-cell) {
    padding: 3px !important;
    font-size: 12px;
    border-right: 1px solid #f3f4f6 !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* 備考欄の特別スタイル */
  :global(.tabulator-cell) .text-blue-600,
  :global(.tabulator-cell) .text-green-600,
  :global(.tabulator-cell) .text-purple-600 {
    font-weight: 500 !important;
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

  /* 横スクロールバーの強制表示 */
  :global(.tabulator-tableholder) {
    overflow-x: auto !important;
    overflow-y: auto !important;
  }
  
  /* テーブル全体の最小幅を設定 */
  :global(.tabulator-table) {
    min-width: 1200px !important; /* 全列が表示される最小幅 */
  }
</style>