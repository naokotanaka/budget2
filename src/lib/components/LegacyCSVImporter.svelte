<!--
  レガシーCSVファイルインポーター
  nagaiku-budget システムからエクスポートされたCSVファイルを処理
-->

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { 
    ConversionConfig, 
    LegacyImportProgress,
    ConversionResult 
  } from '$lib/types/legacy-csv.js';

  const dispatch = createEventDispatcher<{
    'import-complete': { success: boolean; results?: any; errors?: string[] };
    'progress-update': LegacyImportProgress;
  }>();

  // プロパティ
  export let disabled = false;
  export let autoImport = false; // ファイル選択後に自動実行
  export let showPreview = true; // プレビュー機能の有効化

  // 内部状態
  let fileInput: HTMLInputElement;
  let selectedFile: File | null = null;
  let csvContent = '';
  let isProcessing = false;
  let isDragOver = false;
  let showAdvancedOptions = false;

  // インポート設定
  let config: ConversionConfig = {
    skipInvalidDates: true,
    defaultGrantStatus: 'active' as const,
    preserveLegacyIds: true,
    validateRelationships: true,
    encoding: 'utf-8'
  };

  // 結果とエラー
  let importResult: any = null;
  let previewData: any = null;
  let errors: string[] = [];
  let warnings: string[] = [];
  let progress: LegacyImportProgress = {
    stage: 'parsing',
    current: 0,
    total: 100,
    percentage: 0
  };

  // ファイル選択処理
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
      readFileContent();
    }
  }

  // ドラッグアンドドロップ処理
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files[0] && files[0].type === 'text/csv') {
      selectedFile = files[0];
      readFileContent();
    }
  }

  // ファイル内容読み取り
  async function readFileContent() {
    if (!selectedFile) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        csvContent = e.target?.result as string;
        if (autoImport) {
          performImport(true); // プレビューモードで実行
        }
      };
      
      // エンコーディングに基づいて読み取り
      if (config.encoding === 'shift_jis') {
        reader.readAsText(selectedFile, 'Shift_JIS');
      } else if (config.encoding === 'euc-jp') {
        reader.readAsText(selectedFile, 'EUC-JP');
      } else {
        reader.readAsText(selectedFile, 'UTF-8');
      }
    } catch (error: any) {
      errors = [`ファイル読み取りエラー: ${error}`];
    }
  }

  // プレビュー実行
  async function executePreview() {
    if (!csvContent) return;
    await performImport(true); // dryRun = true
  }

  // インポート実行
  async function performImport(dryRun = false) {
    if (!csvContent) return;

    isProcessing = true;
    errors = [];
    warnings = [];
    importResult = null;
    previewData = null;

    try {
      progress = {
        stage: 'parsing',
        current: 0,
        total: 100,
        percentage: 0,
        message: 'CSVファイルを解析中...'
      };
      dispatch('progress-update', progress);

      const response = await fetch('/api/legacy-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          csvContent,
          filename: selectedFile?.name,
          config,
          dryRun
        })
      });

      const result = await response.json();

      if (result.success) {
        if (dryRun) {
          previewData = result.preview;
          warnings = result.warnings || [];
        } else {
          importResult = result.results;
          progress = {
            stage: 'completed',
            current: 100,
            total: 100,
            percentage: 100,
            message: '処理が完了しました'
          };
        }
        
        dispatch('import-complete', { 
          success: true, 
          results: dryRun ? previewData : importResult,
          errors: result.errors 
        });
      } else {
        errors = result.errors || [result.message];
        dispatch('import-complete', { 
          success: false, 
          errors: errors 
        });
      }

      if (result.warnings) {
        warnings = result.warnings;
      }

    } catch (error: any) {
      errors = [`通信エラー: ${error}`];
      dispatch('import-complete', { 
        success: false, 
        errors: errors 
      });
    }

    isProcessing = false;
  }

  // リセット
  function reset() {
    selectedFile = null;
    csvContent = '';
    importResult = null;
    previewData = null;
    errors = [];
    warnings = [];
    if (fileInput) fileInput.value = '';
  }

  // 進行状況テキスト
  $: progressText = (() => {
    switch (progress.stage) {
      case 'parsing': return 'CSVファイルを解析中...';
      case 'converting': return '新システム形式に変換中...';
      case 'validating': return 'データを検証中...';
      case 'importing': return 'データベースにインポート中...';
      case 'completed': return '処理が完了しました';
      case 'error': return 'エラーが発生しました';
      default: return '処理中...';
    }
  })();
</script>

<div class="legacy-csv-importer">
  <div class="card">
    <div class="card-header">
      <h3>レガシーCSVデータインポート</h3>
      <p class="description">
        nagaiku-budgetシステムからエクスポートされたCSVファイルをインポートします。
      </p>
    </div>

    <div class="card-body">
      <!-- ファイル選択エリア -->
      <div class="file-upload-area">
        <div
          class="dropzone"
          class:drag-over={isDragOver}
          class:has-file={selectedFile}
          on:dragover={handleDragOver}
          on:dragleave={handleDragLeave}
          on:drop={handleDrop}
        >
          {#if selectedFile}
            <div class="file-info">
              <div class="file-icon">📄</div>
              <div class="file-details">
                <div class="file-name">{selectedFile.name}</div>
                <div class="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</div>
              </div>
              <button 
                class="btn btn-sm btn-outline" 
                on:click={reset}
                disabled={isProcessing}
              >
                削除
              </button>
            </div>
          {:else}
            <div class="dropzone-content">
              <div class="dropzone-icon">📂</div>
              <p class="dropzone-text">
                CSVファイルをドロップするか、クリックして選択してください
              </p>
              <input
                bind:this={fileInput}
                type="file"
                accept=".csv"
                on:change={handleFileSelect}
                class="file-input"
                disabled={disabled || isProcessing}
              />
            </div>
          {/if}
        </div>
      </div>

      <!-- 詳細オプション -->
      <div class="options-section">
        <button 
          class="btn btn-link"
          on:click={() => showAdvancedOptions = !showAdvancedOptions}
        >
          詳細オプション {showAdvancedOptions ? '▲' : '▼'}
        </button>

        {#if showAdvancedOptions}
          <div class="advanced-options">
            <div class="form-group">
              <label>
                <input 
                  type="checkbox" 
                  bind:checked={config.skipInvalidDates}
                > 
                無効な日付をスキップ
              </label>
            </div>

            <div class="form-group">
              <label>
                <input 
                  type="checkbox" 
                  bind:checked={config.preserveLegacyIds}
                > 
                レガシーIDを保持
              </label>
            </div>

            <div class="form-group">
              <label>
                <input 
                  type="checkbox" 
                  bind:checked={config.validateRelationships}
                > 
                リレーションシップを検証
              </label>
            </div>

            <div class="form-group">
              <label for="encoding">文字エンコーディング:</label>
              <select id="encoding" bind:value={config.encoding}>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS</option>
                <option value="euc-jp">EUC-JP</option>
              </select>
            </div>

            <div class="form-group">
              <label for="defaultStatus">デフォルト助成金ステータス:</label>
              <select id="defaultStatus" bind:value={config.defaultGrantStatus}>
                <option value="in_progress">進行中</option>
                <option value="completed">完了</option>
                <option value="reported">報告済</option>
              </select>
            </div>
          </div>
        {/if}
      </div>

      <!-- アクションボタン -->
      <div class="actions">
        {#if csvContent && showPreview}
          <button
            class="btn btn-outline"
            on:click={executePreview}
            disabled={isProcessing || disabled}
          >
            プレビュー
          </button>
        {/if}

        <button
          class="btn btn-primary"
          on:click={() => performImport(false)}
          disabled={!csvContent || isProcessing || disabled}
        >
          {isProcessing ? '処理中...' : 'インポート実行'}
        </button>
      </div>

      <!-- 進行状況 -->
      {#if isProcessing}
        <div class="progress-section">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              style="width: {progress.percentage}%"
            ></div>
          </div>
          <p class="progress-text">{progressText}</p>
        </div>
      {/if}

      <!-- プレビューデータ -->
      {#if previewData && !isProcessing}
        <div class="preview-section">
          <h4>インポート プレビュー</h4>
          
          {#if previewData.grants?.length > 0}
            <div class="preview-table">
              <h5>助成金データ (最初の5件)</h5>
              <table>
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>総額</th>
                    <th>期間</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {#each previewData.grants as grant}
                    <tr>
                      <td>{grant.name}</td>
                      <td>{grant.totalAmount ? grant.totalAmount.toLocaleString() + '円' : '-'}</td>
                      <td>
                        {grant.startDate ? new Date(grant.startDate).toLocaleDateString() : '-'} 
                        ~ 
                        {grant.endDate ? new Date(grant.endDate).toLocaleDateString() : '-'}
                      </td>
                      <td>{grant.status}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}

          {#if previewData.budgetItems?.length > 0}
            <div class="preview-table">
              <h5>予算項目データ (最初の5件)</h5>
              <table>
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>カテゴリ</th>
                    <th>予算額</th>
                    <th>助成金ID</th>
                  </tr>
                </thead>
                <tbody>
                  {#each previewData.budgetItems as item}
                    <tr>
                      <td>{item.name}</td>
                      <td>{item.category || '-'}</td>
                      <td>{item.budgetedAmount ? item.budgetedAmount.toLocaleString() + '円' : '-'}</td>
                      <td>{item.legacyGrantId}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}

          {#if previewData.allocations?.length > 0}
            <div class="preview-table">
              <h5>割当データ (最初の5件)</h5>
              <table>
                <thead>
                  <tr>
                    <th>取引ID</th>
                    <th>金額</th>
                    <th>予算項目ID</th>
                  </tr>
                </thead>
                <tbody>
                  {#each previewData.allocations as allocation}
                    <tr>
                      <td>{allocation.transactionId}</td>
                      <td>{allocation.amount.toLocaleString()}円</td>
                      <td>{allocation.legacyBudgetItemId}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}

      <!-- インポート結果 -->
      {#if importResult && !isProcessing}
        <div class="result-section success">
          <h4>✅ インポート完了</h4>
          <div class="result-summary">
            <div class="result-item">
              <span class="label">助成金:</span>
              <span class="value">{importResult.grants.imported}/{importResult.grants.total} 件</span>
            </div>
            <div class="result-item">
              <span class="label">予算項目:</span>
              <span class="value">{importResult.budgetItems.imported}/{importResult.budgetItems.total} 件</span>
            </div>
            <div class="result-item">
              <span class="label">割当:</span>
              <span class="value">{importResult.allocations.imported}/{importResult.allocations.total} 件</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- エラー表示 -->
      {#if errors.length > 0}
        <div class="error-section">
          <h4>⚠️ エラー</h4>
          <ul class="error-list">
            {#each errors as error}
              <li>{error}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- 警告表示 -->
      {#if warnings.length > 0}
        <div class="warning-section">
          <h4>⚠️ 警告</h4>
          <ul class="warning-list">
            {#each warnings as warning}
              <li>{warning}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .legacy-csv-importer {
    max-width: 800px;
    margin: 0 auto;
  }

  .card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .card-header {
    background: #f8f9fa;
    padding: 20px;
    border-bottom: 1px solid #e9ecef;
  }

  .card-header h3 {
    margin: 0 0 8px 0;
    color: #2c3e50;
  }

  .description {
    margin: 0;
    color: #6c757d;
    font-size: 14px;
  }

  .card-body {
    padding: 20px;
  }

  .dropzone {
    border: 2px dashed #d1ecf1;
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
    background: #f8f9fa;
    transition: all 0.2s;
    cursor: pointer;
  }

  .dropzone.drag-over {
    border-color: #007bff;
    background: #e7f3ff;
  }

  .dropzone.has-file {
    border-color: #28a745;
    background: #f0f8f0;
    cursor: default;
  }

  .dropzone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .dropzone-icon {
    font-size: 48px;
    opacity: 0.5;
  }

  .dropzone-text {
    margin: 0;
    color: #6c757d;
  }

  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 16px;
    max-width: 400px;
    margin: 0 auto;
  }

  .file-icon {
    font-size: 32px;
  }

  .file-details {
    flex: 1;
    text-align: left;
  }

  .file-name {
    font-weight: 600;
    color: #2c3e50;
  }

  .file-size {
    font-size: 14px;
    color: #6c757d;
  }

  .options-section {
    margin: 24px 0;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 6px;
  }

  .advanced-options {
    margin-top: 16px;
    display: grid;
    gap: 12px;
  }

  .form-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .form-group select {
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin: 24px 0;
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0056b3;
  }

  .btn-outline {
    background: transparent;
    color: #007bff;
    border: 1px solid #007bff;
  }

  .btn-outline:hover:not(:disabled) {
    background: #007bff;
    color: white;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-link {
    background: none;
    border: none;
    color: #007bff;
    text-decoration: none;
    padding: 8px 0;
  }

  .progress-section {
    margin: 20px 0;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: #007bff;
    transition: width 0.3s ease;
  }

  .progress-text {
    text-align: center;
    color: #6c757d;
    font-size: 14px;
    margin: 0;
  }

  .preview-section,
  .result-section,
  .error-section,
  .warning-section {
    margin: 24px 0;
    padding: 16px;
    border-radius: 6px;
  }

  .preview-section {
    background: #f0f8f0;
    border: 1px solid #d4edda;
  }

  .result-section.success {
    background: #d4edda;
    border: 1px solid #c3e6cb;
  }

  .error-section {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
  }

  .warning-section {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
  }

  .preview-table {
    margin: 16px 0;
  }

  .preview-table h5 {
    margin: 0 0 12px 0;
    color: #2c3e50;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #dee2e6;
  }

  th {
    background: #f8f9fa;
    font-weight: 600;
    color: #495057;
  }

  .result-summary {
    display: grid;
    gap: 8px;
  }

  .result-item {
    display: flex;
    justify-content: space-between;
  }

  .result-item .label {
    font-weight: 500;
  }

  .result-item .value {
    font-weight: 600;
    color: #28a745;
  }

  .error-list,
  .warning-list {
    margin: 8px 0;
    padding-left: 20px;
  }

  .error-list li {
    color: #721c24;
    margin: 4px 0;
  }

  .warning-list li {
    color: #856404;
    margin: 4px 0;
  }
</style>