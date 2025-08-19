<script lang="ts">
  import { 
    processMixedCSVFile,
    predictDataTypeFromHeaders,
    generateMixedDataSummary,
    type MixedCSVValidationResult,
    type MixedCSVData
  } from '$lib/utils/mixed-csv-processor';
  import { processCSVFile } from '$lib/utils/csv-processor';

  // Props
  export let onSuccess: (data: MixedCSVData) => void = () => {};
  export let onError: (error: string) => void = () => {};

  // State
  let fileInput: HTMLInputElement;
  let isDragOver = false;
  let isProcessing = false;
  let validationResult: MixedCSVValidationResult | null = null;
  let selectedFile: File | null = null;
  let step: 'upload' | 'preview' | 'complete' = 'upload';
  let predictedType: 'grants' | 'budget-items' | 'mixed' | 'unknown' = 'unknown';

  // File handling
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      processFile(target.files[0]);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      processFile(event.dataTransfer.files[0]);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  // File processing
  async function processFile(file: File) {
    selectedFile = file;
    isProcessing = true;
    validationResult = null;
    predictedType = 'unknown';

    try {
      // まずヘッダーを確認してデータタイプを予測
      const parsedData = await processCSVFile(file);
      predictedType = predictDataTypeFromHeaders(parsedData.headers);
      
      // 混在データとして処理
      const result = await processMixedCSVFile(file);
      validationResult = result;

      if (result.isValid || result.data) {
        step = 'preview';
      } else {
        step = 'upload';
      }
    } catch (error: any) {
      onError(error instanceof Error ? error.message : 'ファイルの処理中にエラーが発生しました');
    } finally {
      isProcessing = false;
    }
  }

  // Import confirmation
  async function confirmImport() {
    if (!validationResult?.data) return;

    isProcessing = true;
    
    try {
      const { grants, budgetItems } = validationResult.data;
      
      // 助成金データのインポート
      if (grants.length > 0) {
        const grantsResponse = await fetch('/api/grants/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: grants })
        });

        if (!grantsResponse.ok) {
          throw new Error(`助成金データのインポートに失敗: ${grantsResponse.status}`);
        }
      }

      // 予算項目データのインポート
      if (budgetItems.length > 0) {
        const budgetItemsResponse = await fetch('/api/budget-items/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: budgetItems })
        });

        if (!budgetItemsResponse.ok) {
          throw new Error(`予算項目データのインポートに失敗: ${budgetItemsResponse.status}`);
        }
      }
      
      onSuccess(validationResult.data);
      step = 'complete';
    } catch (error: any) {
      onError(error instanceof Error ? error.message : 'インポート処理中にエラーが発生しました');
    } finally {
      isProcessing = false;
    }
  }

  // Reset state
  function reset() {
    selectedFile = null;
    validationResult = null;
    predictedType = 'unknown';
    step = 'upload';
    if (fileInput) fileInput.value = '';
  }

  // Get data type label
  function getDataTypeLabel(type: typeof predictedType): string {
    switch (type) {
      case 'grants': return '助成金データ';
      case 'budget-items': return '予算項目データ';
      case 'mixed': return '混在データ（助成金・予算項目）';
      default: return '不明なデータタイプ';
    }
  }

  // Get confidence color
  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.7) return 'text-green-600';
    if (confidence >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  }
</script>

<div class="mixed-csv-importer">
  <!-- Header -->
  <div class="header">
    <h3 class="title">混在CSVデータのインポート</h3>
    <p class="description">
      助成金と予算項目が混在するCSVファイルを自動判定してインポートします。
    </p>
    <p class="example">
      例：同一ファイル内に助成金情報と予算項目情報が含まれるCSV
    </p>
  </div>

  {#if step === 'upload'}
    <!-- File Upload Area -->
    <div class="upload-section">
      <!-- Drag & Drop Area -->
      <div 
        class="drop-zone"
        class:drag-over={isDragOver}
        class:processing={isProcessing}
        on:drop={handleDrop}
        on:dragover={handleDragOver}
        on:dragleave={handleDragLeave}
        role="button"
        tabindex="0"
      >
        {#if isProcessing}
          <div class="processing-indicator">
            <div class="spinner"></div>
            <p>ファイルを解析中...</p>
            {#if predictedType !== 'unknown'}
              <p class="prediction">検出: {getDataTypeLabel(predictedType)}</p>
            {/if}
          </div>
        {:else}
          <div class="upload-content">
            <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
            </svg>
            <p class="upload-text">
              混在CSVファイルをドラッグ＆ドロップするか<br>
              <button type="button" class="file-select-btn" on:click={() => fileInput?.click()}>
                ファイルを選択
              </button>
            </p>
            <p class="supported-formats">サポート形式: .csv (UTF-8, Shift_JIS対応)</p>
          </div>
        {/if}
      </div>

      <!-- Hidden file input -->
      <input
        bind:this={fileInput}
        type="file"
        accept=".csv"
        on:change={handleFileSelect}
        class="hidden"
      />

      <!-- Validation Errors -->
      {#if validationResult && !validationResult.isValid}
        <div class="validation-errors">
          <h4 class="error-title">データの検証でエラーが見つかりました</h4>
          <ul class="error-list">
            {#each validationResult.errors.filter(e => e.field !== 'classification') as error}
              <li class="error-item">
                <strong>行 {error.row}:</strong> 
                {error.field} - {error.message}
                {#if error.value !== undefined}
                  <span class="error-value">（値: {error.value}）</span>
                {/if}
              </li>
            {/each}
          </ul>
          <button type="button" class="btn-retry" on:click={reset}>
            別のファイルを選択
          </button>
        </div>
      {/if}
    </div>

  {:else if step === 'preview'}
    <!-- Preview Section -->
    <div class="preview-section">
      <h4 class="preview-title">インポートプレビュー</h4>
      
      {#if selectedFile && validationResult}
        <div class="file-info">
          <p><strong>ファイル:</strong> {selectedFile.name}</p>
          <p><strong>サイズ:</strong> {(selectedFile.size / 1024).toFixed(1)} KB</p>
          <p><strong>検出タイプ:</strong> {getDataTypeLabel(predictedType)}</p>
        </div>

        <!-- Data Summary -->
        <div class="data-summary">
          <h5 class="summary-title">データ分析結果</h5>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">総行数:</span>
              <span class="stat-value">{validationResult.summary.totalRows}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">助成金データ:</span>
              <span class="stat-value text-blue-600">{validationResult.summary.grantsFound}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">予算項目データ:</span>
              <span class="stat-value text-green-600">{validationResult.summary.budgetItemsFound}</span>
            </div>
            {#if validationResult.summary.unmatchedRows > 0}
              <div class="stat-item">
                <span class="stat-label">判定不明:</span>
                <span class="stat-value text-yellow-600">{validationResult.summary.unmatchedRows}</span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Preview Tables -->
        {#if validationResult.data?.grants && validationResult.data.grants.length > 0}
          <div class="preview-table-section">
            <h5 class="table-title">助成金データプレビュー ({validationResult.data.grants.length}件)</h5>
            <div class="preview-table-container">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>助成金名</th>
                    <th>助成金コード</th>
                    <th>総額</th>
                    <th>開始日</th>
                    <th>終了日</th>
                    <th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {#each validationResult.data.grants.slice(0, 5) as grant}
                    <tr>
                      <td>{grant.name}</td>
                      <td>{grant.grantCode || '-'}</td>
                      <td>{grant.totalAmount ? `¥${grant.totalAmount.toLocaleString()}` : '-'}</td>
                      <td>{grant.startDate || '-'}</td>
                      <td>{grant.endDate || '-'}</td>
                      <td>{grant.status || 'in_progress'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              {#if validationResult.data.grants.length > 5}
                <p class="preview-note">※ 最初の5件を表示しています</p>
              {/if}
            </div>
          </div>
        {/if}

        {#if validationResult.data?.budgetItems && validationResult.data.budgetItems.length > 0}
          <div class="preview-table-section">
            <h5 class="table-title">予算項目データプレビュー ({validationResult.data.budgetItems.length}件)</h5>
            <div class="preview-table-container">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>項目名</th>
                    <th>カテゴリ</th>
                    <th>予算額</th>
                    <th>備考</th>
                    <th>助成金</th>
                  </tr>
                </thead>
                <tbody>
                  {#each validationResult.data.budgetItems.slice(0, 5) as item}
                    <tr>
                      <td>{item.name}</td>
                      <td>{item.category || '-'}</td>
                      <td>{item.budgetedAmount ? `¥${item.budgetedAmount.toLocaleString()}` : '-'}</td>
                      <td>{item.note || '-'}</td>
                      <td>{item.grantName || '-'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              {#if validationResult.data.budgetItems.length > 5}
                <p class="preview-note">※ 最初の5件を表示しています</p>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Warnings for classification errors -->
        {#if validationResult.errors.filter(e => e.field === 'classification').length > 0}
          <div class="classification-warnings">
            <h5 class="warning-title">
              <svg class="warning-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              データタイプ判定の注意事項
            </h5>
            <p class="warning-description">
              以下の行はデータタイプを自動判定できませんでした。手動で確認することをお勧めします。
            </p>
            <ul class="warning-list">
              {#each validationResult.errors.filter(e => e.field === 'classification').slice(0, 10) as error}
                <li class="warning-item">行 {error.row}: {error.message}</li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button type="button" class="btn-secondary" on:click={reset}>
          キャンセル
        </button>
        <button 
          type="button" 
          class="btn-primary" 
          class:processing={isProcessing}
          disabled={isProcessing || !validationResult?.data}
          on:click={confirmImport}
        >
          {#if isProcessing}
            <span class="inline-spinner"></span>
          {/if}
          データをインポート
          {#if validationResult?.summary}
            （助成金: {validationResult.summary.grantsFound}件、予算項目: {validationResult.summary.budgetItemsFound}件）
          {/if}
        </button>
      </div>
    </div>

  {:else if step === 'complete'}
    <!-- Success Message -->
    <div class="success-section">
      <div class="success-content">
        <svg class="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h4 class="success-title">インポート完了</h4>
        <div class="success-message">
          {#if validationResult?.summary}
            <p>助成金データ: {validationResult.summary.grantsFound}件</p>
            <p>予算項目データ: {validationResult.summary.budgetItemsFound}件</p>
            <p class="total">合計 {validationResult.summary.grantsFound + validationResult.summary.budgetItemsFound}件のデータが正常にインポートされました。</p>
          {/if}
        </div>
        <button type="button" class="btn-primary" on:click={reset}>
          新しいファイルをインポート
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .mixed-csv-importer {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1rem;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .description {
    color: #6b7280;
    margin-bottom: 0.5rem;
  }

  .example {
    font-size: 0.875rem;
    color: #9ca3af;
    font-style: italic;
  }

  .upload-section {
    margin-bottom: 2rem;
  }

  .drop-zone {
    border: 2px dashed #d1d5db;
    border-radius: 0.5rem;
    padding: 3rem 2rem;
    text-align: center;
    transition: all 0.2s;
    cursor: pointer;
  }

  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }

  .drop-zone.processing {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .upload-icon {
    width: 3rem;
    height: 3rem;
    color: #9ca3af;
  }

  .upload-text {
    font-size: 1.125rem;
    color: #374151;
    line-height: 1.5;
  }

  .file-select-btn {
    color: #3b82f6;
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    font-size: inherit;
  }

  .file-select-btn:hover {
    color: #1d4ed8;
  }

  .supported-formats {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .processing-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #6b7280;
  }

  .prediction {
    font-weight: 600;
    color: #3b82f6;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .file-info, .data-summary {
    background-color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .file-info p {
    margin: 0.25rem 0;
    color: #4b5563;
  }

  .summary-title {
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .summary-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-label {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .stat-value {
    font-weight: 600;
    color: #1f2937;
  }

  .preview-table-section {
    margin-bottom: 2rem;
  }

  .table-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .preview-table-container {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .preview-table {
    width: 100%;
    border-collapse: collapse;
  }

  .preview-table th {
    background-color: #f9fafb;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
  }

  .preview-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    color: #4b5563;
  }

  .preview-table tr:last-child td {
    border-bottom: none;
  }

  .preview-note {
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
    padding: 0.5rem;
  }

  .classification-warnings {
    background-color: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .warning-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #92400e;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .warning-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .warning-description {
    color: #78350f;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .warning-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .warning-item {
    color: #78350f;
    font-size: 0.875rem;
    padding: 0.125rem 0;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
    border: none;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #f9fafb;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover {
    background-color: #f3f4f6;
  }

  .inline-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .success-section {
    text-align: center;
    padding: 3rem 2rem;
  }

  .success-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .success-icon {
    width: 4rem;
    height: 4rem;
    color: #10b981;
  }

  .success-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
  }

  .success-message {
    color: #6b7280;
    margin-bottom: 1rem;
  }

  .success-message .total {
    font-weight: 600;
    color: #1f2937;
    margin-top: 0.5rem;
  }

  .hidden {
    display: none;
  }

  .validation-errors,
  .btn-retry,
  .error-title,
  .error-list,
  .error-item,
  .error-value {
    /* Copy styles from CSVImporter.svelte */
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .mixed-csv-importer {
      padding: 0.5rem;
    }

    .drop-zone {
      padding: 2rem 1rem;
    }

    .preview-table-container {
      overflow-x: auto;
    }

    .action-buttons {
      flex-direction: column;
    }

    .summary-stats {
      grid-template-columns: 1fr;
    }
  }
</style>