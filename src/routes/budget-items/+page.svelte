<script>
  console.log('📍 Script block started');
  import { onMount } from "svelte";
  import CSVImporter from '$lib/components/CSVImporter.svelte';
  
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
    utilizationRate: item.budgetedAmount > 0 
      ? Math.round((item.totalAllocated / item.budgetedAmount) * 100)
      : 0
  }));
  $: console.log('⭐ formattedBudgetItems.length:', formattedBudgetItems?.length || 0);

  // グリッド設定変数
  let gridApi;
  let isEditing = false;
  let selectedRows = [];
  let showCSVImporter = false;
  let showMonthlyData = true;

  // 金額フォーマット関数
  const formatCurrency = (value) => {
    if (!value || value === 0) return '-';
    return `¥${Math.abs(value).toLocaleString()}`;
  };

  // 使用率の色分けクラス取得
  const getUtilizationClass = (rate) => {
    if (rate > 90) return 'text-red-600 font-bold';
    if (rate > 70) return 'text-orange-600 font-semibold';
    if (rate > 0) return 'text-blue-600';
    return 'text-gray-500';
  };

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
          template: (value) => `<div class="text-right text-xs">${formatCurrency(value)}</div>

<style>
  /* wx-svelte-gridのカスタムスタイル */
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
</style>`
        },
        { 
          id: "utilizationRate", 
          header: "使用率", 
          width: 80,
          align: "center",
          sort: true,
          cellClass: "text-xs",
          template: (value) => {
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
          template: (value, row) => `
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
          template: (value, row) => `
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
    // 固定列（助成金名・項目名）
    { 
      id: "grantName", 
      header: "助成金名", 
      width: 180,
      minWidth: 120,
      maxWidth: 220,
      fixed: "left", // 左固定
      sort: true,
      filter: true,
      resizable: true,
      cellClass: "font-medium bg-gray-50 border-r-2 border-gray-200",
      headerClass: "font-semibold bg-blue-50 border-r-2 border-blue-200"
    },
    { 
      id: "name", 
      header: "予算項目名", 
      width: 220,
      minWidth: 150,
      maxWidth: 300,
      fixed: "left", // 左固定
      sort: true,
      filter: true,
      resizable: true,
      editable: true, // 編集可能
      cellClass: "font-medium bg-gray-50 border-r-2 border-gray-200",
      headerClass: "font-semibold bg-blue-50 border-r-2 border-blue-200"
    },
    // 基本情報列
    { 
      id: "grantCode", 
      header: "助成金コード", 
      width: 130,
      sort: true,
      filter: true,
      resizable: true,
      cellClass: "text-xs font-mono"
    },
    { 
      id: "category", 
      header: "カテゴリ", 
      width: 120,
      sort: true,
      filter: true,
      resizable: true,
      editable: true
    },
    // 金額列（右寄せ、特別なフォーマット）
    { 
      id: "budgetedAmount", 
      header: "予算額", 
      width: 130,
      sort: true,
      align: "right",
      resizable: true,
      editable: true,
      cellClass: "font-mono text-sm",
      headerClass: "bg-blue-50",
      template: (value, row) => {
        const amount = formatCurrency(value);
        return `<div class="text-right font-mono text-sm">${amount}</div>`;
      },
      // 編集用のカスタムエディタ
      editor: "number"
    },
    { 
      id: "totalAllocated", 
      header: "使用額", 
      width: 130,
      sort: true,
      align: "right",
      resizable: true,
      cellClass: "font-mono text-sm",
      headerClass: "bg-orange-50",
      template: (value, row) => {
        const amount = formatCurrency(value);
        return `<div class="text-right font-mono text-sm text-orange-700">${amount}</div>`;
      }
    },
    { 
      id: "remaining", 
      header: "残額", 
      width: 130,
      sort: true,
      align: "right",
      resizable: true,
      cellClass: "font-mono text-sm",
      headerClass: "bg-green-50",
      template: (value, row) => {
        const amount = formatCurrency(value);
        let colorClass = "text-gray-500";
        if (value > 0) colorClass = "text-green-600 font-medium";
        else if (value < 0) colorClass = "text-red-600 font-bold";
        
        return `<div class="text-right font-mono text-sm ${colorClass}">${amount}</div>`;
      }
    },
    // 使用率列（特別な表示）
    { 
      id: "utilizationRate", 
      header: "使用率", 
      width: 100,
      sort: true,
      align: "center",
      resizable: true,
      cellClass: "text-center",
      headerClass: "bg-purple-50",
      template: (value, row) => {
        const colorClass = getUtilizationClass(value);
        const barWidth = Math.min(value, 100);
        let barColor = "bg-blue-400";
        if (value > 90) barColor = "bg-red-500";
        else if (value > 70) barColor = "bg-orange-500";
        
        return `
          <div class="flex flex-col items-center space-y-1">
            <span class="text-xs font-medium ${colorClass}">${value}%</span>
            <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div class="h-full ${barColor} transition-all duration-300" style="width: ${barWidth}%"></div>
            </div>
          </div>
        `;
      }
    },
    // 統計列
    { 
      id: "allocationCount", 
      header: "割当件数", 
      width: 100,
      sort: true,
      align: "center",
      resizable: true,
      cellClass: "text-center font-medium"
    },
    { 
      id: "activeMonths", 
      header: "有効月数", 
      width: 100,
      sort: true,
      align: "center",
      resizable: true,
      cellClass: "text-center font-medium"
    },
    // ステータス列
    { 
      id: "status", 
      header: "状態", 
      width: 100,
      sort: true,
      filter: true,
      resizable: true,
      cellClass: "text-center",
      template: (value, row) => {
        const statusConfig = {
          'active': { class: 'bg-green-100 text-green-800', text: '進行中' },
          'completed': { class: 'bg-gray-100 text-gray-800', text: '完了' },
          'pending': { class: 'bg-yellow-100 text-yellow-800', text: '保留中' },
          'cancelled': { class: 'bg-red-100 text-red-800', text: '中止' }
        };
        const config = statusConfig[value] || { class: 'bg-gray-100 text-gray-800', text: value };
        
        return `
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.class}">
            ${config.text}
          </span>
        `;
      }
    },
    // 操作列（アクションボタン）
    {
      id: "actions",
      header: "操作",
      width: 120,
      sortable: false,
      resizable: false,
      cellClass: "text-center",
      template: (value, row) => `
        <div class="flex justify-center space-x-1">
          <button 
            class="inline-flex items-center p-1 border border-transparent rounded text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onclick="editBudgetItem(${row.id})"
            title="編集"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button 
            class="inline-flex items-center p-1 border border-transparent rounded text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-50 focus:outline-none focus:ring-1 focus:ring-green-500"
            onclick="viewDetails(${row.id})"
            title="詳細"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      `
    }
      ];
  };
  
  // レスポンシブ列定義
  $: columns = createResponsiveColumns();

  // レスポンシブデザイン用の状態管理
  let innerWidth = 0;
  let isMobile = false;
  let isTablet = false;
  let isDesktop = false;
  
  // ブレークポイントによるデバイス種別の判定
  $: {
    isMobile = innerWidth < 768;
    isTablet = innerWidth >= 768 && innerWidth < 1024;
    isDesktop = innerWidth >= 1024;
  }
  
  // レスポンシブグリッド設定
  $: gridConfig = {
    // 基本設定（デバイスに応じて調整）
    height: isMobile ? 500 : isTablet ? 550 : 600,
    theme: isMobile ? "compact" : "material", // モバイルはコンパクトテーマ
    // 固定列設定（モバイルでは無効）
    leftCols: isMobile ? 0 : 2, // モバイルでは固定列を無効化
    // 選択設定
    selection: {
      mode: isMobile ? "single" : "multi", // モバイルは単一選択
      checkboxes: !isMobile // モバイルではチェックボックスを非表示
    },
    // ソート設定
    sort: {
      multiColumn: !isMobile // モバイルでは単一ソートのみ
    },
    // フィルター設定
    filter: {
      enabled: true,
      mode: isMobile ? "external" : "header" // モバイルでは外部フィルター
    },
    // ページネーション設定
    pagination: {
      enabled: true,
      size: isMobile ? 20 : isTablet ? 30 : 50, // デバイスに応じてページサイズを調整
      sizeOptions: isMobile ? [10, 20, 50] : [25, 50, 100, 200]
    },
    // リサイズ設定
    resize: {
      enabled: !isMobile, // モバイルではリサイズ無効
      mode: "column"
    },
    // 編集設定
    edit: {
      enabled: true,
      mode: "cell",
      trigger: isMobile ? "click" : "dblclick" // モバイルはシングルクリック
    },
    // エクスポート設定
    export: {
      enabled: !isMobile, // モバイルではエクスポート無効
      formats: ["csv", "excel"]
    },
    // パフォーマンス設定
    virtual: {
      enabled: displayData.length > 100, // 100件以上で仮想スクロールを有効化
      itemHeight: isMobile ? 60 : 40, // モバイルでは行高を大きく
      bufferSize: isMobile ? 5 : 10 // モバイルではバッファサイズを小さく
    },
    // モバイル用の追加設定
    touch: {
      enabled: isMobile,
      swipeToSelect: true,
      longPressToEdit: true
    }
  };

  // 編集関連の状態管理
  let isUpdating = false;
  let updateMessage = '';
  let updateError = '';

  // セル編集ハンドラー（高度な実装）
  const handleCellEdit = async (event) => {
    const { rowIndex, colId, value, oldValue, row } = event.detail;
    
    // 変更がない場合は何もしない
    if (value === oldValue) return;
    
    console.log('Cell edited:', { rowIndex, colId, value, oldValue, budgetItemId: row.id });
    
    // 更新中フラグを設定
    isUpdating = true;
    updateError = '';
    
    try {
      // 更新データの準備
      const updateData = {};
      
      // フィールド別のバリデーションと変換
      switch (colId) {
        case 'name':
          if (value.trim().length === 0) {
            throw new Error('予算項目名は必須です');
          }
          updateData.name = value.trim();
          break;
          
        case 'category':
          updateData.category = value.trim() || null;
          break;
          
        case 'budgetedAmount':
          const amount = parseFloat(value);
          if (isNaN(amount) || amount < 0) {
            throw new Error('予算額は0以上の数値で入力してください');
          }
          updateData.budgetedAmount = amount;
          break;
          
        case 'note':
          updateData.note = value.trim() || null;
          break;
          
        default:
          console.warn('Unsupported column for editing:', colId);
          return;
      }
      
      // APIリクエストを送信
      const response = await fetch(`/api/budget-items/${row.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: 更新に失敗しました`);
      }
      
      const updatedItem = await response.json();
      
      // ローカルデータを更新（リアクティブ更新）
      budgetItems = budgetItems.map(item => 
        item.id === row.id ? { ...item, ...updatedItem } : item
      );
      
      // 成功メッセージを表示
      updateMessage = `${row.name} の ${getFieldDisplayName(colId)} を更新しました`;
      setTimeout(() => { updateMessage = ''; }, 3000);
      
    } catch (error) {
      console.error('Update failed:', error);
      updateError = error.message;
      
      // エラー時は元の値に戻す（グリッドのAPIを使用）
      if (gridApi) {
        gridApi.updateCell(rowIndex, colId, oldValue);
      }
      
      // エラーメッセージを一定時間後にクリア
      setTimeout(() => { updateError = ''; }, 5000);
      
    } finally {
      isUpdating = false;
    }
  };
  
  // フィールド名の表示名を取得
  const getFieldDisplayName = (colId) => {
    const fieldNames = {
      'name': '項目名',
      'category': 'カテゴリ',
      'budgetedAmount': '予算額',
      'note': '備考'
    };
    return fieldNames[colId] || colId;
  };

  const handleRowSelect = (event) => {
    selectedRows = event.detail.selectedRows;
    console.log('Selected rows:', selectedRows);
  };

  const handleSort = (event) => {
    console.log('Sort changed:', event.detail);
  };

  const handleFilter = (event) => {
    console.log('Filter changed:', event.detail);
  };

  // 一括操作関数
  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    
    if (!confirm(`選択した${selectedRows.length}件の予算項目を削除しますか？`)) {
      return;
    }
    
    isUpdating = true;
    updateError = '';
    
    try {
      const deletePromises = selectedRows.map(row => 
        fetch(`/api/budget-items/${row.id}`, { method: 'DELETE' })
      );
      
      const responses = await Promise.all(deletePromises);
      const failedDeletes = responses.filter(response => !response.ok);
      
      if (failedDeletes.length > 0) {
        throw new Error(`${failedDeletes.length}件の削除に失敗しました`);
      }
      
      // ローカルデータから削除
      const deletedIds = selectedRows.map(row => row.id);
      budgetItems = budgetItems.filter(item => !deletedIds.includes(item.id));
      selectedRows = [];
      
      updateMessage = `${selectedRows.length}件の予算項目を削除しました`;
      setTimeout(() => { updateMessage = ''; }, 3000);
      
    } catch (error) {
      console.error('Bulk delete failed:', error);
      updateError = error.message;
      setTimeout(() => { updateError = ''; }, 5000);
    } finally {
      isUpdating = false;
    }
  };
  
  const handleBulkExport = () => {
    if (selectedRows.length === 0) return;
    
    // 選択されたデータをCSV形式でエクスポート
    const csvData = [
      // CSVヘッダー
      [
        '助成金名', '予算項目名', 'カテゴリ', '予算額', '使用額', '残額', '使用率', '状態'
      ],
      // 選択されたデータ
      ...selectedRows.map(row => [
        row.grantName,
        row.name,
        row.category || '',
        row.budgetedAmount || 0,
        row.totalAllocated,
        row.remaining,
        `${row.utilizationRate}%`,
        row.status === 'active' ? '進行中' : row.status
      ])
    ];
    
    // CSVファイルとしてダウンロード
    const csvContent = csvData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `予算項目_選択分_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // アクション関数（グローバルスコープで定義）
  if (typeof window !== 'undefined') {
    window.editBudgetItem = (id) => {
      console.log('Edit budget item:', id);
      // TODO: 編集モーダルを開く
      // 簡易実装: グリッドの編集モードを有効化
      if (gridApi) {
        gridApi.startEditMode(id, 'name'); // 名前フィールドを編集モードに
      }
    };

    window.viewDetails = (id) => {
      console.log('View details:', id);
      // TODO: 詳細ビューを開く
      // 簡易実装: 該当行をハイライト
      if (gridApi) {
        gridApi.selectRow(id);
        gridApi.scrollToRow(id);
      }
    };
  }

  // 月別データを生成・処理する関数
  const getMonthlyData = (budgetItem) => {
    console.log('⚡⚡⚡ getMonthlyData called for:', budgetItem.name, 'budgetedAmount:', budgetItem.budgetedAmount);
    // 実際の実装では、budgetItem.allocations から月別データを集計
    const monthlyData = {};
    const currentYear = new Date().getFullYear();
    
    // 初期化（全月を0で）
    for (let month = 1; month <= 12; month++) {
      monthlyData[month] = 0;
    }
    
    // 実際のallocationデータがある場合の処理例
    if (budgetItem.allocations) {
      budgetItem.allocations.forEach(allocation => {
        const allocDate = new Date(allocation.date || allocation.createdAt);
        if (allocDate.getFullYear() === currentYear) {
          const month = allocDate.getMonth() + 1;
          monthlyData[month] = (monthlyData[month] || 0) + allocation.amount;
        }
      });
    } else {
      // サンプルデータ生成（実際の実装では削除）
      const totalAmount = budgetItem.budgetedAmount;
      if (totalAmount > 0) {
        // 使用額を12ヶ月に分散（変動あり）
        let remainingAmount = totalAmount;
        for (let month = 1; month <= 11; month++) {
          const monthlyAmount = Math.floor((remainingAmount / (13 - month)) * (0.5 + Math.random()));
          monthlyData[month] = monthlyAmount;
          remainingAmount -= monthlyAmount;
        }
        monthlyData[12] = remainingAmount; // 残りを12月に
      }
    }
    
    return monthlyData;
  };
  
  // 月別データを含む拡張データを作成
  $: extendedBudgetItems = formattedBudgetItems.map(item => {
    console.log('🔥🔥🔥 Creating extendedBudgetItems for:', item.name);
    const monthlyData = getMonthlyData(item);
    return {
      ...item,
      monthlyData
    };
  });

  // 月別データ表示用のレスポンシブ列定義
  const createMonthlyColumns = () => {
    // モバイルでは月別表示を簡略化
    if (isMobile) {
      return [
        {
          id: "name", 
          header: "項目名", 
          width: 150,
          sort: true,
          cellClass: "font-medium text-sm"
        },
        // 現在の月と前月のみ表示
        ...Array.from({length: 2}, (_, i) => {
          const currentMonth = new Date().getMonth() + 1;
          const monthIndex = currentMonth - i - 1;
          const displayMonth = monthIndex <= 0 ? 12 + monthIndex : monthIndex;
          
          return {
            id: `month_${displayMonth}`,
            header: `${displayMonth}月`,
            width: 80,
            align: "right",
            cellClass: "font-mono text-xs",
            template: (value, row) => {
              const monthlyAmount = row.monthlyData?.[displayMonth] || 0;
              return `<div class="text-right text-xs">${formatCurrency(monthlyAmount)}</div>`;
            }
          };
        })
      ];
    }
    const monthNames = [
      '1月', '2月', '3月', '4月', '5月', '6月',
      '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    
    return [
      // 固定列（助成金名、項目名）
      ...columns.slice(0, 2),
      // 予算額列（月別表示でも表示）
      columns.find(col => col.id === 'budgetedAmount'),
      // 月別列を動的に追加
      ...monthNames.map((monthName, i) => ({
        id: `month_${i + 1}`,
        header: monthName,
        width: 90,
        minWidth: 70,
        maxWidth: 120,
        align: "right",
        sort: true,
        resizable: true,
        cellClass: "font-mono text-xs",
        headerClass: "bg-indigo-50 text-xs",
        template: (value, row) => {
          const monthlyAmount = row.monthlyData?.[i + 1] || 0;
          if (monthlyAmount === 0) {
            return '<div class="text-right text-gray-400 font-mono text-xs">-</div>';
          }
          
          // 予算の月割り額を計算（参考値）
          const monthlyBudget = (row.budgetedAmount || 0) / 12;
          let colorClass = 'text-blue-600';
          if (monthlyAmount > monthlyBudget * 1.2) {
            colorClass = 'text-red-600 font-medium';
          } else if (monthlyAmount > monthlyBudget) {
            colorClass = 'text-orange-600';
          }
          
          return `<div class="text-right font-mono text-xs ${colorClass}">${formatCurrency(monthlyAmount)}</div>`;
        }
      })),
      // 年間合計列
      {
        id: "yearlyTotal",
        header: "年間計",
        width: 110,
        align: "right",
        sort: true,
        cellClass: "font-mono text-sm font-medium bg-gray-50",
        headerClass: "bg-gray-100 font-semibold",
        template: (value, row) => {
          const yearlyTotal = Object.values(row.monthlyData || {}).reduce((sum, amount) => sum + amount, 0);
          return `<div class="text-right font-mono text-sm font-medium">${formatCurrency(yearlyTotal)}</div>`;
        }
      },
      // ステータス、操作列
      ...columns.slice(-2)
    ];
  };
  
  $: monthlyColumns = createMonthlyColumns();

  // 表示データと列の切り替え
  $: displayData = showMonthlyData ? extendedBudgetItems : formattedBudgetItems;
  $: displayColumns = showMonthlyData ? monthlyColumns : columns;
  
  // 強制的にextendedBudgetItemsを初期化
  $: {
    console.log('💪 formattedBudgetItems.length:', formattedBudgetItems.length);
    if (formattedBudgetItems.length > 0) {
      console.log('💪 Forcing extendedBudgetItems calculation');
      extendedBudgetItems;  // 参照して計算を強制実行
    }
  }
  
  // 月別集計データ（統計用）
  $: monthlyStats = showMonthlyData ? {
    monthlyTotals: Array.from({length: 12}, (_, i) => {
      return extendedBudgetItems.reduce((sum, item) => {
        return sum + (item.monthlyData?.[i + 1] || 0);
      }, 0);
    }),
    peakMonth: (() => {
      const monthlyTotals = Array.from({length: 12}, (_, i) => {
        return extendedBudgetItems.reduce((sum, item) => {
          return sum + (item.monthlyData?.[i + 1] || 0);
        }, 0);
      });
      const maxAmount = Math.max(...monthlyTotals);
      const peakMonthIndex = monthlyTotals.indexOf(maxAmount);
      return { month: peakMonthIndex + 1, amount: maxAmount };
    })()
  } : null;

  // 統計情報を計算
  $: stats = {
    totalItems: budgetItems.length,
    totalBudget: budgetItems.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0),
    totalAllocated: budgetItems.reduce((sum, item) => sum + item.totalAllocated, 0),
    activeGrants: grants.filter(g => g.status === 'active').length,
    overBudgetItems: budgetItems.filter(item => 
      item.budgetedAmount > 0 && item.totalAllocated > item.budgetedAmount
    ).length
  };

  $: overallUtilization = stats.totalBudget > 0 
    ? Math.round((stats.totalAllocated / stats.totalBudget) * 100)
    : 0;
</script>

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

      <!-- wx-svelte-grid -->
      <div class="border border-gray-200 rounded-lg overflow-hidden {isUpdating ? 'opacity-75 pointer-events-none' : ''}">
        <!-- Grid component temporarily disabled -->
        <div class="p-8 text-center text-gray-500">
          <p>グリッド表示は現在開発中です</p>
          <p class="text-sm mt-2">予算項目: {budgetItems.length}件</p>
        </div>
        <!-- 
        <Grid 
          bind:api={gridApi}
          data={displayData} 
          columns={displayColumns}
          config={gridConfig}
          on:cellEdit={handleCellEdit}
          on:rowSelect={handleRowSelect}
          on:sort={handleSort}
          on:filter={handleFilter}
        />
        -->
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