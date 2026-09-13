const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

/* ffmpeg-static is optional — the app still works without it, just no thumbs. */
let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
  if (ffmpegPath) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
  }
} catch (err) {
  console.warn('ffmpeg-static not available:', err.message);
}

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

/* ── IPC: native folder picker ── */
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

/* ── Thumbnail cache ── */
const THUMB_CONCURRENCY = 4;

function thumbDir() {
  const dir = path.join(app.getPath('userData'), 'thumbnails');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function thumbKey(filePath, stat) {
  return crypto.createHash('sha1')
    .update(`${filePath}|${stat.mtimeMs}|${stat.size}`)
    .digest('hex');
}

function runFfmpeg(args) {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve(false);
    const proc = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

async function extractThumbnail(filePath, stat) {
  if (!ffmpegPath) return null;

  const out = path.join(thumbDir(), thumbKey(filePath, stat) + '.jpg');
  if (fs.existsSync(out)) return out;

  const base = [
    '-i', filePath,
    '-frames:v', '1',
    '-vf', 'scale=320:-1:flags=lanczos',
    '-q:v', '4',
    '-y', out,
  ];

  // Fast seek to ~8s first — skips black intros / title cards.
  if (await runFfmpeg(['-ss', '8', ...base]) && fs.existsSync(out)) return out;

  // Fallback for clips shorter than 8s.
  if (await runFfmpeg(base) && fs.existsSync(out)) return out;

  return null;
}

async function mapPool(items, limit, fn) {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        await fn(items[idx], idx);
      }
    }
  );
  await Promise.all(workers);
}

async function generateThumbs(evt, items) {
  const pending = items.filter(it => !it.thumbUrl);
  if (!pending.length) return;

  const total = pending.length;
  let done = 0;

  await mapPool(pending, THUMB_CONCURRENCY, async (item) => {
    let thumbUrl = null;
    try {
      const st = await fsp.stat(item.path);
      const thumb = await extractThumbnail(item.path, st);
      if (thumb) thumbUrl = pathToFileURL(thumb).href;
    } catch (err) {
      console.warn('thumb failed', item.path, err.message);
    }

    if (thumbUrl) item.thumbUrl = thumbUrl;
    done++;

    if (!evt.sender.isDestroyed()) {
      evt.sender.send('scan-progress', {
        done, total,
        path: item.path,
        thumbUrl,
      });
    }
  });
}

/* ── IPC: scan a folder recursively for video files ── */
ipcMain.handle('scan-videos', async (evt, folderPath) => {
  const exts = new Set([
    '.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v',
    '.wmv', '.flv', '.mpg', '.mpeg', '.ts', '.m2ts'
  ]);
  const out = [];
  const stack = [folderPath];

  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (err) {
      console.warn('scan-videos: cannot read', dir, err.message);
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.has(ext)) {
          out.push({ name: path.basename(entry.name, ext), path: full });
        }
      }
    }
  }

  out.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  // Fast path: attach any cached thumbnails synchronously.
  await Promise.all(out.map(async (item) => {
    try {
      const st = await fsp.stat(item.path);
      const cached = path.join(thumbDir(), thumbKey(item.path, st) + '.jpg');
      if (fs.existsSync(cached)) {
        item.thumbUrl = pathToFileURL(cached).href;
      }
    } catch { /* ignore */ }
  }));

  // Kick off generation *after* the renderer receives the file list.
  setImmediate(() => generateThumbs(evt, out));

  return out;
});

/* ── Media player detection ── */
function findPlayer() {
  const platform = process.platform;

  // Common install paths per platform
  const candidates = [];

  if (platform === 'win32') {
    candidates.push(
      { name: 'vlc', paths: [
        'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
        'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
      ], args: ['--fullscreen', '--no-video-title-show'] },
      { name: 'mpv', paths: [
        'C:\\Program Files\\mpv\\mpv.exe',
        'C:\\Program Files (x86)\\mpv\\mpv.exe',
      ], args: ['--fullscreen'] },
      { name: 'wmplayer', paths: [
        'C:\\Program Files\\Windows Media Player\\wmplayer.exe',
      ], args: ['/fullscreen'] },
    );
  } else if (platform === 'darwin') {
    candidates.push(
      { name: 'vlc', paths: ['/Applications/VLC.app/Contents/MacOS/VLC'], args: ['--fullscreen'] },
      { name: 'mpv', paths: ['/usr/local/bin/mpv', '/opt/homebrew/bin/mpv'], args: ['--fullscreen'] },
    );
  } else {
    // Linux
    candidates.push(
      { name: 'vlc', paths: ['/usr/bin/vlc', '/usr/local/bin/vlc'], args: ['--fullscreen'] },
      { name: 'mpv', paths: ['/usr/bin/mpv', '/usr/local/bin/mpv'], args: ['--fullscreen'] },
      { name: 'smplayer', paths: ['/usr/bin/smplayer'], args: ['-fullscreen'] },
    );
  }

  for (const c of candidates) {
    for (const p of c.paths) {
      if (fs.existsSync(p)) return { path: p, args: c.args };
    }
  }

  // Try `which`/`where` for PATH-based installs
  try {
    const { execSync } = require('child_process');
    for (const name of ['vlc', 'mpv']) {
      const cmd = platform === 'win32' ? `where ${name}` : `which ${name}`;
      try {
        const result = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
        if (result && fs.existsSync(result)) {
          return { path: result, args: ['--fullscreen'] };
        }
      } catch { /* not found, continue */ }
    }
  } catch { /* ignore */ }

  return null;
}

/* ── IPC: play a video, preferably fullscreen ── */
ipcMain.handle('play-video', async (_evt, filePath) => {
  const player = findPlayer();

  if (player) {
    return new Promise((resolve) => {
      const proc = spawn(player.path, [...player.args, filePath], {
        detached: true,
        stdio: 'ignore',
      });
      proc.on('error', async (err) => {
        console.warn('spawn failed, falling back to shell:', err.message);
        const fallbackErr = await shell.openPath(filePath);
        resolve({ ok: !fallbackErr, error: fallbackErr || null, player: 'default' });
      });
      proc.on('spawn', () => {
        proc.unref();
        resolve({ ok: true, error: null, player: player.path });
      });
    });
  }

  // No known player — fall back to OS default (no fullscreen control)
  const err = await shell.openPath(filePath);
  if (err) console.error('play-video failed:', err);
  return { ok: !err, error: err || null, player: 'default' };
});

/* ── IPC: power actions (quit, sleep, power off) ── */
ipcMain.handle('power-action', async (_evt, action) => {
  if (action === 'quit') {
    // Give the renderer a tick to receive the reply before we exit.
    setTimeout(() => app.quit(), 80);
    return { ok: true };
  }

  // Confirm before anything destructive.
  const labels = {
    sleep: { verb: 'Sleep',   msg: 'Put the computer to sleep?' },
    off:   { verb: 'Power Off', msg: 'Power off the computer?' },
  };
  const meta = labels[action];
  if (!meta) return { ok: false, error: `Unknown action: ${action}` };

  const confirm = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', meta.verb],
    defaultId: 0,
    cancelId: 0,
    title: 'Confirm',
    message: meta.msg,
  });
  if (confirm.response !== 1) return { ok: false, canceled: true };

  const platform = process.platform;
  let cmd, args;

  if (action === 'sleep') {
    if (platform === 'win32') {
      cmd = 'rundll32.exe';
      args = ['powrprof.dll,SetSuspendState', '0,1,0'];
    } else if (platform === 'darwin') {
      cmd = 'pmset';
      args = ['sleepnow'];
    } else {
      cmd = 'systemctl';
      args = ['suspend'];
    }
  } else { // 'off'
    if (platform === 'win32') {
      cmd = 'shutdown';
      args = ['/s', '/t', '0'];
    } else if (platform === 'darwin') {
      cmd = 'osascript';
      args = ['-e', 'tell app "System Events" to shut down'];
    } else {
      cmd = 'systemctl';
      args = ['poweroff'];
    }
  }

  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    } catch (err) {
      return resolve({ ok: false, error: err.message });
    }
    proc.on('error', (err) => resolve({ ok: false, error: err.message }));
    proc.on('spawn', () => {
      proc.unref();
      resolve({ ok: true });
    });
  });
});

/* ── IPC: toggle native fullscreen ── */
ipcMain.handle('toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const current = mainWindow.isFullScreen();
  const next = !current;
  mainWindow.setFullScreen(next);
  console.log('[toggle-fullscreen] was =', current, '→ now =', next);
  return next;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});