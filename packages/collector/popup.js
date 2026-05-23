// 守店猫 · popup
// 极简界面：不向用户暴露 API/LLM 等专业概念

const dataStatus = document.getElementById('data-status');
const petStatus = document.getElementById('pet-status');
const hint = document.getElementById('hint');

async function refresh() {
  // 检查是否在千牛页
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onQianniu = tab?.url && /myseller\.taobao\.com|qn\.taobao\.com/.test(tab.url);
  if (onQianniu) {
    dataStatus.textContent = '✓ 已连接（千牛后台）';
    dataStatus.className = 'status-value ok';
  } else {
    dataStatus.textContent = '⚠ 未登录千牛后台';
    dataStatus.className = 'status-value warn';
  }

  // 检查桌面守店猫是否运行
  try {
    const res = await fetch('http://127.0.0.1:17890/status', { method: 'GET' });
    if (res.ok) {
      petStatus.textContent = '✓ 已运行';
      petStatus.className = 'status-value ok';
    } else {
      throw new Error('not ok');
    }
  } catch {
    petStatus.textContent = '⚠ 未启动';
    petStatus.className = 'status-value warn';
    hint.innerHTML = '💡 还没启动桌面守店猫？打开守店猫 app，猫就会出现在桌面右下角。';
  }
}

document.getElementById('btn-scan').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ type: 'MANUAL_SCAN', tabId: tab?.id });
  hint.innerHTML = '🐱 猫正在巡店…回到桌面看猫去。';
});

document.getElementById('btn-open-tab').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://myseller.taobao.com/home.htm/' });
});

refresh();
