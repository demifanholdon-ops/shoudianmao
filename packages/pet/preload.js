const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApp', {
  // 渲染进程 → 主进程
  click: () => ipcRenderer.send('pet:clicked'),
  closeApp: () => ipcRenderer.send('pet:close'),
  closeReport: () => ipcRenderer.send('report:close'),
  drag: (x, y) => ipcRenderer.send('pet:drag', { x, y }),

  // 主进程 → 渲染进程
  onUpdate: (cb) => ipcRenderer.on('pet:update', (_e, payload) => cb(payload)),
  onLoading: (cb) => ipcRenderer.on('pet:loading', (_e, payload) => cb(payload)),
  onError: (cb) => ipcRenderer.on('pet:error', (_e, payload) => cb(payload)),
  onReport: (cb) => ipcRenderer.on('report:render', (_e, payload) => cb(payload)),
});
