const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ─────────────────────────────────────────
   IPC: native folder picker
   Returns { name, path } or null if cancelled.
   ───────────────────────────────────────── */
ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select video folder',
    properties: ['openDirectory']
  });

  if (result.canceled || !result.filePaths.length) return null;

  const p = result.filePaths[0];
  const name = path.basename(p) || p;
  return { name, path: p };
});

/* ─────────────────────────────────────────
   IPC: scan a folder recursively for video files.
   Returns an array of { name, path }.
   ───────────────────────────────────────── */
ipcMain.handle('scan-videos', async (_evt, folderPath) => {
  const exts = new Set([
    '.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v',
    '.wmv', '.flv', '.mpg', '.mpeg', '.ts', '.m2ts'
  ]);

  const out = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      console.warn('scan-videos: cannot read', dir, err.message);
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.has(ext)) {
          out.push({
            name: path.basename(entry.name, ext),
            path: full
          });
        }
      }
    }
  }

  walk(folderPath);
  return out;
});

/* ─────────────────────────────────────────
   IPC: play a video.
   For now: hand off to the OS default player.
   Later we can swap this for embedded VLC playback.
   ───────────────────────────────────────── */
ipcMain.handle('play-video', async (_evt, filePath) => {
  const err = await shell.openPath(filePath);
  if (err) console.error('play-video failed:', err);
  return { ok: !err, error: err || null };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});