<!--
  レガシーCSVインポート専用ページ
  nagaiku-budget システムからのデータ移行機能
-->

<script lang="ts">
  import { goto } from '$app/navigation';
  import LegacyCSVImporter from '$lib/components/LegacyCSVImporter.svelte';
  import type { LegacyImportProgress } from '$lib/types/legacy-csv.js';

  // ページ状態
  let importStatus: 'idle' | 'importing' | 'success' | 'error' = 'idle';
  let importResults: any = null;
  let importErrors: string[] = [];

  // インポート完了ハンドラ
  function handleImportComplete(event: CustomEvent) {
    const { success, results, errors } = event.detail;
    
    if (success) {
      importStatus = 'success';
      importResults = results;
      importErrors = [];
      
      // 成功時に助成金ページにリダイレクト（5秒後）
      setTimeout(() => {
        goto('/grants');
      }, 5000);
    } else {
      importStatus = 'error';
      importResults = null;
      importErrors = errors || ['不明なエラーが発生しました'];
    }
  }

  // 進行状況更新ハンドラ
  function handleProgressUpdate(event: CustomEvent<LegacyImportProgress>) {
    const progress = event.detail;
    
    if (progress.stage === 'importing') {
      importStatus = 'importing';
    } else if (progress.stage === 'completed') {
      importStatus = 'success';
    } else if (progress.stage === 'error') {
      importStatus = 'error';
    }
  }

  // リセットハンドラ
  function resetImport() {
    importStatus = 'idle';
    importResults = null;
    importErrors = [];
  }
</script>

<svelte:head>
  <title>レガシーデータインポート | nagaiku-budget-v2</title>
  <meta name="description" content="nagaiku-budgetシステムからのCSVデータインポート機能">
</svelte:head>

<div class="legacy-import-page">
  <div class="container">
    <!-- ページヘッダー -->
    <div class="page-header">
      <h1>レガシーデータインポート</h1>
      <p class="page-description">
        nagaiku-budgetシステムからエクスポートしたCSVファイルを新システムにインポートします。
      </p>
    </div>

    <!-- インポート手順の説明 -->
    <div class="instructions-section">
      <h2>インポート手順</h2>
      <div class="instructions">
        <div class="instruction-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>CSVファイルの準備</h3>
            <p>nagaiku-budgetシステムから以下のセクションを含むCSVファイルをエクスポートしてください：</p>
            <ul>
              <li><code>[助成金データ]</code> - 助成金の基本情報</li>
              <li><code>[予算項目データ]</code> - 各助成金の予算項目</li>
              <li><code>[割当データ]</code> - 取引と予算項目の割当関係</li>
            </ul>
          </div>
        </div>

        <div class="instruction-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>ファイルの選択とプレビュー</h3>
            <p>エクスポートしたCSVファイルを選択し、プレビュー機能でデータを確認してください。</p>
          </div>
        </div>

        <div class="instruction-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>インポート実行</h3>
            <p>データに問題がなければ、インポートを実行してデータベースに保存します。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 注意事項 -->
    <div class="warnings-section">
      <h2>⚠️ 重要な注意事項</h2>
      <div class="warnings">
        <div class="warning-item">
          <strong>バックアップの実行:</strong>
          インポート前に現在のデータベースをバックアップすることを強く推奨します。
        </div>
        <div class="warning-item">
          <strong>データの重複:</strong>
          既存のデータとの重複チェックは行われません。同じデータを複数回インポートしないでください。
        </div>
        <div class="warning-item">
          <strong>エンコーディング:</strong>
          CSVファイルの文字エンコーディング（UTF-8、Shift_JIS等）を正しく設定してください。
        </div>
        <div class="warning-item">
          <strong>データ整合性:</strong>
          助成金、予算項目、割当の関係が正しく設定されていることを確認してください。
        </div>
      </div>
    </div>

    <!-- インポーターコンポーネント -->
    <div class="importer-section">
      <LegacyCSVImporter 
        disabled={importStatus === 'importing'}
        showPreview={true}
        on:import-complete={handleImportComplete}
        on:progress-update={handleProgressUpdate}
      />
    </div>

    <!-- インポート結果 -->
    {#if importStatus === 'success' && importResults}
      <div class="success-section">
        <h2>✅ インポート成功</h2>
        <p>レガシーデータのインポートが正常に完了しました。</p>
        
        <div class="import-summary">
          <h3>インポート結果</h3>
          <div class="result-grid">
            <div class="result-card">
              <div class="result-label">助成金</div>
              <div class="result-value">{importResults.grants?.imported || 0} 件</div>
              <div class="result-total">/ {importResults.grants?.total || 0} 件中</div>
            </div>
            
            <div class="result-card">
              <div class="result-label">予算項目</div>
              <div class="result-value">{importResults.budgetItems?.imported || 0} 件</div>
              <div class="result-total">/ {importResults.budgetItems?.total || 0} 件中</div>
            </div>
            
            <div class="result-card">
              <div class="result-label">割当</div>
              <div class="result-value">{importResults.allocations?.imported || 0} 件</div>
              <div class="result-total">/ {importResults.allocations?.total || 0} 件中</div>
            </div>
          </div>
        </div>

        <div class="next-steps">
          <h3>次のステップ</h3>
          <p>5秒後に助成金一覧ページに自動的に移動します。または下記のボタンをクリックしてください。</p>
          <div class="next-actions">
            <a href="/grants" class="btn btn-primary">助成金一覧を確認</a>
            <a href="/budget-items" class="btn btn-outline">予算項目一覧を確認</a>
            <button class="btn btn-outline" on:click={resetImport}>新しいインポートを実行</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- エラー表示 -->
    {#if importStatus === 'error' && importErrors.length > 0}
      <div class="error-section">
        <h2>❌ インポートエラー</h2>
        <p>インポート処理中にエラーが発生しました。以下の内容を確認してください。</p>
        
        <div class="error-details">
          <h3>エラー詳細</h3>
          <ul class="error-list">
            {#each importErrors as error}
              <li>{error}</li>
            {/each}
          </ul>
        </div>

        <div class="error-actions">
          <h3>対処方法</h3>
          <ol class="troubleshooting">
            <li>CSVファイルの形式とエンコーディングを確認してください</li>
            <li>データの整合性（ID関係等）を確認してください</li>
            <li>プレビュー機能でデータを事前確認してください</li>
            <li>問題が解決しない場合は、システム管理者にお問い合わせください</li>
          </ol>
          
          <button class="btn btn-primary" on:click={resetImport}>再試行</button>
        </div>
      </div>
    {/if}

    <!-- サポート情報 -->
    <div class="support-section">
      <h2>サポート情報</h2>
      <div class="support-content">
        <div class="support-item">
          <h3>📊 対応ファイル形式</h3>
          <ul>
            <li>CSV形式（カンマ区切り）</li>
            <li>文字エンコーディング: UTF-8, Shift_JIS, EUC-JP</li>
            <li>セクション形式: [助成金データ], [予算項目データ], [割当データ]</li>
          </ul>
        </div>
        
        <div class="support-item">
          <h3>🔍 トラブルシューティング</h3>
          <ul>
            <li>ファイルが正しい形式でエクスポートされているか確認</li>
            <li>必須フィールドが空でないか確認</li>
            <li>ID関係（助成金ID、予算項目ID）の整合性を確認</li>
          </ul>
        </div>
        
        <div class="support-item">
          <h3>📞 お問い合わせ</h3>
          <p>インポートに関する問題やご質問がございましたら、システム管理者までお問い合わせください。</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .legacy-import-page {
    min-height: 100vh;
    background: #f8f9fa;
    padding: 20px 0;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 20px;
  }

  .page-header {
    text-align: center;
    margin-bottom: 40px;
    padding: 40px 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .page-header h1 {
    font-size: 2.5em;
    color: #2c3e50;
    margin: 0 0 16px 0;
  }

  .page-description {
    font-size: 1.1em;
    color: #6c757d;
    margin: 0;
    max-width: 600px;
    margin: 0 auto;
  }

  .instructions-section,
  .warnings-section,
  .importer-section,
  .success-section,
  .error-section,
  .support-section {
    margin-bottom: 30px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    padding: 30px;
  }

  .instructions-section h2,
  .warnings-section h2,
  .success-section h2,
  .error-section h2,
  .support-section h2 {
    margin: 0 0 24px 0;
    color: #2c3e50;
    font-size: 1.5em;
  }

  .instruction-step {
    display: flex;
    margin-bottom: 24px;
    align-items: flex-start;
    gap: 16px;
  }

  .step-number {
    background: #007bff;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
  }

  .step-content h3 {
    margin: 0 0 8px 0;
    color: #2c3e50;
  }

  .step-content p {
    margin: 0 0 8px 0;
    color: #6c757d;
  }

  .step-content ul {
    margin: 8px 0;
    padding-left: 20px;
  }

  .step-content li {
    margin: 4px 0;
    color: #6c757d;
  }

  .step-content code {
    background: #f8f9fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
    border: 1px solid #e9ecef;
  }

  .warnings {
    display: grid;
    gap: 16px;
  }

  .warning-item {
    padding: 16px;
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 6px;
    color: #856404;
  }

  .warning-item strong {
    color: #533f03;
  }

  .import-summary {
    margin: 24px 0;
  }

  .import-summary h3 {
    margin: 0 0 16px 0;
    color: #2c3e50;
  }

  .result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .result-card {
    text-align: center;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
  }

  .result-label {
    font-size: 14px;
    color: #6c757d;
    margin-bottom: 8px;
  }

  .result-value {
    font-size: 2em;
    font-weight: bold;
    color: #28a745;
    margin-bottom: 4px;
  }

  .result-total {
    font-size: 12px;
    color: #6c757d;
  }

  .next-steps,
  .error-actions {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid #e9ecef;
  }

  .next-steps h3,
  .error-actions h3 {
    margin: 0 0 16px 0;
    color: #2c3e50;
  }

  .next-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover {
    background: #0056b3;
  }

  .btn-outline {
    background: transparent;
    color: #007bff;
    border: 1px solid #007bff;
  }

  .btn-outline:hover {
    background: #007bff;
    color: white;
  }

  .error-details {
    margin: 20px 0;
  }

  .error-details h3 {
    margin: 0 0 12px 0;
    color: #721c24;
  }

  .error-list {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    padding: 16px 20px;
    margin: 0;
  }

  .error-list li {
    color: #721c24;
    margin: 8px 0;
  }

  .troubleshooting {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 16px 20px;
    margin: 16px 0;
  }

  .troubleshooting li {
    margin: 8px 0;
    color: #6c757d;
  }

  .support-content {
    display: grid;
    gap: 24px;
  }

  .support-item h3 {
    margin: 0 0 12px 0;
    color: #2c3e50;
    font-size: 1.1em;
  }

  .support-item ul {
    margin: 8px 0;
    padding-left: 20px;
  }

  .support-item li {
    margin: 4px 0;
    color: #6c757d;
  }

  .support-item p {
    margin: 0;
    color: #6c757d;
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 16px;
    }

    .page-header {
      padding: 24px 16px;
    }

    .page-header h1 {
      font-size: 2em;
    }

    .instructions-section,
    .warnings-section,
    .importer-section,
    .success-section,
    .error-section,
    .support-section {
      padding: 20px;
    }

    .instruction-step {
      flex-direction: column;
      gap: 12px;
    }

    .step-number {
      align-self: flex-start;
    }

    .next-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .btn {
      text-align: center;
    }
  }
</style>