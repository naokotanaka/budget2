<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let currentTime = '';
  let isVisible = true;
  
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
  
  // 表示/非表示を切り替え
  function toggleVisibility() {
    isVisible = !isVisible;
  }
  
  onMount(() => {
    if (browser) {
      updateCurrentTime();
      
      // 5秒ごとに現在時刻を更新
      const interval = setInterval(updateCurrentTime, 5000);
      
      return () => {
        clearInterval(interval);
      };
    }
  });
</script>

<!-- シンプルなデバッグ情報パネル -->
<div class="debug-info-panel">
  <button
    class="debug-toggle"
    on:click={toggleVisibility}
    title="デバッグ情報の表示/非表示"
  >
    {isVisible ? '🔽' : '🔼'} DEBUG
  </button>
  
  {#if isVisible && browser}
    <div class="debug-content">
      <div class="debug-row">
        <span class="debug-icon">⏰</span>
        <span class="debug-label">Current:</span>
        <span class="debug-value">{currentTime}</span>
      </div>
      
      <div class="debug-row">
        <span class="debug-icon">🏷️</span>
        <span class="debug-label">Version:</span>
        <span class="debug-value">v1.0.{new Date().getDate()}</span>
      </div>
      
      <div class="debug-row">
        <span class="debug-icon">🔧</span>
        <span class="debug-label">Build:</span>
        <span class="debug-value">{new Date().toLocaleString('ja-JP')}</span>
      </div>
      
      <div class="debug-row">
        <span class="debug-icon">🚧</span>
        <span class="debug-label">Mode:</span>
        <span class="debug-value mode-dev">Development</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-info-panel {
    position: fixed;
    top: 80px;
    right: 10px;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    min-width: 240px;
    max-width: 300px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    pointer-events: auto;
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
    font-family: inherit;
    font-size: inherit;
  }
  
  .debug-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .debug-content {
    padding: 0 12px 12px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    margin-top: 4px;
  }
  
  .debug-row {
    display: flex;
    align-items: center;
    margin: 8px 0;
    gap: 8px;
  }
  
  .debug-icon {
    font-size: 14px;
    width: 18px;
    text-align: center;
  }
  
  .debug-label {
    color: #aaa;
    min-width: 60px;
    font-size: 11px;
  }
  
  .debug-value {
    color: #00ff88;
    font-weight: bold;
    flex: 1;
    font-size: 11px;
  }
  
  /* モードの色分け */
  .mode-dev {
    color: #ff9900;
  }
  
  .mode-prod {
    color: #66ccff;
  }
  
  /* レスポンシブ対応 */
  @media (max-width: 768px) {
    .debug-info-panel {
      top: 70px;
      right: 5px;
      min-width: 200px;
      max-width: 250px;
      font-size: 10px;
    }
    
    .debug-toggle {
      padding: 6px 10px;
    }
    
    .debug-content {
      padding: 0 10px 10px 10px;
    }
    
    .debug-row {
      margin: 6px 0;
    }
  }
</style>