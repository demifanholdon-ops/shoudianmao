// 守店猫 · content script
// 注入在千牛/生意参谋页面，负责：
//  1) 在页面右下角显示一个迷你浮窗（已经有桌宠的话可以不要这个）
//  2) 接收 service-worker 的状态更新
//  3) 提供"立刻巡店"的入口

(function () {
  if (document.getElementById('shoudianmao-floater')) return;

  // === 创建浮窗 ===
  const root = document.createElement('div');
  root.id = 'shoudianmao-floater';
  root.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 999999;
    width: 64px; height: 64px;
    background: #fdf6e3;
    border: 2px solid #2a1d0f;
    border-radius: 14px;
    box-shadow: 4px 4px 0 #2a1d0f;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
    transition: transform 0.15s;
    user-select: none;
  `;
  root.textContent = '🐱';
  root.title = '守店猫 · 点击立刻巡店';

  root.addEventListener('mouseenter', () => { root.style.transform = 'scale(1.06)'; });
  root.addEventListener('mouseleave', () => { root.style.transform = 'scale(1)'; });
  root.addEventListener('click', () => {
    root.style.transform = 'scale(0.92)';
    setTimeout(() => { root.style.transform = 'scale(1)'; }, 120);
    chrome.runtime.sendMessage({ type: 'MANUAL_SCAN_FROM_PAGE' });
    showFlash('喵～ 我去巡店了');
  });

  document.body.appendChild(root);

  // === 状态闪字 ===
  function showFlash(text) {
    let f = document.getElementById('shoudianmao-flash');
    if (!f) {
      f = document.createElement('div');
      f.id = 'shoudianmao-flash';
      f.style.cssText = `
        position: fixed; bottom: 100px; right: 24px; z-index: 999999;
        max-width: 200px;
        background: #fdf6e3;
        border: 2px solid #2a1d0f;
        border-radius: 12px;
        padding: 8px 12px;
        box-shadow: 3px 3px 0 #2a1d0f;
        font-family: "PingFang SC", sans-serif;
        font-size: 13px;
        color: #2a1d0f;
        opacity: 0;
        transition: opacity 0.2s, transform 0.2s;
        transform: translateY(6px);
      `;
      document.body.appendChild(f);
    }
    f.textContent = text;
    f.style.opacity = '1';
    f.style.transform = 'translateY(0)';
    clearTimeout(f._t);
    f._t = setTimeout(() => {
      f.style.opacity = '0';
      f.style.transform = 'translateY(6px)';
    }, 3500);
  }

  // === 监听后台消息 ===
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PET_STATE_UPDATE') {
      showFlash(msg.message || '猫巡完店了～');
    }
  });

  // === 页面加载完触发一次扫描 ===
  setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'PAGE_READY' });
  }, 3000);
})();
