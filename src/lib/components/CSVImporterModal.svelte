<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let isOpen = false;
  export let importType: 'grants' | 'budget-items' = 'grants';
  
  const dispatch = createEventDispatcher();
  
  let files: FileList | null = null;
  let isDragOver = false;
  let isProcessing = false;
  let progress = 0;
  let processedData: any[] = [];
  let errors: string[] = [];
  let currentStep = 1; // 1: upload, 2: preview, 3: process
  
  // ファイルドロップ処理
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      files = droppedFiles;
      processFile();
    }
  }
  
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }
  
  function handleDragLeave() {
    isDragOver = false;
  }
  
  // ファイル選択処理
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      files = target.files;
      processFile();
    }
  }
  
  // CSVファイル処理
  async function processFile() {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.name.endsWith('.csv')) {
      errors = ['CSVファイルを選択してください'];
      return;
    }
    
    isProcessing = true;
    progress = 10;
    errors = [];
    
    try {
      const text = await file.text();
      progress = 50;
      
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        throw new Error('空のファイルです');
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });
      
      processedData = rows;
      progress = 100;
      currentStep = 2;
    } catch (error) {
      errors = [`ファイル処理エラー: ${error}`];
      progress = 0;
    } finally {
      isProcessing = false;
    }
  }
  
  // インポート実行
  async function executeImport() {
    if (processedData.length === 0) return;
    
    isProcessing = true;
    progress = 0;
    
    try {
      const endpoint = importType === 'grants' ? '/api/grants/import' : '/api/budget-items/import';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: processedData })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'インポートに失敗しました');
      }
      
      const result = await response.json();
      progress = 100;
      
      dispatch('success', { count: result.imported || processedData.length });
      closeModal();
    } catch (error) {
      dispatch('error', { message: `インポートエラー: ${error}` });
      errors = [`インポートエラー: ${error}`];
    } finally {
      isProcessing = false;
    }
  }
  
  // モーダルを閉じる
  function closeModal() {
    isOpen = false;
    files = null;
    processedData = [];
    errors = [];
    currentStep = 1;
    progress = 0;
    isProcessing = false;
    dispatch('close');
  }
  
  // ESCキーでモーダルを閉じる
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }
  
  // サンプルCSVダウンロード
  function downloadSample() {
    let csvContent = '';
    if (importType === 'grants') {
      csvContent = 'name,grantCode,totalAmount,startDate,endDate,status\n';
      csvContent += 'WAM補助金,WAM2025,7000000,2025-04-01,2026-03-31,in_progress\n';
      csvContent += '地域活動支援センター補助金,CHIIKI2025,3000000,2025-04-01,2026-03-31,in_progress\n';
    } else {
      csvContent = 'name,category,budgetedAmount,note,grantName\n';
      csvContent += '人件費,人件費,2000000,職員給与,WAM補助金\n';
      csvContent += '事業費,事業費,1500000,プログラム実施費,WAM補助金\n';
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = importType === 'grants' ? 'sample-grants.csv' : 'sample-budget-items.csv';
    link.click();
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
  <!-- モーダルオーバーレイ -->
  <div class="modal-overlay" on:click={closeModal}>
    <div class="modal-container" on:click|stopPropagation>
      <!-- ヘッダー -->
      <div class="modal-header">
        <div class="header-icon">
          <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
          </svg>
        </div>
        <h2 class="modal-title">
          {importType === 'grants' ? '助成金' : '予算項目'}CSVインポート
        </h2>
        <button class="close-button" on:click={closeModal}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- ステップインジケーター -->
      <div class="step-indicator">
        <div class="step {currentStep >= 1 ? 'active' : ''}">1</div>
        <div class="step-line {currentStep >= 2 ? 'active' : ''}"></div>
        <div class="step {currentStep >= 2 ? 'active' : ''}">2</div>
        <div class="step-line {currentStep >= 3 ? 'active' : ''}"></div>
        <div class="step {currentStep >= 3 ? 'active' : ''}">3</div>
      </div>
      
      <!-- ステップラベル -->
      <div class="step-labels">
        <span class="step-label {currentStep === 1 ? 'active' : ''}">ファイル選択</span>
        <span class="step-label {currentStep === 2 ? 'active' : ''}">データ確認</span>
        <span class="step-label {currentStep === 3 ? 'active' : ''}">インポート完了</span>
      </div>
      
      <!-- メインコンテンツ -->
      <div class="modal-content">
        {#if currentStep === 1}
          <!-- ステップ1: ファイルアップロード -->
          <div class="upload-section">
            <div 
              class="upload-area {isDragOver ? 'drag-over' : ''}"
              on:drop={handleDrop}
              on:dragover={handleDragOver}
              on:dragleave={handleDragLeave}
            >
              <div class="upload-icon">
                <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                </svg>
              </div>
              <p class="upload-text">CSVファイルをドラッグ&ドロップ</p>
              <p class="upload-subtext">または</p>
              <input 
                type="file" 
                accept=".csv" 
                on:change={handleFileSelect}
                class="file-input"
                id="file-upload"
              />
              <label for="file-upload" class="file-label">ファイルを選択</label>
            </div>
            
            <div class="upload-info">
              <button class="sample-download" on:click={downloadSample}>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                サンプルCSVダウンロード
              </button>
            </div>
          </div>
        {:else if currentStep === 2}
          <!-- ステップ2: データプレビュー -->
          <div class="preview-section">
            <h3 class="preview-title">インポートデータ確認（{processedData.length}件）</h3>
            <div class="preview-table">
              {#if processedData.length > 0}
                <table class="data-table">
                  <thead>
                    <tr>
                      {#each Object.keys(processedData[0]) as header}
                        <th>{header}</th>
                      {/each}
                    </tr>
                  </thead>
                  <tbody>
                    {#each processedData.slice(0, 5) as row}
                      <tr>
                        {#each Object.values(row) as value}
                          <td>{value}</td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
                {#if processedData.length > 5}
                  <p class="preview-note">最初の5件を表示（全{processedData.length}件）</p>
                {/if}
              {/if}
            </div>
            
            <div class="preview-actions">
              <button class="btn-secondary" on:click={() => currentStep = 1}>戻る</button>
              <button class="btn-primary" on:click={executeImport}>インポート実行</button>
            </div>
          </div>
        {/if}
        
        <!-- プログレスバー -->
        {#if isProcessing}
          <div class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {progress}%"></div>
            </div>
            <p class="progress-text">処理中... {progress}%</p>
          </div>
        {/if}
        
        <!-- エラー表示 -->
        {#if errors.length > 0}
          <div class="error-section">
            {#each errors as error}
              <p class="error-message">{error}</p>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }
  
  .modal-container {
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    overflow: hidden;
    display: grid;
    grid-template-rows: auto auto auto 1fr;
  }
  
  .modal-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  .header-icon {
    display: grid;
    place-items: center;
  }
  
  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }
  
  .close-button {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: background-color 0.2s;
  }
  
  .close-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .step-indicator {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr auto;
    align-items: center;
    padding: 1rem 2rem;
    background-color: #f8fafc;
  }
  
  .step {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background-color: #e2e8f0;
    color: #64748b;
    display: grid;
    place-items: center;
    font-weight: 600;
    transition: all 0.3s;
  }
  
  .step.active {
    background-color: #3b82f6;
    color: white;
  }
  
  .step-line {
    height: 2px;
    background-color: #e2e8f0;
    margin: 0 1rem;
    transition: background-color 0.3s;
  }
  
  .step-line.active {
    background-color: #3b82f6;
  }
  
  .step-labels {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    text-align: center;
    padding: 0 2rem 1rem;
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .step-label {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
  }
  
  .step-label.active {
    color: #3b82f6;
    font-weight: 600;
  }
  
  .modal-content {
    padding: 2rem;
    overflow-y: auto;
  }
  
  .upload-section {
    display: grid;
    gap: 1.5rem;
  }
  
  .upload-area {
    border: 2px dashed #d1d5db;
    border-radius: 12px;
    padding: 3rem 2rem;
    text-align: center;
    background-color: #f9fafb;
    transition: all 0.3s;
    cursor: pointer;
  }
  
  .upload-area.drag-over {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }
  
  .upload-icon {
    margin-bottom: 1rem;
  }
  
  .upload-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }
  
  .upload-subtext {
    color: #6b7280;
    margin-bottom: 1rem;
  }
  
  .file-input {
    display: none;
  }
  
  .file-label {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: transform 0.2s;
    display: inline-block;
  }
  
  .file-label:hover {
    transform: translateY(-1px);
  }
  
  .upload-info {
    display: grid;
    place-items: center;
  }
  
  .sample-download {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #3b82f6;
    background: none;
    border: 1px solid #3b82f6;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }
  
  .sample-download:hover {
    background-color: #3b82f6;
    color: white;
  }
  
  .preview-section {
    display: grid;
    gap: 1.5rem;
  }
  
  .preview-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }
  
  .preview-table {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .data-table th {
    background-color: #f3f4f6;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .data-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    color: #6b7280;
  }
  
  .preview-note {
    background-color: #f3f4f6;
    padding: 0.75rem;
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
  }
  
  .preview-actions {
    display: grid;
    grid-template-columns: auto auto;
    gap: 1rem;
    justify-content: end;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
  }
  
  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-secondary:hover {
    background: #e5e7eb;
  }
  
  .progress-section {
    margin-top: 1.5rem;
  }
  
  .progress-bar {
    background-color: #e5e7eb;
    border-radius: 9999px;
    height: 8px;
    overflow: hidden;
  }
  
  .progress-fill {
    background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%);
    height: 100%;
    border-radius: 9999px;
    transition: width 0.3s;
  }
  
  .progress-text {
    text-align: center;
    margin-top: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .error-section {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
  }
  
  .error-message {
    color: #dc2626;
    margin: 0;
    font-size: 0.875rem;
  }
  
  /* レスポンシブデザイン */
  @media (max-width: 768px) {
    .modal-container {
      margin: 1rem;
      max-width: calc(100vw - 2rem);
    }
    
    .modal-header,
    .step-indicator,
    .step-labels,
    .modal-content {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    
    .upload-area {
      padding: 2rem 1rem;
    }
    
    .preview-actions {
      grid-template-columns: 1fr;
    }
  }
</style>