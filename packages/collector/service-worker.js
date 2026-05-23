/**
 * @file service-worker.js · 守店猫 数据采集后台
 *
 * 三件事：
 *  1) 定时扫描千牛后台（每 15 分钟一次）
 *  2) 扫描结果跑阈值规则（R1-R6），生成 alerts
 *  3) 把数据 + alerts 推送给本地桌面守店猫（http://127.0.0.1:17890/push-data）
 *     —— 桌面 app 拿到数据后自己调 brain 跑 AI（用户视角看不见这一步）
 *
 * 隐私：所有 LLM 推理在桌面 app 进程里发生，从未经过守店猫的服务器。
 *       守店猫团队没有任何服务器，更没有用户的数据。
 */

const PUSH_ENDPOINT = 'http://127.0.0.1:17890/push-data';
const SCAN_INTERVAL_MIN = 15;

// ===== 安装时初始化 =====
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('scan-shop', { periodInMinutes: SCAN_INTERVAL_MIN });
  chrome.storage.local.set({
    petState: 'idle',
    lastScanTime: null,
  });
});

// ===== 定时触发 =====
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'scan-shop') scanNow();
});

// ===== 消息：来自 popup 或 content =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PAGE_READY') {
    setTimeout(() => scanCurrentTab(sender.tab?.id), 2000);
  }
  if (msg.type === 'MANUAL_SCAN' && msg.tabId) {
    scanCurrentTab(msg.tabId);
  }
  if (msg.type === 'MANUAL_SCAN_FROM_PAGE') {
    scanCurrentTab(sender.tab?.id);
  }
  if (msg.type === 'GET_LATEST') {
    chrome.storage.local.get(['latestData', 'latestAlerts'], result => {
      sendResponse(result);
    });
    return true; // async
  }
});

async function scanNow() {
  const tabs = await chrome.tabs.query({
    url: ['*://myseller.taobao.com/*', '*://qn.taobao.com/*'],
  });
  if (tabs.length > 0) {
    await scanCurrentTab(tabs[0].id);
  }
}

async function scanCurrentTab(tabId) {
  if (!tabId) return;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractHomeData,
    });
    const data = results?.[0]?.result;
    if (data) {
      await processData(data, tabId);
    }
  } catch (e) {
    console.warn('[守店猫] 扫描失败:', e.message);
  }
}

/**
 * 跑阈值规则 → 生成 alerts → 推给桌面 app
 */
async function processData(data, tabId) {
  const storage = await chrome.storage.local.get(['previousData']);
  const prev = storage.previousData || {};
  const alerts = computeAlerts(data, prev);

  await chrome.storage.local.set({
    previousData: data,
    latestData: data,
    latestAlerts: alerts,
    lastScanTime: Date.now(),
  });

  // 推送给桌面守店猫（如果没运行，静默忽略）
  try {
    await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, alerts, personaId: 'gentle' }),
    });
  } catch (e) {
    // 桌面 app 未启动，不影响后续扫描
  }

  // 通知 content script 显示一个简短的浮窗气泡
  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'PET_STATE_UPDATE',
        message: alerts.length ? `发现 ${alerts.length} 件事要看一眼` : '一切正常～',
      });
    } catch {}
  }
}

/**
 * 阈值规则 R1-R6
 * 这是"零 token"的预筛选层 —— 真正的 AI 推理在桌面 app 的 brain 里。
 */
function computeAlerts(data, prev) {
  const alerts = [];

  if (data.pendingAfterSale > 0 && data.pendingAfterSale > (prev.pendingAfterSale || 0)) {
    alerts.push({
      rule: 'R1',
      severity: 'medium',
      text: `新增${data.pendingAfterSale - (prev.pendingAfterSale || 0)}笔售后，共${data.pendingAfterSale}笔待处理`,
      suggestion: '尽快处理，避免影响体验分',
    });
  }
  if (data.pendingBadReview > 0 && data.pendingBadReview > (prev.pendingBadReview || 0)) {
    alerts.push({
      rule: 'R2',
      severity: 'high',
      text: `收到 ${data.pendingBadReview - (prev.pendingBadReview || 0)} 条新差评`,
      suggestion: '尽快诚恳回复',
    });
  }
  if (prev.visitors && data.visitors < prev.visitors * 0.5) {
    const drop = Math.round((1 - data.visitors / prev.visitors) * 100);
    alerts.push({
      rule: 'R3',
      severity: 'high',
      text: `访客数较上次下降 ${drop}%（${prev.visitors}→${data.visitors}）`,
      suggestion: '检查主推款搜索排名',
    });
  }
  if (prev.conversionRate && data.conversionRate) {
    const curr = parseFloat(data.conversionRate);
    const old = parseFloat(prev.conversionRate);
    if (old > 0 && curr < old * 0.7) {
      alerts.push({
        rule: 'R4',
        severity: 'medium',
        text: `转化率下降（${prev.conversionRate} → ${data.conversionRate}）`,
        suggestion: '看详情页/价格/评价',
      });
    }
  }
  if (data.violations > 0 && data.violations > (prev.violations || 0)) {
    alerts.push({
      rule: 'R5',
      severity: 'high',
      text: `新增 ${data.violations - (prev.violations || 0)} 条违规`,
      suggestion: '立刻进违规中心查看',
    });
  }
  if (prev.experienceScore && data.experienceScore && data.experienceScore < prev.experienceScore) {
    alerts.push({
      rule: 'R6',
      severity: 'medium',
      text: `体验分下降（${prev.experienceScore} → ${data.experienceScore}）`,
      suggestion: '查 DSR 三项子分',
    });
  }
  return alerts;
}

/**
 * 注入到千牛页面执行的数据抓取（来自 Ds.zip 原版，做了精简）
 */
function extractHomeData() {
  const data = {
    storeName: '',
    date: new Date().toLocaleDateString('zh-CN'),
    revenue: 0, revenueYesterday: 0,
    visitors: 0, visitorsYesterday: 0,
    orders: 0, ordersYesterday: 0,
    conversionRate: '', conversionRateYesterday: '',
    avgPrice: 0, avgPriceYesterday: 0,
    buyers: 0, buyersYesterday: 0,
    experienceScore: 0,
    qualityScore: 0, logisticsScore: 0, serviceScore: 0,
    pendingShip: 0, pendingAfterSale: 0,
    pendingBadReview: 0, pendingComplaint: 0, violations: 0,
    platformAlerts: [],
  };

  // 千牛首页指标卡
  document.querySelectorAll('[class*="IndexGroup_OpSycmqnIndexGroupItem"]').forEach(item => {
    const t = item.textContent.trim();
    let m;
    if ((m = t.match(/支付金额([\d.]+)昨日([\d.]+)/))) {
      data.revenue = parseFloat(m[1]); data.revenueYesterday = parseFloat(m[2]);
    }
    if ((m = t.match(/访客数(\d+)昨日(\d+)/))) {
      data.visitors = parseInt(m[1]); data.visitorsYesterday = parseInt(m[2]);
    }
    if ((m = t.match(/支付子订单数(\d+)昨日(\d+)/))) {
      data.orders = parseInt(m[1]); data.ordersYesterday = parseInt(m[2]);
    }
    if ((m = t.match(/支付转化率([\d.]+%)昨日([\d.]+%)/))) {
      data.conversionRate = m[1]; data.conversionRateYesterday = m[2];
    }
    if ((m = t.match(/客单价([\d.]+)昨日([\d.]+)/))) {
      data.avgPrice = parseFloat(m[1]); data.avgPriceYesterday = parseFloat(m[2]);
    }
  });

  // 待办
  document.querySelectorAll('[class*="TodoListRow_MerchantMain"]').forEach(item => {
    const t = item.textContent.trim();
    let m;
    if ((m = t.match(/(\d+)待发货/))) data.pendingShip = parseInt(m[1]);
    if ((m = t.match(/(\d+)待售后/))) data.pendingAfterSale = parseInt(m[1]);
    if ((m = t.match(/(\d+)待回复差评/))) data.pendingBadReview = parseInt(m[1]);
    if ((m = t.match(/(\d+)待处理投诉/))) data.pendingComplaint = parseInt(m[1]);
    if ((m = t.match(/(\d+)违规/))) data.violations = parseInt(m[1]);
  });

  // 体验分（首页快照）
  const scores = document.querySelectorAll('[class*="ShopInfo_score"]');
  if (scores.length >= 1) data.experienceScore = parseFloat(scores[0].textContent.trim()) || 0;
  if (scores.length >= 2) data.qualityScore = parseFloat(scores[1].textContent.trim()) || 0;
  if (scores.length >= 3) data.logisticsScore = parseFloat(scores[2].textContent.trim()) || 0;
  if (scores.length >= 4) data.serviceScore = parseFloat(scores[3].textContent.trim()) || 0;

  // 平台预警
  document.querySelectorAll('[class*="DiscountNotice_textContent"], [class*="utils_overFlow"]').forEach(el => {
    const t = el.textContent.trim();
    if (t.length > 5 && t.length < 80 && /下降|异常|落后|低于|暂停|损失/.test(t)) {
      if (!data.platformAlerts.includes(t)) data.platformAlerts.push(t);
    }
  });

  return data;
}
