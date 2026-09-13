const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  scanVideos:    (folder) => ipcRenderer.invoke('scan-videos', folder),
  playVideo:     (file)   => ipcRenderer.invoke('play-video', file)
});