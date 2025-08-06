<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // Viteで定義された環境変数を取得
  declare const __BUILD_TIME__: string;
  declare const __BUILD_VERSION__: string;
  declare const __DEV_MODE__: boolean;
  
  let currentTime = '';
  let hmrStatus = 'Unknown';
  let isVisible = true;
  
  // HMRステータスの確認
  function checkHmrStatus() {
    if (browser) {
      // 開発モードでViteのHMRが利用可能かチェック
      if (__DEV_MODE__ && (window as any).import?.meta?.hot) {
        hmrStatus = 'Active';
        // HMR更新を検出
        (window as any).import.meta.hot.on('vite:beforeUpdate', () => {
          hmrStatus = 'Updating...';
        });
        (window as any).import.meta.hot.on('vite:afterUpdate', () => {
          hmrStatus = 'Updated';
          updateCurrentTime();
        });
      } else if (__DEV_MODE__) {
        hmrStatus = 'Dev Mode (No HMR)';
      } else {
        hmrStatus = 'Production';
      }
    }
  }
  
  // 現在時刻を更新
  function updateCurrentTime() {
    currentTime = new Date().toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  // ビルド時刻をフォーマット
  function formatBuildTime(isoString: string) {
    return new Date(isoString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  // バージョン番号を短縮表示
  function formatVersion(version: string) {
    return '#' + version.slice(-6);
  }
  
  // 表示/非表示を切り替え
  function toggleVisibility() {
    isVisible = !isVisible;
  }
  
  onMount(() => {
    updateCurrentTime();
    checkHmrStatus();
    
    // 5秒ごとに現在時刻を更新
    const interval = setInterval(updateCurrentTime, 5000);
    
    return () => {
      clearInterval(interval);
    };
  });
</script>

<!-- デバッグ情報パネル -->
<div class="debug-info-panel">
  <button
    class="debug-toggle"
    on:click={toggleVisibility}
    title="デバッグ情報の表示/非表示"
  >
    {isVisible ? '🔽' : '🔼'} DEBUG
  </button>
  
  {#if isVisible}
    <div class="debug-content">
      <div class="debug-row">
        <span class="debug-icon">🔧</span>
        <span class="debug-label">Build:</span>
        <span class="debug-value">{formatBuildTime(__BUILD_TIME__)}</span>
      </div>
      
      <div class="debug-row">
        <span class="debug-icon">🏷️</span>
        <span class="debug-label">Version:</span>
        <span class="debug-value">{formatVersion(__BUILD_VERSION__)}</span>
      </div>
      
      <div class="debug-row">
        <span class="debug-icon">⏰</span>
        <span class="debug-label">Loaded:</span>
        <span class="debug-value">{currentTime}</span>
      </div>
      
      <div class="debug-row">
        <span class="debug-icon">🔄</span>
        <span class="debug-label">HMR:</span>
        <span class="debug-value hmr-{hmrStatus.toLowerCase().replace(/[^a-z]/g, '')}">{hmrStatus}</span>
      </div>
      
      {#if __DEV_MODE__}
        <div class="debug-row">
          <span class="debug-icon">🚧</span>
          <span class="debug-label">Mode:</span>
          <span class="debug-value mode-dev">Development</span>
        </div>
      {:else}
        <div class="debug-row">
          <span class="debug-icon">🚀</span>
          <span class="debug-label">Mode:</span>
          <span class="debug-value mode-prod">Production</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .debug-info-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    min-width: 280px;
  }
  
  .debug-toggle {
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    color: #fff;
    border: none;
    cursor: pointer;
    text-align: left;
    border-radius: 8px;
    transition: background-color 0.2s;
  }
  
  .debug-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .debug-content {
    padding: 0 12px 12px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .debug-row {
    display: flex;
    align-items: center;
    margin: 6px 0;
    gap: 8px;
  }
  
  .debug-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
  }
  
  .debug-label {
    color: #ccc;
    min-width: 60px;
  }
  
  .debug-value {
    color: #00ff88;
    font-weight: bold;
    flex: 1;
  }
  
  /* HMRステータスの色分け */
  .hmr-active {
    color: #00ff88;
  }
  
  .hmr-updating {
    color: #ff9900;
    animation: pulse 1s infinite;
  }
  
  .hmr-updated {
    color: #00ff88;
    animation: flash 0.5s ease-out;
  }
  
  .hmr-devmodenohmr {
    color: #ffaa00;
  }
  
  .hmr-production {
    color: #66ccff;
  }
  
  .hmr-unknown {
    color: #ff6666;
  }
  
  /* モードの色分け */
  .mode-dev {
    color: #ff9900;
  }
  
  .mode-prod {
    color: #66ccff;
  }
  
  /* アニメーション */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes flash {
    0% { background-color: rgba(0, 255, 136, 0.3); }
    100% { background-color: transparent; }
  }
  
  /* レスポンシブ対応 */
  @media (max-width: 768px) {
    .debug-info-panel {
      top: 5px;
      right: 5px;
      min-width: 250px;
      font-size: 11px;
    }
    
    .debug-toggle {
      padding: 6px 10px;
    }
    
    .debug-content {
      padding: 0 10px 10px 10px;
    }
  }
</style>