const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickDirectory:    () => ipcRenderer.invoke('pick-directory'),
  scanVideos:       (folder) => ipcRenderer.invoke('scan-videos', folder),
  playVideo:        (file)   => ipcRenderer.invoke('play-video', file),
  toggleFullscreen: ()       => ipcRenderer.invoke('toggle-fullscreen'),
  powerAction:      (action) => ipcRenderer.invoke('power-action', action),

  onScanProgress: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('scan-progress', listener);
    return () => ipcRenderer.removeListener('scan-progress', listener);
  },
});