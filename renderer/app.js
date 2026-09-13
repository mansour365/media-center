/* ═════════════════════════════════════════
   AUDIO ENGINE
   ═════════════════════════════════════════ */

let audioCtx = null;
let soundEnabled = true;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

let masterNode = null;
function getMaster(ctx) {
  if (!masterNode) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;

    const g = ctx.createGain();
    g.gain.value = 0.9;

    lp.connect(g).connect(ctx.destination);
    masterNode = lp;
  }
  return masterNode;
}

function noiseTransient(ctx, dest, t, { freq = 4200, q = 2.0, dur = 0.013, gain = 0.065 } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);

  src.connect(bp).connect(g).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.005);
}

function toneBody(ctx, dest, t, {
  from = 2400, to = 1400, dur = 0.045, gain = 0.085, type = 'sine'
} = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function playNavSound() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  const dest = getMaster(ctx);
  const t = ctx.currentTime;

  noiseTransient(ctx, dest, t, { freq: 4600, q: 2.2, dur: 0.012, gain: 0.055 });
  toneBody(ctx, dest, t, { from: 2600, to: 1500, dur: 0.042, gain: 0.085 });
}

function playConfirmSound() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  const dest = getMaster(ctx);
  const t = ctx.currentTime;

  noiseTransient(ctx, dest, t, { freq: 3600, q: 1.8, dur: 0.016, gain: 0.05 });
  toneBody(ctx, dest, t, { from: 1900, to: 1000, dur: 0.085, gain: 0.10 });

  const t2 = t + 0.04;
  toneBody(ctx, dest, t2, { from: 1450, to: 850, dur: 0.08, gain: 0.065 });
}

function playEdgeSound() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  const dest = getMaster(ctx);
  const t = ctx.currentTime;

  noiseTransient(ctx, dest, t, { freq: 1100, q: 1.3, dur: 0.020, gain: 0.04 });
  toneBody(ctx, dest, t, { from: 620, to: 380, dur: 0.070, gain: 0.06 });
}

const soundToggle = document.getElementById('sound-toggle');
function syncSoundToggle() {
  soundToggle.classList.toggle('on', soundEnabled);
}
soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  syncSoundToggle();
  if (soundEnabled) playNavSound();
});
syncSoundToggle();

/* ═════════════════════════════════════════
   Toast
   ═════════════════════════════════════════ */
const toastEl = document.getElementById('toast');
let toastTimer = null;

function showToast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, ms);
}

/* ═════════════════════════════════════════
   Icons
   ═════════════════════════════════════════ */
const ICONS = {
  video: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/></svg>`,
  music: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M9 17.5V6.5l10-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>`,
  photos: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg>`,
  game: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M7.5 8h9a5 5 0 015 5v0a5 5 0 01-5 5H7.5a5 5 0 01-5-5v0a5 5 0 015-5z"/><path d="M7 12v2M6 13h2"/><circle cx="16.5" cy="12.5" r="0.6" fill="currentColor"/><circle cx="18.5" cy="14.5" r="0.6" fill="currentColor"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.2 2.6 2.8-.6.6 2.8 2.6 1.2-1.4 2.5 1.4 2.5-2.6 1.2-.6 2.8-2.8-.6L12 21.5l-1.2-2.6-2.8.6-.6-2.8-2.6-1.2 1.4-2.5-1.4-2.5 2.6-1.2.6-2.8 2.8.6z"/></svg>`,

  play:    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 5l12 7-12 7z"/></svg>`,
  list:    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
  folder:  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`,
  star:    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.7 6.2 6.3.6-4.8 4.2 1.4 6.2L12 17.6 6.4 20.2l1.4-6.2L3 9.8l6.3-.6z"/></svg>`,
  disc:    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>`,
  globe:   `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/></svg>`,
  heart:   `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 8a3.5 3.5 0 017-2.5c0 5-7 9.5-7 9.5z"/></svg>`,
  clock:   `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  display: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8a5 5 0 010 8"/></svg>`,
  network: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 10a14 14 0 0118 0M6 13.5a9 9 0 0112 0M9 17a4 4 0 016 0"/><circle cx="12" cy="20" r="0.9" fill="currentColor"/></svg>`,
  system:  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h6M7 12h10M7 16h8"/></svg>`,
  gamepad: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M7.5 8h9a5 5 0 015 5v0a5 5 0 01-5 5H7.5a5 5 0 01-5-5v0a5 5 0 015-5z"/><path d="M7 12v2M6 13h2"/><circle cx="16.5" cy="12.5" r="0.6" fill="currentColor"/><circle cx="18.5" cy="14.5" r="0.6" fill="currentColor"/></svg>`,
  trophy:  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3"/><path d="M10 15h4M9 20h6M12 15v5"/></svg>`,
  save:    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M8 4v5h7V4M8 20v-7h8v7"/></svg>`,
  rocket:  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M14 4a8 8 0 014 4c0 3-2 6-6 8l-3-3c2-4 5-6 5-9z"/><path d="M9 13l-3 3M6 16l-2 4 4-2"/><circle cx="15" cy="7.5" r="1.3"/></svg>`,
};

/* ═════════════════════════════════════════
   Menu data
   ═════════════════════════════════════════ */
const DATA = {
  Video: {
    icon: ICONS.video,
    items: [
      { id: 'directory', label: 'Directory', icon: 'folder' },
      { label: 'TV Shows',       icon: 'list'   },
      { label: 'Playlists',      icon: 'folder' },
      { label: 'Streaming',      icon: 'globe'  },
      { label: 'Recordings',     icon: 'clock'  },
      { label: 'Continue',       icon: 'play'   },
      { label: 'Favorites',      icon: 'star'   },
      { label: 'Recently Added', icon: 'list'   },
    ]
  },
  Audio: {
    icon: ICONS.music,
    items: [
      { label: 'Albums',    icon: 'disc'   },
      { label: 'Artists',   icon: 'star'   },
      { label: 'Playlists', icon: 'list'   },
      { label: 'Radio',     icon: 'globe'  },
      { label: 'Genres',    icon: 'folder' },
      { label: 'Recent',    icon: 'clock'  },
      { label: 'Favorites', icon: 'heart'  },
    ]
  },
  Photos: {
    icon: ICONS.photos,
    items: [
      { label: 'Albums',    icon: 'folder' },
      { label: 'Timeline',  icon: 'clock'  },
      { label: 'Slideshow', icon: 'play'   },
      { label: 'Favorites', icon: 'heart'  },
      { label: 'Tags',      icon: 'star'   },
      { label: 'Recent',    icon: 'clock'  },
      { label: 'Places',    icon: 'globe'  },
    ]
  },
  Game: {
    icon: ICONS.game,
    items: [
      { label: 'Library',         icon: 'gamepad' },
      { label: 'Recently Played', icon: 'clock'   },
      { label: 'Installed',       icon: 'folder'  },
      { label: 'Emulators',       icon: 'list'    },
      { label: 'Achievements',    icon: 'trophy'  },
      { label: 'Save Data',       icon: 'save'    },
      { label: 'Store',           icon: 'rocket'  },
    ]
  },
  Settings: {
    icon: ICONS.settings,
    items: [
      { label: 'Display',   icon: 'display' },
      { label: 'Audio',     icon: 'speaker' },
      { label: 'Network',   icon: 'network' },
      { label: 'System',    icon: 'system'  },
      { label: 'Parental',  icon: 'heart'   },
      { label: 'Storage',   icon: 'folder'  },
      { label: 'About',     icon: 'list'    },
    ]
  }
};

/* Selected video folder + scanned videos */
let selectedVideoFolder = null;
let scannedVideos = [];

/* ═════════════════════════════════════════
   Wind fields
   ═════════════════════════════════════════ */
let windX = 0;
let windY = 0;

const WIND_IMPULSE = 240;
const WIND_BUMP_IMPULSE = 90;
const WIND_DECAY_PER_SEC = 0.15;
const WIND_MAX = 560;

function applyWindImpulseX(direction, strength = WIND_IMPULSE) {
  windX += direction * strength;
  if (windX >  WIND_MAX) windX =  WIND_MAX;
  if (windX < -WIND_MAX) windX = -WIND_MAX;
}

function applyWindImpulseY(direction, strength = WIND_IMPULSE) {
  windY += direction * strength;
  if (windY >  WIND_MAX) windY =  WIND_MAX;
  if (windY < -WIND_MAX) windY = -WIND_MAX;
}

/* ═════════════════════════════════════════
   XMB logic
   ═════════════════════════════════════════ */

const HORIZONTAL_ANCHOR = 0.30;

const catRow   = document.getElementById('category-row');
const itemsEl  = document.getElementById('items');
const viewport = document.getElementById('category-viewport');
const pagerEl  = document.getElementById('pager');
const cats     = Object.keys(DATA);
let activeIdx  = 0;

const selectedItemIdx = {};
cats.forEach(name => { selectedItemIdx[name] = 0; });

const SELECTED_ICON_GAP_FROM_LABEL = 50;
const SELECTED_ITEM_MARGIN_TOP = 104;

let itemsPositionY = 0;
let itemsBumpY = 0;

function applyItemsTransform() {
  itemsEl.style.transform = `translateY(${itemsPositionY + itemsBumpY}px)`;
}

function positionItems(animate = true) {
  const cat = cats[activeIdx];
  const sel = selectedItemIdx[cat] || 0;
  const itemEl = itemsEl.children[sel];
  if (!itemEl) return;

  const iconEl = itemEl.querySelector('.item-icon');
  if (!iconEl) return;

  const activeCatEl = catRow.children[activeIdx];
  const labelEl = activeCatEl.querySelector('.cat-label');
  if (!labelEl) return;

  const barBottom = labelEl.getBoundingClientRect().bottom;
  const iconTop = iconEl.getBoundingClientRect().top;
  const delta = barBottom + SELECTED_ICON_GAP_FROM_LABEL - iconTop;
  itemsPositionY += delta;

  if (animate) {
    applyItemsTransform();
  } else {
    itemsEl.style.transition = 'none';
    applyItemsTransform();
    void itemsEl.offsetHeight;
    itemsEl.style.transition = '';
  }
}

cats.forEach((name, i) => {
  const el = document.createElement('div');
  el.className = 'category';
  el.dataset.cat = name;
  el.innerHTML = `<div class="cat-icon">${DATA[name].icon}</div>
                  <div class="cat-label">${name}</div>`;
  el.addEventListener('click', () => {
    if (i === activeIdx) { playConfirmSound(); return; }
    const direction = i > activeIdx ? -1 : 1;
    applyWindImpulseX(direction);
    playNavSound();
    goTo(i);
  });
  catRow.appendChild(el);
});

cats.forEach(() => {
  const d = document.createElement('div');
  d.className = 'dot';
  pagerEl.appendChild(d);
});

function goTo(idx) {
  const n = cats.length;
  const clamped = Math.max(0, Math.min(n - 1, idx));
  if (clamped === activeIdx) return;
  activeIdx = clamped;
  updateActive();
  renderItems(cats[activeIdx]);
  centerActive();
  positionItems(false);
}

function next() {
  if (activeIdx >= cats.length - 1) { bumpCategoryEdge(1); return; }
  playNavSound();
  applyWindImpulseX(-1);
  goTo(activeIdx + 1);
}

function prev() {
  if (activeIdx <= 0) { bumpCategoryEdge(-1); return; }
  playNavSound();
  applyWindImpulseX(1);
  goTo(activeIdx - 1);
}

function bumpCategoryEdge(direction) {
  playEdgeSound();
  applyWindImpulseX(direction, WIND_BUMP_IMPULSE);

  const current = catRow.style.transform || '';
  const match = current.match(/translateX\(([-\d.]+)px\)/);
  const baseX = match ? parseFloat(match[1]) : 0;
  const offset = direction * 18;

  catRow.style.transition = 'transform 0.12s ease';
  catRow.style.transform = `translateX(${baseX + offset}px)`;

  setTimeout(() => {
    catRow.style.transition = '';
    centerActive();
  }, 130);
}

function updateActive() {
  [...catRow.children].forEach((el, i) => {
    el.classList.toggle('active', i === activeIdx);
  });
  [...pagerEl.children].forEach((d, i) => {
    d.classList.toggle('active', i === activeIdx);
  });
}

function centerActive() {
  const activeEl = catRow.children[activeIdx];
  if (!activeEl) return;
  const vw = viewport.clientWidth;
  const elCenter = activeEl.offsetLeft + activeEl.offsetWidth / 2;
  const targetX = vw * HORIZONTAL_ANCHOR;
  catRow.style.transform = `translateX(${targetX - elCenter}px)`;
}

function nextItem() {
  const cat = cats[activeIdx];
  const maxIdx = DATA[cat].items.length - 1;
  if (selectedItemIdx[cat] >= maxIdx) { bumpItemEdge(1); return; }
  playNavSound();
  applyWindImpulseY(-1);
  selectedItemIdx[cat]++;
  updateItemSelection();
  positionItems(true);
}

function prevItem() {
  const cat = cats[activeIdx];
  if (selectedItemIdx[cat] <= 0) { bumpItemEdge(-1); return; }
  playNavSound();
  applyWindImpulseY(1);
  selectedItemIdx[cat]--;
  updateItemSelection();
  positionItems(true);
}

function bumpItemEdge(direction) {
  playEdgeSound();
  applyWindImpulseY(direction, WIND_BUMP_IMPULSE);

  itemsBumpY = direction * 14;
  itemsEl.style.transition = 'transform 0.12s ease';
  applyItemsTransform();

  setTimeout(() => {
    itemsEl.style.transition = '';
    itemsBumpY = 0;
    applyItemsTransform();
  }, 130);
}

function updateItemSelection() {
  const cat = cats[activeIdx];
  const sel = selectedItemIdx[cat] || 0;
  itemsEl.querySelectorAll('.item').forEach((el, i) => {
    el.classList.toggle('selected', i === sel);
    const isNearBar = (i === sel) || (i === sel - 1 && sel > 0);
    el.classList.toggle('near-bar', isNearBar);
    el.style.marginTop = (i === sel && sel > 0)
      ? SELECTED_ITEM_MARGIN_TOP + 'px'
      : '0px';
  });
}

/* ═════════════════════════════════════════
   Directory picker
   ═════════════════════════════════════════ */
async function pickVideoDirectory() {
  if (window.electronAPI && typeof window.electronAPI.pickDirectory === 'function') {
    return await window.electronAPI.pickDirectory();
  }
  if (typeof window.showDirectoryPicker === 'function') {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      return { name: handle.name, path: handle.name };
    } catch (err) {
      if (err && err.name === 'AbortError') return null;
    }
  }
  return null;
}

async function handleDirectoryPick() {
  const result = await pickVideoDirectory();
  if (!result) return;

  selectedVideoFolder = result;

  const dirItem = DATA.Video.items.find(it => it.id === 'directory');
  if (dirItem) {
    dirItem.label = `Directory · ${result.name}`;
  }
  if (cats[activeIdx] === 'Video') {
    renderItems('Video');
    positionItems(false);
  }

  showToast(`Scanning ${result.name}\u2026`, 4000);
  try {
    const files = await window.electronAPI.scanVideos(result.path);
    scannedVideos = files || [];
    showToast(`Found ${scannedVideos.length} video${scannedVideos.length === 1 ? '' : 's'} in ${result.name}`, 3500);
    console.log('Scanned videos:', scannedVideos);
  } catch (err) {
    console.error('scan-videos failed:', err);
    showToast('Failed to scan folder', 3000);
  }
}

/* ═════════════════════════════════════════
   Activate the currently-selected vertical item
   ═════════════════════════════════════════ */
function activateSelectedItem() {
  const cat = cats[activeIdx];
  const sel = selectedItemIdx[cat] || 0;
  const item = DATA[cat].items[sel];
  if (!item) return;

  playConfirmSound();

  if (item.id === 'directory') {
    handleDirectoryPick();
    return;
  }

  showToast(`${cat} · ${item.label}`);
}

function renderItems(name) {
  const sel = selectedItemIdx[name] || 0;
  itemsEl.innerHTML = DATA[name].items.map((item, i) => {
    const marginTop = (i === sel && sel > 0) ? SELECTED_ITEM_MARGIN_TOP : 0;
    const isNearBar = (i === sel) || (i === sel - 1 && sel > 0);
    return `
      <div class="item${i === sel ? ' selected' : ''}${isNearBar ? ' near-bar' : ''}"
           style="margin-top:${marginTop}px; animation-delay:${i * 30}ms">
        <div class="item-icon">${ICONS[item.icon] || ICONS.folder}</div>
        <div class="item-label">${item.label}</div>
      </div>
    `;
  }).join('');

  itemsEl.querySelectorAll('.item').forEach((el, i) => {
    el.addEventListener('mousedown',  () => el.classList.add('pressed'));
    el.addEventListener('mouseup',    () => el.classList.remove('pressed'));
    el.addEventListener('mouseleave', () => el.classList.remove('pressed'));
    el.addEventListener('click', () => {
      const cat = cats[activeIdx];
      if (selectedItemIdx[cat] === i) {
        activateSelectedItem();
        return;
      }
      const direction = i > selectedItemIdx[cat] ? -1 : 1;
      applyWindImpulseY(direction);
      selectedItemIdx[cat] = i;
      updateItemSelection();
      positionItems(true);
      activateSelectedItem();
    });
  });
}

/* ═════════════════════════════════════════
   Input
   ═════════════════════════════════════════ */
const WHEEL_COOLDOWN_MS = 260;
let lastWheelTime = 0;

function onWheel(e) {
  e.preventDefault();
  const now = performance.now();
  if (now - lastWheelTime < WHEEL_COOLDOWN_MS) return;
  if (e.deltaY > 0) nextItem();
  else if (e.deltaY < 0) prevItem();
  lastWheelTime = now;
}

window.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('scroll', () => window.scrollTo(0, 0));

const KEY_COOLDOWN_MS = 180;
let lastKeyTime = 0;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    activateSelectedItem();
    return;
  }

  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' &&
      e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();

  const now = performance.now();
  if (now - lastKeyTime < KEY_COOLDOWN_MS) return;
  lastKeyTime = now;

  if (e.key === 'ArrowUp')        prevItem();
  else if (e.key === 'ArrowDown') nextItem();
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowRight') next();
});

/* Esc toggles native fullscreen via Electron */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (window.electronAPI && window.electronAPI.toggleFullscreen) {
      window.electronAPI.toggleFullscreen();
    } else {
      console.warn('Escape pressed but electronAPI.toggleFullscreen is missing');
    }
  }
});

function unlockAudio() {
  try { getCtx(); } catch (err) {}
  window.removeEventListener('wheel', unlockAudio);
  window.removeEventListener('click', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('wheel', unlockAudio);
window.addEventListener('click', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function init() {
  updateActive();
  renderItems(cats[activeIdx]);
  requestAnimationFrame(() => {
    centerActive();
    positionItems(false);
  });
}
init();

window.addEventListener('resize', () => {
  centerActive();
  positionItems(false);
});

/* ═════════════════════════════════════════
   Clock
   ═════════════════════════════════════════ */
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function updateClock() {
  const now = new Date();
  const h   = now.getHours();
  const h12 = h % 12 || 12;
  const m   = String(now.getMinutes()).padStart(2, '0');
  const ap  = h >= 12 ? 'PM' : 'AM';

  document.getElementById('clock-time').textContent = `${h12}:${m} ${ap}`;
  document.getElementById('clock-date').textContent =
    `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
}
updateClock();
setInterval(updateClock, 1000);

/* ═════════════════════════════════════════
   WAVE BACKGROUND
   ═════════════════════════════════════════ */
const canvas = document.getElementById('wave');
const ctx    = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1;

function resizeCanvas() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  rebuildSprites();
}

const WAVES = [
  {
    amp: 40, len: 2900, yOff: 0.53, thickness: 174, phase: 0.4,
    breathe1: 0.22, breathe2: 0.30, breathePhase: 0.0,
    swaySpeed: 0.055, swayAmt: 0.16, swayPhase: 0.0,
    rgb: '28, 62, 112', alpha: 0.58,
    edgeW: 0.15,
    glowBlur: 34,
    slopeRef: 0.10,
    foldAmp: 0.05,
    foldFreq: 0.0034,
    foldSpeed: 0.05,
    thickAmp: 0.65,
    thickFreq1: 0.55,  thickSpeed1: 0.13, thickPhase1: 0.0,
    thickFreq2: 1.15,  thickSpeed2: 0.08, thickPhase2: 1.7,
    harm2: 0.28,
    harm3: 0.13,
    warpFreq: 0.0007, warpAmt: 0.42, warpPhase: 0.0,
    sweepFreq: 0.0022, sweepSpeed: 0.10, sweepPhase: 0.0,
  },
  {
    amp: 56, len: 2200, yOff: 0.47, thickness: 154, phase: 1.9,
    breathe1: 0.27, breathe2: 0.36, breathePhase: 1.3,
    swaySpeed: 0.070, swayAmt: 0.14, swayPhase: 1.3,
    rgb: '58, 108, 178', alpha: 0.64,
    edgeW: 0.18,
    glowBlur: 40,
    slopeRef: 0.18,
    foldAmp: 0.06,
    foldFreq: 0.0042,
    foldSpeed: 0.07,
    thickAmp: 0.75,
    thickFreq1: 0.62,  thickSpeed1: 0.17, thickPhase1: 1.1,
    thickFreq2: 1.30,  thickSpeed2: 0.10, thickPhase2: 2.9,
    harm2: 0.32,
    harm3: 0.15,
    warpFreq: 0.0009, warpAmt: 0.38, warpPhase: 2.1,
    sweepFreq: 0.0028, sweepSpeed: 0.14, sweepPhase: 2.4,
  },
  {
    amp: 70, len: 1600, yOff: 0.43, thickness: 133, phase: 3.6,
    breathe1: 0.33, breathe2: 0.44, breathePhase: 2.6,
    swaySpeed: 0.085, swayAmt: 0.12, swayPhase: 2.6,
    rgb: '110, 170, 235', alpha: 0.52,
    edgeW: 0.20,
    glowBlur: 44,
    slopeRef: 0.28,
    foldAmp: 0.07,
    foldFreq: 0.0052,
    foldSpeed: 0.09,
    thickAmp: 0.85,
    thickFreq1: 0.70,  thickSpeed1: 0.22, thickPhase1: 2.3,
    thickFreq2: 1.45,  thickSpeed2: 0.13, thickPhase2: 4.1,
    harm2: 0.36,
    harm3: 0.17,
    warpFreq: 0.0011, warpAmt: 0.34, warpPhase: 4.3,
    sweepFreq: 0.0034, sweepSpeed: 0.19, sweepPhase: 5.1,
  },
];

const ALPHA_STOPS = [
  [0.00, 1.000],
  [0.25, 1.000],
  [0.40, 0.720],
  [0.52, 0.480],
  [0.63, 0.280],
  [0.73, 0.140],
  [0.81, 0.055],
  [0.88, 0.015],
  [0.94, 0.003],
  [1.00, 0.000],
];

let ribbonSprites = [];

function buildRibbonSprite(w) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = Math.max(2, Math.round(w.thickness));
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  for (const [pos, a] of ALPHA_STOPS) {
    grad.addColorStop(pos, `rgba(${w.rgb}, ${(a * w.alpha).toFixed(4)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function rebuildSprites() {
  ribbonSprites = WAVES.map(buildRibbonSprite);
}

function waveY(w, x, t) {
  const baseY = H * w.yOff;
  const sway = Math.sin(t * w.swaySpeed + w.swayPhase) * w.swayAmt;

  const warp = Math.sin(x * w.warpFreq + w.warpPhase) * w.warpAmt;
  const phase = (x / w.len) * Math.PI * 2 + w.phase + sway + warp;

  const h2T = w.harm2 * (0.7 + 0.3 * Math.sin(t * 0.11 + w.phase));
  const h3T = w.harm3 * (0.7 + 0.3 * Math.sin(t * 0.15 + w.phase * 1.4));

  const primary = Math.sin(phase)
                + h2T * Math.sin(phase * 2 + 0.7)
                + h3T * Math.sin(phase * 3 + 1.9);

  const widePhase = (x / (w.len * 1.62)) * Math.PI * 2 + w.phase * 1.7 - sway * 1.3;
  const wide = Math.sin(widePhase);

  const ripPhase = (x / (w.len * 0.38)) * Math.PI * 2 + w.phase * 0.5 + sway * 0.8;
  const ripple = Math.sin(ripPhase);

  const o1 = Math.cos(t * w.breathe1 + w.breathePhase);
  const o2 = Math.cos(t * w.breathe2 + w.breathePhase * 0.7 + 1.1);
  const o3 = Math.cos(t * (w.breathe1 * 1.51) + w.breathePhase * 1.3 + 2.4);

  return baseY
    + primary * o1 * w.amp * 0.60
    + wide    * o2 * w.amp * 0.42
    + ripple  * o3 * w.amp * 0.20;
}

function thicknessMult(w, x, t) {
  const v1 = Math.sin((x * w.thickFreq1 / 1000) + t * w.thickSpeed1 + w.thickPhase1);
  const v2 = Math.sin((x * w.thickFreq2 / 1000) + t * w.thickSpeed2 + w.thickPhase2);
  return 1 + w.thickAmp * (v1 * 0.65 + v2 * 0.35);
}

function waveSlope(w, x, t) {
  const dx = 6;
  return (waveY(w, x + dx, t) - waveY(w, x - dx, t)) / (2 * dx);
}

function highlightIntensity(w, x, t) {
  const slope = Math.abs(waveSlope(w, x, t));
  const sn = Math.min(1, slope / w.slopeRef);
  const slopeTerm = Math.pow(sn, 1.25);

  const sweep = 0.5 + 0.5 * Math.sin(x * w.sweepFreq + t * w.sweepSpeed + w.sweepPhase);

  return Math.min(1, slopeTerm * (0.30 + 0.85 * sweep));
}

function buildHighlightGradient(w, t, N = 96) {
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * W;
    const bright = highlightIntensity(w, x, t);
    const a = bright * 0.95;
    const r = Math.round(60  + 165 * bright);
    const g = Math.round(120 + 115 * bright);
    const b = Math.round(190 +  60 * bright);
    grad.addColorStop(i / N, `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`);
  }
  return grad;
}

function buildGlowGradient(w, t, N = 64) {
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * W;
    const bright = highlightIntensity(w, x, t);
    const r = Math.round(60  + 50 * bright);
    const g = Math.round(110 + 60 * bright);
    const b = Math.round(170 + 55 * bright);
    const a = bright * 0.70;
    grad.addColorStop(i / N, `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`);
  }
  return grad;
}

/* ═════════════════════════════════════════
   SPARKLE SPRITE FAMILY
   ═════════════════════════════════════════ */

const SPARKLE_SPRITE_SIZE = 96;
const SPARKLE_LEVELS = 12;

const SPARKLE_STOPS = [0.00, 0.06, 0.14, 0.26, 0.42, 0.60, 0.78, 0.91, 1.00];

const SHARP_PROFILE = [1.00, 1.00, 0.62, 0.18, 0.045, 0.012, 0.004, 0.001, 0.000];
const SOFT_PROFILE  = [0.42, 0.48, 0.55, 0.60, 0.61, 0.52, 0.32, 0.13, 0.000];

function buildSparkleSprite(focus) {
  const S = SPARKLE_SPRITE_SIZE;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);

  for (let i = 0; i < SPARKLE_STOPS.length; i++) {
    const a = SHARP_PROFILE[i] * (1 - focus) + SOFT_PROFILE[i] * focus;
    const r = Math.round(238 + 6 * focus);
    const gr = Math.round(246 + 2 * focus);
    const b = 255;
    grad.addColorStop(SPARKLE_STOPS[i], `rgba(${r}, ${gr}, ${b}, ${a.toFixed(4)})`);
  }

  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return c;
}

const SPARKLE_SPRITES = [];
for (let i = 0; i < SPARKLE_LEVELS; i++) {
  SPARKLE_SPRITES.push(buildSparkleSprite(i / (SPARKLE_LEVELS - 1)));
}

const sparkles = [];
const MAX_SPARKLES = 560;
const SPAWN_RATE = 195;

const SPARKLE_SIZE_MIN = 0.70;
const SPARKLE_SIZE_MAX = 1.80;

const SPARKLE_LIFE_MIN = 1.0;
const SPARKLE_LIFE_MAX = 2.0;

const WIND_Y_ELIGIBLE_FRACTION = 0.40;
const WIND_Y_STRENGTH_MULT = 0.60;

const OUTSIDE_BAND_FRACTION = 0.30;
const OUTSIDE_BAND_DIST = 55;

function spawnSparkle(t) {
  if (sparkles.length >= MAX_SPARKLES) return;

  const w = WAVES[(Math.random() * WAVES.length) | 0];
  const x = Math.random() * W;
  const thick = w.thickness * thicknessMult(w, x, t);
  const topY = waveY(w, x, t);

  let y;
  const roll = Math.random();
  if (roll < OUTSIDE_BAND_FRACTION / 2) {
    y = topY - 6 - Math.random() * OUTSIDE_BAND_DIST;
  } else if (roll < OUTSIDE_BAND_FRACTION) {
    y = topY + thick + 6 + Math.random() * OUTSIDE_BAND_DIST;
  } else {
    const bias = Math.pow(Math.random(), 1.6);
    y = topY + bias * thick * 0.55;
  }

  const u = Math.pow(Math.random(), 4.0);
  const size = SPARKLE_SIZE_MIN + u * (SPARKLE_SIZE_MAX - SPARKLE_SIZE_MIN);

  const focus = Math.max(0, Math.min(1,
    (size - SPARKLE_SIZE_MIN) / (SPARKLE_SIZE_MAX - SPARKLE_SIZE_MIN)
  ));

  const maxLife = SPARKLE_LIFE_MIN + u * (SPARKLE_LIFE_MAX - SPARKLE_LIFE_MIN);

  const spriteIdx = Math.round(focus * (SPARKLE_LEVELS - 1));

  const angle = Math.random() * Math.PI * 2;
  const speed = 4 + Math.random() * 12;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  const flickerAmt = 0.55 - focus * 0.42;

  const baseAlpha = 0.55 + Math.random() * 0.35 + (1 - focus) * 0.14;

  const sizeFactor = Math.max(0, 1 - focus / 0.65);
  const windResponseX = sizeFactor * (0.45 + Math.random() * 0.55);

  let windResponseY = 0;
  if (windResponseX > 0 && Math.random() < WIND_Y_ELIGIBLE_FRACTION) {
    windResponseY = windResponseX * WIND_Y_STRENGTH_MULT;
  }

  sparkles.push({
    x, y,
    vx, vy,
    life: 0,
    maxLife,
    size,
    focus,
    spriteIdx,
    baseAlpha,
    windResponseX,
    windResponseY,
    flickerSpeed: 4 + Math.random() * 12,
    flickerPhase: Math.random() * Math.PI * 2,
    flickerAmt,
  });
}

let start = performance.now();
let lastFrame = start;
let spritesReady = false;

function draw(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = (now - start) / 1000;

  if (!spritesReady) {
    rebuildSprites();
    spritesReady = true;
  }

  windX *= Math.pow(WIND_DECAY_PER_SEC, dt);
  windY *= Math.pow(WIND_DECAY_PER_SEC, dt);
  const windStepX = windX * dt;
  const windStepY = windY * dt;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,    '#02050c');
  bg.addColorStop(0.45, '#05101f');
  bg.addColorStop(1,    '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const STEP = 2;

  WAVES.forEach((w, wi) => {
    const sprite = ribbonSprites[wi];
    if (!sprite) return;

    const foldBase = 1 - w.foldAmp;
    for (let x = 0; x < W; x += STEP) {
      const topY = waveY(w, x, t);
      const fold = foldBase + w.foldAmp * (
        0.5 + 0.5 * Math.sin(x * w.foldFreq + t * w.foldSpeed + wi * 1.7)
      );
      const thickMult = thicknessMult(w, x, t);
      ctx.globalAlpha = fold;
      ctx.drawImage(sprite, x, topY, STEP, w.thickness * thickMult);
    }
    ctx.globalAlpha = 1;

    const glowGrad = buildGlowGradient(w, t);
    ctx.beginPath();
    for (let x = 0; x <= W + STEP; x += STEP) {
      const y = waveY(w, x, t);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = glowGrad;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(110, 170, 230, 0.75)';
    ctx.shadowBlur = w.glowBlur;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const highlightGrad = buildHighlightGradient(w, t);
    ctx.beginPath();
    for (let x = 0; x <= W + STEP; x += STEP) {
      const y = waveY(w, x, t);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = highlightGrad;
    ctx.lineWidth = w.edgeW;
    ctx.lineCap = 'round';
    ctx.stroke();

    const specGrad = ctx.createLinearGradient(0, 0, W, 0);
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W;
      const bright = highlightIntensity(w, x, t);
      const transmit = 1 - Math.pow(bright, 0.85);
      const a = transmit * bright * 0.30;
      specGrad.addColorStop(i / N,
        `rgba(210, 235, 255, ${a.toFixed(3)})`);
    }
    ctx.beginPath();
    for (let x = 0; x <= W + STEP; x += STEP) {
      const y = waveY(w, x, t) + 1.6;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = specGrad;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  });

  const expected = SPAWN_RATE * dt;
  let n = Math.floor(expected);
  if (Math.random() < expected - n) n++;
  for (let i = 0; i < n; i++) spawnSparkle(t);

  ctx.globalCompositeOperation = 'lighter';

  for (let i = sparkles.length - 1; i >= 0; i--) {
    const p = sparkles[i];
    p.life += dt;

    if (p.life >= p.maxLife) {
      sparkles.splice(i, 1);
      continue;
    }

    p.x += p.vx * dt + windStepX * p.windResponseX;
    p.y += p.vy * dt + windStepY * p.windResponseY;

    const lifeT = p.life / p.maxLife;
    const fade = lifeT < 0.15
      ? lifeT / 0.15
      : Math.pow(1 - (lifeT - 0.15) / 0.85, 1.4);

    const flicker = 1 - p.flickerAmt
      + p.flickerAmt * (0.5 + 0.5 * Math.sin(t * p.flickerSpeed + p.flickerPhase));

    const alpha = Math.max(0, Math.min(1, fade * flicker * p.baseAlpha));

    const drawSize = p.size * 8;

    ctx.globalAlpha = alpha;
    ctx.drawImage(
      SPARKLE_SPRITES[p.spriteIdx],
      p.x - drawSize / 2,
      p.y - drawSize / 2,
      drawSize, drawSize
    );

    const coreStrength = Math.max(0, 1 - p.focus / 0.7);
    if (coreStrength > 0) {
      const coreR = Math.max(0.7, drawSize * 0.060);
      ctx.globalAlpha = Math.min(1, alpha * 1.5 * coreStrength);
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  requestAnimationFrame(draw);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(draw);