<script lang="ts">
  console.log('📍 Script block started');
  import { onMount } from "svelte";
  import CSVImporter from '$lib/components/CSVImporter.svelte';
  // Tabulatorは動的インポートで読み込み（SSR対応）
  
  export let data;
  console.log('📍 data received:', data);
  
  $: ({ grants, budgetItems } = data);
  $: console.log('🌟 budgetItems.length:', budgetItems?.length || 0);

  // 予算項目の表示用データ
  $: formattedBudgetItems = budgetItems.map(item => ({
    id: item.id,
    grantName: item.grant.name,
    grantCode: item.grant.grantCode || '',
    name: item.name,
    category: item.category || '',
    budgetedAmount: item.budgetedAmount || 0,
    totalAllocated: item.totalAllocated,
    remaining: (item.budgetedAmount || 0) - item.totalAllocated,
    allocationCount: item.allocationCount,
    activeMonths: item.activeMonths,
    note: item.note || '',
    status: item.grant.status,
    utilizationRate: (item.budgetedAmount || 0) > 0 
      ? Math.round((item.totalAllocated / (item.budgetedAmount || 1)) * 100)
      : 0
  }));
  $: console.log('⭐ formattedBudgetItems.length:', formattedBudgetItems?.length || 0);

  // グリッド設定変数
  let gridApi: any;
  let isEditing = false;
  let selectedRows: any[] = [];
  let showCSVImporter = false;
  let showMonthlyData = true;
  let tableElement: HTMLElement;
  let tabulator: any;

  // 月データ表示設定
  let monthDisplaySettings = {
    budget: true,      // 予算
    used: false,       // 使用額
    remaining: false,  // 残額
    utilization: false // 使用率
  };

  // 設定変更時の行の高さ計算
  $: activeSettingsCount = Object.values(monthDisplaySettings).filter(Boolean).length;
  $: dynamicRowHeight = Math.max(40, 30 + (activeSettingsCount * 15)); // 基本30px + 設定項目数 * 15px
  
  // デバッグ用ログ
  $: {
    console.log('💫 月データ表示設定:', monthDisplaySettings);
    console.log('💫 アクティブ設定数:', activeSettingsCount);
    console.log('💫 動的行の高さ:', dynamicRowHeight);
  }

  // 金額フォーマット関数
  const formatCurrency = (value: number | null | undefined): string => {
    if (!value || value === 0) return '-';
    return `¥${Math.abs(value).toLocaleString()}`;
  };

  // 使用率の色分けクラス取得
  const getUtilizationClass = (rate: number): string => {
    if (rate >= 100) return 'text-red-600 font-bold';
    if (rate >= 80) return 'text-orange-600 font-semibold';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  // レスポンシブ検知
  let innerWidth = 0;
  $: isMobile = innerWidth < 768;
  $: isTablet = innerWidth >= 768 && innerWidth < 1024;

  // 月別列の生成
  const monthColumns = Array.from({ length: 12 }, (_, i) => i + 1);

  // レスポンシブ列定義関数
  const createResponsiveColumns = () => {
    // モバイル用の簡略列定義
    if (isMobile) {
      return [
        { 
          id: "name", 
          header: "項目名", 
          width: 200,
          sort: true,
          editable: true,
          cellClass: "font-medium text-sm"
        },
        { 
          id: "budgetedAmount", 
          header: "予算", 
          width: 100,
          align: "right",
          sort: true,
          editable: true,
          cellClass: "font-mono text-xs",
          template: (value: any) => `<div class="text-right text-xs">${formatCurrency(value)}</div>`
        },
        { 
          id: "utilizationRate", 
          header: "使用率", 
          width: 80,
          align: "center",
          sort: true,
          cellClass: "text-xs",
          template: (value: any) => {
            const colorClass = getUtilizationClass(value);
            return `<span class="text-xs ${colorClass}">${value}%</span>`;
          }
        },
        {
          id: "actions",
          header: "操作",
          width: 60,
          sortable: false,
          cellClass: "text-center",
          template: (value: any, row: any) => `
            <button 
              class="p-2 text-blue-600 hover:bg-blue-50 rounded"
              onclick="editBudgetItem(${row.id})"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          `
        }
      ];
    }
    
    // タブレット用の中程度簡略列定義
    if (isTablet) {
      return [
        { 
          id: "grantName", 
          header: "助成金", 
          width: 140,
          fixed: "left",
          sort: true,
          filter: true,
          cellClass: "font-medium bg-gray-50 text-sm"
        },
        { 
          id: "name", 
          header: "項目名", 
          width: 180,
          fixed: "left",
          sort: true,
          editable: true,
          cellClass: "font-medium bg-gray-50 text-sm"
        },
        { 
          id: "budgetedAmount", 
          header: "予算額", 
          width: 110,
          align: "right",
          sort: true,
          editable: true,
          cellClass: "font-mono text-sm",
          template: (value) => `<div class="text-right text-sm">${formatCurrency(value)}</div>`
        },
        { 
          id: "totalAllocated", 
          header: "使用額", 
          width: 110,
          align: "right",
          sort: true,
          cellClass: "font-mono text-sm",
          template: (value) => `<div class="text-right text-sm text-orange-700">${formatCurrency(value)}</div>`
        },
        { 
          id: "utilizationRate", 
          header: "使用率", 
          width: 90,
          align: "center",
          sort: true,
          template: (value) => {
            const colorClass = getUtilizationClass(value);
            return `<span class="text-sm ${colorClass}">${value}%</span>`;
          }
        },
        {
          id: "actions",
          header: "操作",
          width: 80,
          sortable: false,
          cellClass: "text-center",
          template: (value: any, row: any) => `
            <div class="flex justify-center">
              <button 
                class="p-1 text-blue-600 hover:bg-blue-50 rounded"
                onclick="editBudgetItem(${row.id})"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          `
        }
      ];
    }
    
    // デスクトップ用のフル列定義
    return [
      // 固定列（助成金名・項目名）
      { 
        id: "grantName", 
        header: "助成金名", 
        width: 180,
        fixed: "left",
        sort: true,
        filter: true,
        cellClass: "font-medium bg-gray-50"
      },
      { 
        id: "name", 
        header: "項目名", 
        width: 220,
        fixed: "left",
        sort: true,
        editable: true,
        cellClass: "font-medium bg-gray-50"
      },
      // 数値データ列
      { 
        id: "budgetedAmount", 
        header: "予算額", 
        width: 120,
        align: "right",
        sort: true,
        editable: true,
        cellClass: "font-mono",
        template: (value: any) => `<div class="text-right">${formatCurrency(value)}</div>`
      },
      { 
        id: "totalAllocated", 
        header: "使用額", 
        width: 120,
        align: "right",
        sort: true,
        cellClass: "font-mono",
        template: (value) => `<div class="text-right text-orange-700">${formatCurrency(value)}</div>`
      },
      { 
        id: "remainingAmount", 
        header: "残額", 
        width: 120,
        align: "right",
        sort: true,
        cellClass: "font-mono",
        template: (value: any) => {
          const colorClass = value < 0 ? 'text-red-600' : 'text-green-600';
          return `<div class="text-right ${colorClass}">${formatCurrency(value)}</div>`;
        }
      },
      { 
        id: "utilizationRate", 
        header: "使用率", 
        width: 100,
        align: "center",
        sort: true,
        template: (value: any) => {
          const colorClass = getUtilizationClass(value);
          return `
            <div class="flex items-center justify-center">
              <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                <div class="utilization-bar bg-blue-600 h-2 rounded-full" style="width: ${Math.min(value, 100)}%"></div>
              </div>
              <span class="text-sm ${colorClass} font-medium">${value}%</span>
            </div>
          `;
        }
      },
      // 月別データ列（動的に生成）
      ...monthColumns.map(month => ({
        id: `month_${month}`,
        header: `${month}月`,
        width: 120,
        align: "center",
        cellClass: "text-xs",
        template: (value: any, row: any) => {
          const monthData = getMonthData(row, month);
          const activeSettings = Object.entries(monthDisplaySettings).filter(([_, active]) => active);
          
          if (activeSettings.length === 0) return '<div class="text-gray-400">-</div>';
          
          return `
            <div class="space-y-1">
              ${activeSettings.map(([key, _]) => {
                switch(key) {
                  case 'budget':
                    return `<div class="text-blue-600">予算: ${formatCurrency(monthData.budget || 0)}</div>`;
                  case 'used':
                    return `<div class="text-orange-600">使用: ${formatCurrency(monthData.used || 0)}</div>`;
                  case 'remaining':
                    const remaining = (monthData.budget || 0) - (monthData.used || 0);
                    const remainingClass = remaining < 0 ? 'text-red-600' : 'text-green-600';
                    return `<div class="${remainingClass}">残額: ${formatCurrency(remaining)}</div>`;
                  case 'utilization':
                    const rate = monthData.budget > 0 ? Math.round((monthData.used / monthData.budget) * 100) : 0;
                    const rateClass = getUtilizationClass(rate);
                    return `<div class="${rateClass}">率: ${rate}%</div>`;
                  default:
                    return '';
                }
              }).join('')}
            </div>
          `;
        }
      })),
      // 操作列
      {
        id: "actions",
        header: "操作",
        width: 80,
        sortable: false,
        cellClass: "text-center",
        template: (value, row) => `
          <div class="flex justify-center space-x-1">
            <button 
              class="p-2 text-blue-600 hover:bg-blue-50 rounded"
              onclick="editBudgetItem(${row.id})"
              title="編集"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        `
      }
    ];
  };

  // 月別データ取得関数
  function getMonthData(row: any, month: number) {
    return {
      budget: (row.budgetedAmount || 0) / 12,
      used: row.monthlyData?.[month] || 0,
    };
  }

  // 統計データの計算
  $: stats = {
    totalBudget: budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0),
    totalAllocated: budgetItems.reduce((sum, item) => sum + (item.totalAllocated || 0), 0),
    totalRemaining: budgetItems.reduce((sum, item) => {
      const remaining = (item.budgetedAmount || 0) - (item.totalAllocated || 0);
      return sum + remaining;
    }, 0),
    totalItems: budgetItems.length,
    activeGrants: Array.from(new Set(budgetItems.map(item => item.grant.id))).length,
    overBudgetItems: budgetItems.filter(item => (item.totalAllocated || 0) > (item.budgetedAmount || 0)).length
  };

  $: overallUtilization = stats.totalBudget > 0 
    ? Math.round((stats.totalAllocated / stats.totalBudget) * 100)
    : 0;

  // 不足している変数の追加
  let updateMessage = '';
  let updateError = '';
  let isUpdating = false;
  let monthlyStats: any = null;
  $: displayData = budgetItems;

  // バルク操作の関数
  function handleBulkDelete() {
    // バルク削除の実装
    console.log('バルク削除:', selectedRows);
  }

  function handleBulkExport() {
    // バルク出力の実装
    console.log('バルク出力:', selectedRows);
  }

  // Tabulatorの初期化と管理
  onMount(() => {
    console.log('📍 onMount started - initializing Tabulator');
    initializeTabulator();
  });

  // Tabulatorの初期化関数
  async function initializeTabulator() {
    if (!tableElement || !formattedBudgetItems?.length) {
      console.log('⏰ Delaying Tabulator initialization - missing element or data');
      setTimeout(initializeTabulator, 100);
      return;
    }

    try {
      console.log('🚀 Loading Tabulator dynamically...');
      
      // TabulatorのCSSを動的に読み込み
      if (typeof window !== 'undefined' && !document.querySelector('link[href*="tabulator"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/tabulator-tables@6.3.0/dist/css/tabulator.min.css';
        document.head.appendChild(link);
      }
      
      const { TabulatorFull: Tabulator } = await import('tabulator-tables');
      
      console.log('🚀 Creating Tabulator with', formattedBudgetItems.length, 'items');
      
      const columns = createResponsiveColumns();
      
      tabulator = new Tabulator(tableElement, {
        data: formattedBudgetItems,
        columns: columns.map(col => ({
          title: col.header,
          field: col.id,
          width: col.width,
          sorter: col.sort ? "alphanum" : false,
          formatter: col.template ? "html" : undefined,
          formatterParams: col.template ? {
            html: (cell: any) => col.template(cell.getValue(), cell.getRow().getData())
          } : undefined,
          headerFilter: col.filter ? "input" : false,
          frozen: col.fixed === "left",
          hozAlign: col.align || "left",
          cssClass: col.cellClass || "",
          editor: col.editable ? "input" : false
        })),
        layout: "fitDataStretch",
        responsiveLayout: "hide",
        height: "auto",
        maxHeight: "600px",
        selectable: true,
        selectableCheck: () => true,
        rowHeight: dynamicRowHeight,
        pagination: true,
        paginationSize: 50,
        paginationSizeSelector: [25, 50, 100, 200],
        movableColumns: !isMobile,
        resizableColumns: !isMobile,
        tooltips: true,
        addRowPos: "top",
        history: true,
        clipboard: true,
        clipboardCopyStyled: false,
        printAsHtml: true,
        printStyled: true,
        printRowRange: "all",
        downloadEncoder: function(fileContents: any, mimeType: any) {
          return new Blob([fileContents], {type: mimeType});
        },
        rowSelectionChanged: function(data: any, rows: any) {
          selectedRows = data;
          console.log('🔄 Row selection changed:', data.length, 'rows selected');
        },
        cellEdited: function(cell: any) {
          console.log('📝 Cell edited:', cell.getField(), '=', cell.getValue());
          // セル編集後の処理をここに実装
        },
        tableBuilt: function() {
          console.log('✅ Tabulator table built successfully');
        }
      });

      // gridApiとの互換性のため
      gridApi = {
        exportToCsv: () => tabulator?.download("csv", "budget-items.csv"),
        refresh: () => tabulator?.redraw(true),
        setData: (data: any) => tabulator?.setData(data)
      };

    } catch (error) {
      console.error('❌ Tabulator initialization failed:', error);
      updateError = 'テーブルの初期化に失敗しました: ' + error.message;
    }
  }

  // データ変更時のテーブル更新
  $: if (tabulator && formattedBudgetItems) {
    console.log('🔄 Updating Tabulator data:', formattedBudgetItems.length, 'items');
    tabulator.setData(formattedBudgetItems);
  }

  // 行の高さ変更時の再描画
  $: if (tabulator && dynamicRowHeight) {
    console.log('📏 Updating row height:', dynamicRowHeight, 'px');
    tabulator.setHeight(dynamicRowHeight);
    tabulator.redraw(true);
  }

  // レスポンシブ変更時の列再構築
  $: if (tabulator && (isMobile || isTablet)) {
    console.log('📱 Responsive layout changed, rebuilding columns');
    const newColumns = createResponsiveColumns();
    tabulator.setColumns(newColumns.map(col => ({
      title: col.header,
      field: col.id,
      width: col.width,
      sorter: col.sort ? "alphanum" : false,
      formatter: col.template ? "html" : undefined,
      formatterParams: col.template ? {
        html: (cell: any) => col.template(cell.getValue(), cell.getRow().getData())
      } : undefined,
      headerFilter: col.filter ? "input" : false,
      frozen: col.fixed === "left",
      hozAlign: col.align || "left",
      cssClass: col.cellClass || "",
      editor: col.editable ? "input" : false
    })));
  }

  // グローバル関数（templateから呼び出される）
  if (typeof window !== 'undefined') {
    (window as any).editBudgetItem = (id: number) => {
      console.log('✏️ Edit budget item:', id);
      // 編集モーダルを開く処理をここに実装
    };
  }</script>

<style>
  /* Tabulatorのカスタムスタイル */
  :global(.tabulator) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    border: none;
  }

  :global(.tabulator .tabulator-header) {
    background-color: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
  }

  :global(.tabulator .tabulator-header .tabulator-col) {
    background-color: #f9fafb;
    border-right: 1px solid #e5e7eb;
    padding: 8px 12px;
  }

  :global(.tabulator .tabulator-header .tabulator-col.tabulator-frozen.tabulator-frozen-left) {
    background-color: #f3f4f6;
    font-weight: 600;
    border-right: 2px solid #d1d5db;
  }

  :global(.tabulator .tabulator-row) {
    border-bottom: 1px solid #f3f4f6;
  }

  :global(.tabulator .tabulator-row:hover) {
    background-color: #f9fafb;
  }

  :global(.tabulator .tabulator-row.tabulator-selected) {
    background-color: #eff6ff;
  }

  :global(.tabulator .tabulator-cell) {
    padding: 8px 12px;
    border-right: 1px solid #f3f4f6;
    vertical-align: middle;
  }

  :global(.tabulator .tabulator-cell.tabulator-frozen.tabulator-frozen-left) {
    background-color: #f9fafb;
    border-right: 2px solid #e5e7eb;
    font-weight: 500;
    position: sticky;
    left: 0;
    z-index: 10;
  }

  :global(.tabulator .tabulator-cell.tabulator-editing) {
    background-color: #eff6ff;
    border: 2px solid #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
  }

  /* モバイル用の調整 */
  @media (max-width: 767px) {
    :global(.tabulator) {
      font-size: 12px;
    }
    
    :global(.tabulator .tabulator-cell) {
      padding: 6px 8px;
    }
    
    :global(.tabulator .tabulator-header .tabulator-col) {
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
    }
  }

  /* タブレット用の調整 */
  @media (min-width: 768px) and (max-width: 1023px) {
    :global(.tabulator .tabulator-cell) {
      padding: 8px 10px;
    }
  }

  /* 使用率バーのアニメーション */
  :global(.utilization-bar) {
    transition: width 0.3s ease-in-out;
  }

  /* ページネーション */
  :global(.tabulator .tabulator-footer) {
    background-color: #f9fafb;
    border-top: 1px solid #e5e7eb;
    padding: 8px 12px;
  }

  :global(.tabulator .tabulator-paginator) {
    color: #374151;
  }

  :global(.tabulator .tabulator-page) {
    background-color: #ffffff;
    border: 1px solid #d1d5db;
    color: #374151;
    margin: 0 2px;
    padding: 6px 12px;
    border-radius: 4px;
  }

  :global(.tabulator .tabulator-page.active) {
    background-color: #3b82f6;
    color: #ffffff;
    border-color: #3b82f6;
  }

  :global(.tabulator .tabulator-page:hover) {
    background-color: #f3f4f6;
  }

  /* wx-svelte-gridのカスタムスタイル（互換性のため残す） */
  :global(.wx-grid) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* 固定列のスタイリング */
  :global(.wx-grid .wx-cell.fixed-left) {
    background-color: #f9fafb;
    border-right: 2px solid #e5e7eb;
    font-weight: 500;
    position: sticky;
    left: 0;
    z-index: 10;
  }

  /* モバイル用のグリッド調整 */
  @media (max-width: 767px) {
    :global(.wx-grid) {
      font-size: 14px;
    }
    
    :global(.wx-grid .wx-cell) {
      padding: 8px 4px;
    }
    
    :global(.wx-grid .wx-header) {
      font-size: 12px;
      font-weight: 600;
    }
    
    /* モバイルではスクロールバーを薄く */
    :global(.wx-grid .wx-scrollbar) {
      height: 8px;
    }
    
    :global(.wx-grid .wx-scrollbar-thumb) {
      background-color: #cbd5e1;
      border-radius: 4px;
    }
  }

  /* タブレット用の調整 */
  @media (min-width: 768px) and (max-width: 1023px) {
    :global(.wx-grid .wx-cell) {
      padding: 10px 6px;
    }
  }

  /* 編集中のセルのスタイル */
  :global(.wx-grid .wx-cell.editing) {
    background-color: #eff6ff;
    border: 2px solid #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
  }

  /* 使用率バーのアニメーション */
  :global(.utilization-bar) {
    transition: width 0.3s ease-in-out;
  }

  /* ローディングスピナー */
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  /* レスポンシブグリッドの調整 */
  .responsive-grid {
    transition: all 0.2s ease-in-out;
  }

  /* モバイル用のコンパクトビュー */
  @media (max-width: 767px) {
    .mobile-compact {
      padding: 0.5rem;
    }
    
    .mobile-compact h2 {
      font-size: 1.25rem;
    }
    
    .mobile-compact .stats-grid {
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }
    
    .mobile-compact .stats-card {
      padding: 0.75rem;
    }
    
    .mobile-compact .stats-card .stats-value {
      font-size: 0.875rem;
    }
  }
  
  /* パフォーマンス最適化: GPUアクセラレーション */
  :global(.wx-grid .wx-cell),
  :global(.wx-grid .wx-header) {
    will-change: transform;
    transform: translateZ(0);
  }

  /* スクロールパフォーマンス */
  :global(.wx-grid .wx-viewport) {
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }
</style>

<svelte:window bind:innerWidth />

<div class="space-y-6 {isMobile ? 'px-2' : 'px-4'}">
  <!-- ページヘッダー -->
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-2xl font-bold text-gray-900">
        予算項目管理
      </h2>
      <p class="mt-2 text-sm text-gray-600">
        助成金別の予算項目と使用状況を管理できます
      </p>
    </div>
    
    <div class="flex space-x-3">
      <button 
        on:click={() => showCSVImporter = true}
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        CSVインポート
      </button>
      <button class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
        予算項目追加
      </button>
      <button class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
        CSVエクスポート
      </button>
    </div>
  </div>

  <!-- 統計情報（レスポンシブグリッド） -->
  <div class="grid {isMobile ? 'grid-cols-2 gap-2' : isTablet ? 'grid-cols-3 gap-3' : 'grid-cols-5 gap-4'}">
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">項</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">予算項目数</dt>
              <dd class="text-lg font-medium text-gray-900">{stats.totalItems}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">助</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">進行中助成金</dt>
              <dd class="text-lg font-medium text-gray-900">{stats.activeGrants}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">予</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">総予算額</dt>
              <dd class="text-sm font-medium text-gray-900">¥{stats.totalBudget.toLocaleString()}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">使</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">総使用額</dt>
              <dd class="text-sm font-medium text-gray-900">¥{stats.totalAllocated.toLocaleString()}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 {overallUtilization > 90 ? 'bg-red-500' : overallUtilization > 70 ? 'bg-orange-500' : 'bg-blue-500'} rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">率</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">全体使用率</dt>
              <dd class="text-lg font-medium text-gray-900">{overallUtilization}%</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 助成金別サマリー（モバイルでは簡略表示） -->
  {#if !isMobile}
    <div class="bg-white shadow rounded-lg">
      <div class="px-4 py-5 sm:p-6">
        <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
          助成金別サマリー
        </h3>
        <div class="grid {isTablet ? 'grid-cols-2' : 'grid-cols-3'} gap-6">
        {#each grants as grant}
          {@const grantBudget = grant.budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0)}
          {@const grantAllocated = grant.budgetItems.reduce((sum, item) => sum + item.allocations.reduce((subSum, a) => subSum + a.amount, 0), 0)}
          {@const grantUtilization = grantBudget > 0 ? Math.round((grantAllocated / grantBudget) * 100) : 0}
          
          <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex justify-between items-start mb-2">
              <h4 class="text-md font-medium text-gray-900">{grant.name}</h4>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                {grant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                {grant.status === 'active' ? '進行中' : grant.status}
              </span>
            </div>
            {#if grant.grantCode}
              <p class="text-sm text-gray-600 mb-2">コード: {grant.grantCode}</p>
            {/if}
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">予算項目数:</span>
                <span class="font-medium">{grant.budgetItems.length}件</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">総予算額:</span>
                <span class="font-medium">¥{grantBudget.toLocaleString()}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">使用額:</span>
                <span class="font-medium">¥{grantAllocated.toLocaleString()}</span>
              </div>
              <div class="flex justify-between text-sm pt-2 border-t">
                <span class="text-gray-600">使用率:</span>
                <span class="font-medium {grantUtilization > 90 ? 'text-red-600' : grantUtilization > 70 ? 'text-orange-600' : 'text-blue-600'}">
                  {grantUtilization}%
                </span>
              </div>
              <!-- 使用率バー -->
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="h-2 rounded-full {grantUtilization > 90 ? 'bg-red-500' : grantUtilization > 70 ? 'bg-orange-500' : 'bg-blue-500'}" 
                     style="width: {Math.min(grantUtilization, 100)}%"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
  {/if}

  <!-- 予算項目一覧 -->
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
      <h3 class="text-lg leading-6 font-medium text-gray-900">
        予算項目詳細
      </h3>
      <p class="mt-1 max-w-2xl text-sm text-gray-500">
        全ての予算項目の詳細情報と使用状況
      </p>
    </div>
    
    <div class="p-4">
      <!-- グリッドコントロール（レスポンシブ） -->
      <div class="{isMobile ? 'space-y-2' : 'flex justify-between items-center'} mb-4">
        <div class="{isMobile ? 'flex flex-col space-y-2' : 'flex items-center space-x-4'}">
          {#if !isMobile}
            <button 
              class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              on:click={() => showMonthlyData = !showMonthlyData}
            >
              {showMonthlyData ? '基本表示' : '月別表示'}
            </button>
          {/if}

          <!-- 月データ表示設定（月別表示時のみ） -->
          {#if showMonthlyData && !isMobile}
            <div class="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2">
              <span class="text-sm font-medium text-gray-700">表示項目:</span>
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={monthDisplaySettings.budget}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700">予算</span>
              </label>
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={monthDisplaySettings.used}
                  class="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700">使用額</span>
              </label>
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={monthDisplaySettings.remaining}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700">残額</span>
              </label>
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={monthDisplaySettings.utilization}
                  class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700">使用率</span>
              </label>
            </div>
          {/if}
          
          <!-- モバイル用月データ表示設定 -->
          {#if showMonthlyData && isMobile}
            <div class="bg-gray-50 rounded-lg p-3">
              <div class="text-sm font-medium text-gray-700 mb-2">表示項目:</div>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    bind:checked={monthDisplaySettings.budget}
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">予算</span>
                </label>
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    bind:checked={monthDisplaySettings.used}
                    class="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">使用額</span>
                </label>
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    bind:checked={monthDisplaySettings.remaining}
                    class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">残額</span>
                </label>
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    bind:checked={monthDisplaySettings.utilization}
                    class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">使用率</span>
                </label>
              </div>
            </div>
          {/if}
          
          {#if selectedRows.length > 0}
            <div class="{isMobile ? 'flex flex-col space-y-2' : 'flex items-center space-x-2'}">
              <span class="text-sm text-gray-600">{selectedRows.length}件選択中</span>
              <button 
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                disabled={isUpdating}
                on:click={handleBulkDelete}
              >
                {#if isUpdating}
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                {/if}
                一括削除
              </button>
              <button 
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                on:click={handleBulkExport}
              >
                選択項目をエクスポート
              </button>
            </div>
          {/if}
        </div>
        
        <div class="{isMobile ? 'flex flex-col space-y-2 mt-2' : 'flex items-center space-x-2'}">
          {#if !isMobile}
            <button 
              class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              on:click={() => gridApi?.exportToCsv()}
            >
              <svg class="-ml-0.5 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSVエクスポート
            </button>
          {/if}
          
          <button 
            class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            on:click={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
          >
            <svg class="-ml-0.5 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            更新
          </button>
        </div>
      </div>

      <!-- 月別統計情報（月別表示時のみ） -->
      {#if showMonthlyData && monthlyStats}
        <div class="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <h4 class="text-sm font-semibold text-indigo-800 mb-2">月別支出統計</h4>
          <div class="grid grid-cols-6 gap-4 text-xs">
            {#each monthlyStats.monthlyTotals as monthTotal, i}
              <div class="text-center">
                <div class="text-indigo-600 font-medium">{i + 1}月</div>
                <div class="text-indigo-800 font-mono">
                  {monthTotal > 0 ? formatCurrency(monthTotal) : '-'}
                </div>
              </div>
            {/each}
          </div>
          <div class="mt-3 pt-3 border-t border-indigo-200 flex justify-between text-sm">
            <div>
              <span class="text-indigo-700 font-medium">最大支出月:</span>
              <span class="text-indigo-900 font-semibold ml-1">
                {monthlyStats.peakMonth.month}月 ({formatCurrency(monthlyStats.peakMonth.amount)})
              </span>
            </div>
            <div>
              <span class="text-indigo-700 font-medium">月平均:</span>
              <span class="text-indigo-900 font-semibold ml-1">
                {formatCurrency(monthlyStats.monthlyTotals.reduce((a, b) => a + b, 0) / 12)}
              </span>
            </div>
          </div>
        </div>
      {/if}

      <!-- 更新ステータスメッセージ -->
      {#if updateMessage}
        <div class="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <div class="flex">
            <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div class="ml-3">
              <p class="text-sm text-green-800">{updateMessage}</p>
            </div>
          </div>
        </div>
      {/if}
      
      {#if updateError}
        <div class="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div class="flex">
            <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div class="ml-3">
              <p class="text-sm text-red-800">{updateError}</p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Tabulator Table -->
      <div class="border border-gray-200 rounded-lg overflow-hidden {isUpdating ? 'opacity-75 pointer-events-none' : ''}">
        <div bind:this={tableElement} class="w-full"></div>
      </div>
      
      <!-- グリッド情報 -->
      <div class="mt-4 {isMobile ? 'space-y-2 text-xs' : 'flex justify-between items-center text-sm'} text-gray-600">
        <div>
          表示中: {displayData.length}件 / 全{budgetItems.length}件
          {#if showMonthlyData}
            <span class="ml-2 text-indigo-600 font-medium">(月別表示)</span>
          {/if}
        </div>
        <div class="{isMobile ? 'space-y-1' : 'flex items-center space-x-4'}">
          {#if selectedRows.length > 0}
            <span>{selectedRows.length}行選択中</span>
          {/if}
          {#if !isMobile}
            <span>最終更新: {new Date().toLocaleString('ja-JP')}</span>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- 予算超過アラート -->
  {#if stats.overBudgetItems > 0}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">
            予算超過アラート
          </h3>
          <p class="mt-2 text-sm text-red-700">
            {stats.overBudgetItems}件の予算項目で予算額を超過しています。予算の見直しが必要です。
          </p>
        </div>
      </div>
    </div>
  {/if}

<!-- CSVインポートモーダル -->
{#if showCSVImporter}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-4 mx-auto p-4 border w-full max-w-4xl shadow-lg rounded-md bg-white">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold text-gray-900">予算項目CSVインポート</h3>
        <button 
          on:click={() => showCSVImporter = false}
          class="text-gray-400 hover:text-gray-600"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <CSVImporter 
        importType="budget-items"
        onSuccess={() => {
          showCSVImporter = false;
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
        onError={(errorMessage) => {
          updateError = errorMessage;
        }}
      />
    </div>
  </div>
{/if}
</div>