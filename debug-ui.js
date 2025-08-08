// デバッグ用：MonthSelector が実際にレンダリングされているかチェック
console.log("=== MonthSelector デバッグ ===");

// ページロード後にチェック
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, checking for MonthSelector...");
  
  // MonthSelectorの要素を探す
  const monthSelector = document.querySelector('.month-selector');
  console.log("Month selector element:", monthSelector);
  
  // 利用予定月のテキストを探す
  const monthText = document.querySelector('*[contains(text(), "利用予定月")]');
  console.log("利用予定月 text found:", monthText);
  
  // すべてのモーダルを探す
  const modals = document.querySelectorAll('[role="dialog"], .modal, .fixed');
  console.log("Found modals:", modals);
});

// MutationObserverでDOMの変更を監視
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) { // Element node
        const monthSelector = node.querySelector && node.querySelector('.month-selector');
        if (monthSelector) {
          console.log("🎉 MonthSelector found!", monthSelector);
        }
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});