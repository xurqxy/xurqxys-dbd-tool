// window.api for the mobile app (PWA in the browser, or the Android app built with Capacitor).
// Same interface as preload.js on desktop, so the renderer code in src/ runs unchanged.
// Data lives in localStorage; icons are linked straight from the DBD Wiki instead of downloaded.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import { buildBaseData, slug } from '../data/base-data';
import { syncFromWiki, applyWikiData } from '../wiki-sync';
import * as core from '../wiki-core';

/* global __APP_VERSION__, __REPO__, __WIKI_API__ */
const NATIVE = Capacitor.isNativePlatform();
const LINKS = { github: 'https://github.com/xurqxy', coffee: 'https://buymeacoffee.com/xurqxy', repo: __REPO__ ? `https://github.com/${__REPO__}` : '' };

core.configure({ cors: true, apis: __WIKI_API__ ? __WIKI_API__.split(',') : null });

// ---------- Storage ----------
const PREFIX = 'xq:';
const DEFAULTS = {
  matches: [],
  builds: [],
  settings: { onlyOwned: false },
  owned: {},
  dataOverrides: { perks: {}, killers: {}, survivors: {} },
  customDataset: null,
  wikiData: null,
  progress: { spins: 0, modeSpins: {}, shares: 0, streamer: false, days: [], unlocked: {} },
  icons: {},
};
function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) return JSON.parse(raw);
  } catch { /* unreadable: fall back to the default */ }
  return structuredClone(DEFAULTS[key]);
}
function write(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`Unknown store key: ${key}`);
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
  return true;
}
// Ask the browser not to clear our data when the phone runs low on space.
navigator.storage?.persist?.().catch(() => {});

function getData() {
  const custom = read('customDataset');
  const wiki = read('wikiData');
  const data = applyWikiData(structuredClone(custom || buildBaseData()), wiki, slug);
  const o = read('dataOverrides');
  for (const key of ['perks', 'killers', 'survivors']) data[key] = data[key].map((e) => ({ ...e, ...(o[key]?.[e.id] || {}) }));
  data.presets ||= buildBaseData().presets;
  data.source = custom ? 'imported' : wiki ? 'bundled + wiki' : 'bundled';
  data.wikiSyncedAt = wiki?.fetchedAt || null;
  return data;
}
const isValidDataset = (d) => d && Array.isArray(d.killers) && Array.isArray(d.survivors) && Array.isArray(d.perks) &&
  d.perks.every((p) => p.id && p.name && (p.role === 'killer' || p.role === 'survivor'));

// ---------- Files ----------
function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
// Phones: open the share sheet (save to Files, send to Discord…). Desktop browsers: a normal download.
async function deliver(name, { text, dataUrl, mime }) {
  if (NATIVE) {
    const data = dataUrl ? dataUrl.split(',')[1] : toBase64(text);
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    await Share.share({ title: name, files: [uri] });
    return true;
  }
  const blob = dataUrl ? await (await fetch(dataUrl)).blob() : new Blob([text], { type: mime });
  const file = new File([blob], name, { type: blob.type || mime });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return true;
}
const MIME = { csv: 'text/csv', json: 'application/json' };

// ---------- Events ----------
const listeners = { wiki: null, icons: null };

// ---------- Updates ----------
// The web version updates itself through the service worker. The Android app checks GitHub Releases for a newer APK.
const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};
async function checkUpdate() {
  if (!NATIVE || !__REPO__) return { ok: true, available: false, current: __APP_VERSION__ };
  try {
    const res = await fetch(`https://api.github.com/repos/${__REPO__}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return { ok: true, available: false, current: __APP_VERSION__ };
    const rel = await res.json();
    const apk = (rel.assets || []).find((a) => /\.apk$/i.test(a.name));
    return { ok: true, current: __APP_VERSION__, latest: rel.tag_name, available: !!apk && newer(rel.tag_name, __APP_VERSION__), url: apk?.browser_download_url || rel.html_url, oneClick: false };
  } catch {
    return { ok: true, available: false, current: __APP_VERSION__ };
  }
}

function openExternal(url) {
  if (!/^https:\/\//.test(url)) return;
  // In the Android app, leaving the app's own origin opens the system browser.
  if (NATIVE) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}

const noop = () => {};
window.api = {
  getData: async () => getData(),
  getBaseData: async () => buildBaseData(),
  get: async (key) => read(key),
  set: async (key, value) => write(key, value),
  importDataset: async () => {
    const text = await pickFile('.json,application/json');
    if (text == null) return { ok: false, canceled: true };
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: `Could not read JSON: ${e.message}` }; }
    if (!isValidDataset(parsed)) return { ok: false, error: 'File is missing killers, survivors or perks.' };
    write('customDataset', parsed);
    return { ok: true };
  },
  resetDataset: async () => { write('customDataset', null); write('dataOverrides', structuredClone(DEFAULTS.dataOverrides)); return true; },
  saveFile: ({ defaultName, content, ext }) => deliver(defaultName, { text: content, mime: MIME[ext] || 'text/plain' }),
  openFile: ({ ext }) => pickFile(`.${ext}`),
  platform: NATIVE ? 'android' : 'web',
  getIcons: async () => read('icons'),
  syncWiki: async () => {
    try {
      const base = structuredClone(read('customDataset') || buildBaseData());
      const result = await syncFromWiki(base, (p) => listeners.wiki?.(p));
      write('wikiData', result);
      const addonKillers = Object.values(result.addons).filter((l) => l.length >= 2).length;
      const addonCount = Object.values(result.addons).reduce((n, l) => n + l.length, 0);
      return { ok: true, addonKillers, addonCount, newPerks: result.perks.length, descs: Object.keys(result.descs).length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
  appInfo: async () => ({ version: __APP_VERSION__, links: LINKS, kind: NATIVE ? 'android' : 'web' }),
  copyImage: async (dataUrl) => {
    if (!NATIVE && navigator.clipboard?.write && window.ClipboardItem) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        return true;
      } catch { /* not allowed here: share instead */ }
    }
    return deliver('xurqxys-build.png', { dataUrl });
  },
  saveImage: ({ defaultName, dataUrl }) => deliver(defaultName, { dataUrl }),
  checkUpdate,
  installUpdate: async () => ({ ok: true, manual: true, url: (await checkUpdate()).url || LINKS.repo }),
  onUpdateProgress: noop,
  openExternal,
  onWikiProgress: (cb) => { listeners.wiki = cb; },
  // Icons are linked from the wiki, so "downloading" means finding each icon's URL.
  downloadIcons: async (entries) => {
    try {
      listeners.icons?.({ done: 0, total: entries.length });
      const urls = await core.resolveIcons(entries);
      const icons = read('icons');
      for (const [key, url] of urls) {
        const [kind, ...rest] = key.split(':');
        (icons[kind] ||= {})[rest.join(':')] = url;
      }
      write('icons', icons);
      listeners.icons?.({ done: entries.length, total: entries.length });
      return { ok: true, found: urls.size, missing: entries.length - urls.size, failed: 0 };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
  importIcons: async () => ({ ok: false, error: 'Importing an icon folder is only available in the desktop app.' }),
  clearIcons: async () => write('icons', {}),
  configureStream: async () => ({ on: false }),
  streamStatus: async () => ({ on: false }),
  publishStream: noop,
  onStreamHotkey: noop,
  onStreamChanged: noop,
  onIconProgress: (cb) => { listeners.icons = cb; },
  minimize: noop,
  toggleMaximize: noop,
  close: noop,
  onWindowState: noop,
};

// Android back button: close a dialog or drawer first, then go back to the randomizer, then leave the app.
if (NATIVE) {
  App.addListener('backButton', () => {
    const modal = document.querySelector('.modal-back');
    if (modal) { modal.remove(); return; }
    if (document.querySelector('#drawer.open, .drawer.open')) { document.getElementById('scrim')?.click(); return; }
    const home = document.querySelector('#nav button[data-view="randomizer"]');
    if (home && !home.classList.contains('active')) { home.click(); return; }
    App.exitApp();
  });
}

// Offline support and automatic updates for the web version.
if (!NATIVE && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
