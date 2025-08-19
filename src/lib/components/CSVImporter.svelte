<script lang="ts">
  import { 
    processCSVFile, 
    validateGrantCSV, 
    validateBudgetItemCSV, 
    convertToGrantObjects,
    convertToBudgetItemObjects,
    type CSVValidationResult,
    type ValidationError,
    type GrantCSVRow,
    type BudgetItemCSVRow
  } from '$lib/utils/csv-processor';

  // Props
  export let importType: 'grants' | 'budget-items' = 'grants';
  export let onSuccess: (data: GrantCSVRow[] | BudgetItemCSVRow[]) => void = () => {};
  export let onError: (error: string) => void = () => {};

  // State
  let fileInput: HTMLInputElement;
  let isDragOver = false;
  let isProcessing = false;
  let validationResult: CSVValidationResult | null = null;
  let previewData: GrantCSVRow[] | BudgetItemCSVRow[] = [];
  let selectedFile: File | null = null;
  let step: 'upload' | 'preview' | 'complete' = 'upload';

  // Labels for UI
  const labels = {
    grants: {
      title: '助成金データのCSVインポート',
      description: '助成金名、期間、金額などの情報を含むCSVファイルをアップロードしてください。',
      example: '例：助成金名, 助成金コード, 総額, 開始日, 終了日, 状態'
    },
    'budget-items': {
      title: '予算項目データのCSVインポート', 
      description: '予算項目名、カテゴリ、予算額などの情報を含むCSVファイルをアップロードしてください。',
      example: '例：項目名, カテゴリ, 予算額, 備考, 助成金名'
    }
  };

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
    previewData = [];

    try {
      // CSVファイルの解析
      const parsedData = await processCSVFile(file);
      
      // データタイプに応じたバリデーション
      let result: CSVValidationResult;
      if (importType === 'grants') {
        result = validateGrantCSV(parsedData);
      } else {
        result = validateBudgetItemCSV(parsedData);
      }

      validationResult = result;

      if (result.isValid && result.data) {
        // プレビューデータの準備
        if (importType === 'grants') {
          previewData = convertToGrantObjects(result.data);
        } else {
          previewData = convertToBudgetItemObjects(result.data);
        }
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
    if (!previewData.length) return;

    isProcessing = true;
    
    try {
      // APIエンドポイントにデータを送信
      const endpoint = importType === 'grants' ? '/api/grants/import' : '/api/budget-items/import';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: previewData })
      });

      if (!response.ok) {
        throw new Error(`インポートに失敗しました: ${response.status}`);
      }

      const result = await response.json();
      
      onSuccess(previewData);
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
    previewData = [];
    step = 'upload';
    if (fileInput) fileInput.value = '';
  }
</script>

<div class="csv-importer">
  <!-- Header -->
  <div class="header">
    <h3 class="title">{labels[importType].title}</h3>
    <p class="description">{labels[importType].description}</p>
    <p class="example text-sm text-gray-600">{labels[importType].example}</p>
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
            <p>ファイルを処理中...</p>
          </div>
        {:else}
          <div class="upload-content">
            <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
            </svg>
            <p class="upload-text">
              CSVファイルをドラッグ＆ドロップするか<br>
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
            {#each validationResult.errors as error}
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
      <h4 class="preview-title">
        インポートプレビュー ({previewData.length} 件のデータ)
      </h4>
      
      {#if selectedFile}
        <div class="file-info">
          <p><strong>ファイル:</strong> {selectedFile.name}</p>
          <p><strong>サイズ:</strong> {(selectedFile.size / 1024).toFixed(1)} KB</p>
        </div>
      {/if}

      <!-- Data Preview Table -->
      <div class="preview-table-container">
        <table class="preview-table">
          <thead>
            <tr>
              {#if importType === 'grants'}
                <th>助成金名</th>
                <th>助成金コード</th>
                <th>総額</th>
                <th>開始日</th>
                <th>終了日</th>
                <th>状態</th>
              {:else}
                <th>項目名</th>
                <th>カテゴリ</th>
                <th>予算額</th>
                <th>備考</th>
                <th>助成金</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each previewData.slice(0, 10) as item, index}
              <tr>
                {#if importType === 'grants'}
                  {@const grant = item as GrantCSVRow}
                  <td>{grant.name}</td>
                  <td>{grant.grantCode || '-'}</td>
                  <td>{grant.totalAmount ? `¥${grant.totalAmount.toLocaleString()}` : '-'}</td>
                  <td>{grant.startDate || '-'}</td>
                  <td>{grant.endDate || '-'}</td>
                  <td>{grant.status || 'in_progress'}</td>
                {:else}
                  {@const budgetItem = item as BudgetItemCSVRow}
                  <td>{budgetItem.name}</td>
                  <td>{budgetItem.category || '-'}</td>
                  <td>{budgetItem.budgetedAmount ? `¥${budgetItem.budgetedAmount.toLocaleString()}` : '-'}</td>
                  <td>{budgetItem.note || '-'}</td>
                  <td>{budgetItem.grantName || '-'}</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>

        {#if previewData.length > 10}
          <p class="preview-note">※ 最初の10件を表示しています</p>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button type="button" class="btn-secondary" on:click={reset}>
          キャンセル
        </button>
        <button 
          type="button" 
          class="btn-primary" 
          class:processing={isProcessing}
          disabled={isProcessing}
          on:click={confirmImport}
        >
          {#if isProcessing}
            <span class="inline-spinner"></span>
          {/if}
          {previewData.length} 件をインポート
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
        <p class="success-message">
          {previewData.length} 件のデータが正常にインポートされました。
        </p>
        <button type="button" class="btn-primary" on:click={reset}>
          新しいファイルをインポート
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .csv-importer {
    max-width: 800px;
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

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .validation-errors {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1rem;
  }

  .error-title {
    color: #dc2626;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .error-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem 0;
  }

  .error-item {
    padding: 0.25rem 0;
    color: #7f1d1d;
  }

  .error-value {
    font-style: italic;
    color: #991b1b;
  }

  .btn-retry {
    background-color: #dc2626;
    color: white;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-retry:hover {
    background-color: #b91c1c;
  }

  .preview-section {
    margin-bottom: 2rem;
  }

  .preview-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .file-info {
    background-color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .file-info p {
    margin: 0.25rem 0;
    color: #4b5563;
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

  .hidden {
    display: none;
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
    .csv-importer {
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
  }
</style>