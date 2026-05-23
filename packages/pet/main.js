/**
 * @file main.js · Electron 主进程
 *
 * 职责：
 *  1) 创建透明浮窗（pet_window.html），加载 SVG 猫
 *  2) 创建报告窗（report_window.html）
 *  3) 启动本地 HTTP 服务（127.0.0.1:17890），接收 Chrome 扩展推送的店铺数据
 *  4) 把店铺数据交给 brain 跑 AI 推理（异步），结果用 IPC 推给渲染进程
 *  5) Demo 模式：DEMO_MODE=1 时跑 examples/mock_shop_data.json 一遍
 *
 * 隐私模型：本进程不收集任何数据，也不发往守店猫服务器（我们没服务器）。
 *           data 由 Chrome 扩展从用户已登录的千牛/生意参谋抓取；
 *           AI 调用直接走用户配置的 LLM key（BYOK）。
 */

const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require('electron');

// ===== 全局状态 =====
let petWindow = null;
let reportWindow = null;
let tray = null;

let latestPayload = {
  data: null,
  alerts: [],
  brainResult: null,  // brain.think() 的输出
};

// ===== 创建浮窗 =====
function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  petWindow = new BrowserWindow({
    width: 280,
    height: 320,
    x: width - 320,
    y: height - 360,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.loadFile(path.join(__dirname, 'pet_window.html'));
}

function createReportWindow() {
  if (reportWindow && !reportWindow.isDestroyed()) {
    reportWindow.focus();
    return;
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  reportWindow = new BrowserWindow({
    width: 420,
    height: 620,
    x: width - 760,
    y: height - 660,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  reportWindow.loadFile(path.join(__dirname, 'report_window.html'));
  reportWindow.webContents.on('did-finish-load', () => {
    if (latestPayload.brainResult) {
      reportWindow.webContents.send('report:render', latestPayload);
    }
  });
  reportWindow.on('closed', () => { reportWindow = null; });
}

// ===== 本地 HTTP：接收 Chrome 扩展推送 =====
const httpServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/push-data') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        await handlePush(payload);
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.statusCode = 200;
    res.end(JSON.stringify({ running: true, hasData: !!latestPayload.data }));
    return;
  }

  res.statusCode = 404;
  res.end();
});

httpServer.listen(17890, '127.0.0.1', () => {
  console.log('[守店猫·桌宠] 本地服务运行: http://127.0.0.1:17890');
});

httpServer.on('error', err => {
  console.error('[守店猫·桌宠] HTTP 启动失败（端口被占用？）:', err.message);
});

// ===== 处理推送：异步调用 brain =====
async function handlePush(payload) {
  const { data, alerts = [], personaId = 'gentle' } = payload;
  latestPayload = { data, alerts, brainResult: null };

  // 先把"猫的状态"切到对应动画（纯规则 0 token）
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:loading', { data, alerts });
  }

  // 跑 AI 推理（异步，不阻塞）
  try {
    // brain 是 ESM，CJS 里需要动态 import
    const brain = await import('../brain/src/index.js');
    const result = await brain.think({ data, alerts, personaId });
    latestPayload.brainResult = result;

    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send('pet:update', result);
    }
    if (reportWindow && !reportWindow.isDestroyed()) {
      reportWindow.webContents.send('report:render', latestPayload);
    }
  } catch (e) {
    console.error('[守店猫·桌宠] brain 调用失败:', e.message);
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send('pet:error', { message: e.message });
    }
  }
}

// ===== 系统托盘 =====
function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    let icon;
    try {
      icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    } catch {
      icon = nativeImage.createEmpty();
    }
    tray = new Tray(icon);
    tray.setToolTip('守店猫');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示桌宠', click: () => petWindow?.show() },
      { label: '隐藏桌宠', click: () => petWindow?.hide() },
      { label: '查看今日日报', click: () => createReportWindow() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]));
  } catch (e) {
    console.warn('[Tray] 创建失败（忽略）:', e.message);
  }
}

// ===== IPC =====
ipcMain.on('pet:clicked', () => {
  createReportWindow();
});
ipcMain.on('pet:close', () => {
  app.quit();
});
ipcMain.on('report:close', () => {
  if (reportWindow && !reportWindow.isDestroyed()) reportWindow.close();
});
ipcMain.on('pet:drag', (event, { x, y }) => {
  if (petWindow && !petWindow.isDestroyed()) petWindow.setPosition(x, y);
});

// Demo 模式：app ready 时自己 push 一份 mock 数据进来
async function maybeDemoMode() {
  if (process.env.DEMO_MODE !== '1') return;
  try {
    const { readFile } = require('node:fs/promises');
    const mockPath = path.join(__dirname, '..', '..', 'examples', 'mock_shop_data.json');
    const mock = JSON.parse(await readFile(mockPath, 'utf8'));
    setTimeout(() => handlePush(mock), 1500);
  } catch (e) {
    console.warn('[Demo] mock 加载失败:', e.message);
  }
}

// ===== App lifecycle =====
app.whenReady().then(() => {
  createPetWindow();
  createTray();
  maybeDemoMode();
});

app.on('window-all-closed', () => {
  // 不退出，保持后台运行
});
