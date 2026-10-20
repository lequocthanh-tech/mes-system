const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Auto-scale UI by ~18% for 100% OS display scaling
try {
  webFrame.setZoomFactor(1.18);
} catch (err) {
  console.warn('Could not set default zoom factor in preload:', err);
}

contextBridge.exposeInMainWorld('electronAPI', {
  setZoomFactor: (factor) => {
    try {
      webFrame.setZoomFactor(factor);
    } catch (_) {}
  },
  getZoomFactor: () => {
    try {
      return webFrame.getZoomFactor();
    } catch (_) {
      return 1.18;
    }
  },
  sendAppMounted: () => {
    try {
      ipcRenderer.send('app-mounted');
    } catch (_) {}
  },
  sendSplashComplete: () => {
    try {
      ipcRenderer.send('splash-animation-complete');
    } catch (_) {}
  },
});


