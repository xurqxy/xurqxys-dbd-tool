'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, clipboard, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { buildBaseData, slug } = require('./data/base-data');
const wiki = require('./wiki-sync');
const updater = require('./updater');
const icons = require('./icon-store');
const streamer = require('./streamer');

protocol.registerSchemesAsPrivileged([{ scheme: 'dbdicon', privileges: { standard: true, secure: true, corsEnabled: true, supportFetchAPI: true } }]);

const STORE_DEFAULTS = {
  matches: [],
  builds: [],
  settings: { onlyOwned: false },
  owned: {},            // characterId -> false when the player doesn't own them
  dataOverrides: { perks: {}, killers: {}, survivors: {} },
  customDataset: null,  // full dataset imported from a JSON file, replaces the bundled one
  wikiData: null,       // add-ons, missing perks and descriptions synced from the DBD Wiki
  progress: { spins: 0, modeSpins: {}, shares: 0, streamer: false, days: [], unlocked: {} }, // achievements
};

let storePath;
let store;

function loadStore() {
  storePath = path.join(app.getPath('userData'), 'xurqxys-store.json');
  try {
    store = { ...STORE_DEFAULTS, ...JSON.parse(fs.readFileSync(storePath, 'utf8')) };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Keep a copy of an unreadable store instead of silently overwriting it.
      fs.copyFileSync(storePath, `${storePath}.corrupt-${Date.now()}`);
    }
    store = structuredClone(STORE_DEFAULTS);
  }
}

function saveStore() {
  const tmp = `${storePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, storePath);
}

function getData() {
  const data = wiki.applyWikiData(structuredClone(store.customDataset || buildBaseData()), store.wikiData, slug);
  const o = store.dataOverrides;
  for (const key of ['perks', 'killers', 'survivors']) {
    data[key] = data[key].map((entry) => ({ ...entry, ...(o[key][entry.id] || {}) }));
  }
  data.presets ||= buildBaseData().presets;
  data.source = store.customDataset ? 'imported' : store.wikiData ? 'bundled + wiki' : 'bundled';
  data.wikiSyncedAt = store.wikiData?.fetchedAt || null;
  return data;
}

function isValidDataset(d) {
  return d && Array.isArray(d.killers) && Array.isArray(d.survivors) && Array.isArray(d.perks) &&
    d.perks.every((p) => p.id && p.name && (p.role === 'killer' || p.role === 'survivor'));
}

ipcMain.handle('data:get', () => getData());
ipcMain.handle('data:base', () => buildBaseData());
ipcMain.handle('store:get', (_e, key) => store[key]);
ipcMain.handle('store:set', (_e, key, value) => {
  if (!(key in STORE_DEFAULTS)) throw new Error(`Unknown store key: ${key}`);
  store[key] = value;
  saveStore();
  return true;
});

ipcMain.handle('dataset:import', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import DBD dataset', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'],
  });
  if (canceled) return { ok: false, canceled: true };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  } catch (err) {
    return { ok: false, error: `Could not read JSON: ${err.message}` };
  }
  if (!isValidDataset(parsed)) return { ok: false, error: 'File is missing killers, survivors or perks.' };
  store.customDataset = parsed;
  saveStore();
  return { ok: true };
});

ipcMain.handle('dataset:reset', () => {
  store.customDataset = null;
  store.dataOverrides = structuredClone(STORE_DEFAULTS.dataOverrides);
  saveStore();
  return true;
});

ipcMain.handle('image:copy', (_e, dataUrl) => {
  clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
  return true;
});
ipcMain.handle('image:save', async (e, { defaultName, dataUrl }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters: [{ name: 'PNG image', extensions: ['png'] }] });
  if (canceled) return false;
  fs.writeFileSync(filePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return true;
});

ipcMain.handle('file:save', async (e, { defaultName, content, ext }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (canceled) return false;
  fs.writeFileSync(filePath, content);
  return true;
});

ipcMain.handle('file:open', async (e, { ext }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }], properties: ['openFile'],
  });
  if (canceled) return null;
  return fs.readFileSync(filePaths[0], 'utf8');
});

// ---------- App info & update check ----------
const pkg = require('./package.json');
// Releases (updates, APK) come from releasesRepo when the source repo is private, otherwise from the source repo.
const REPO = pkg.releasesRepo || (pkg.repository?.url || '').match(/github\.com\/([^/]+\/[^/.]+)/)?.[1] || '';
const LINKS = { github: 'https://github.com/xurqxy', coffee: 'https://buymeacoffee.com/xurqxy', repo: REPO ? `https://github.com/${REPO}` : '' };

ipcMain.handle('app:info', () => ({ version: app.getVersion(), links: LINKS, kind: updater.installKind() }));
ipcMain.handle('update:check', () => updater.check(REPO));
ipcMain.handle('update:install', async (e) => {
  try {
    return await updater.install((p) => e.sender.send('update:progress', p));
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.on('open:external', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

ipcMain.handle('wiki:sync', async (e) => {
  try {
    const base = structuredClone(store.customDataset || buildBaseData());
    const result = await wiki.syncFromWiki(base, (p) => e.sender.send('wiki:progress', p));
    store.wikiData = result;
    saveStore();
    const addonKillers = Object.values(result.addons).filter((l) => l.length >= 2).length;
    const addonCount = Object.values(result.addons).reduce((n, l) => n + l.length, 0);
    return { ok: true, addonKillers, addonCount, newPerks: result.perks.length, descs: Object.keys(result.descs).length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('icons:get', () => icons.getManifest());
ipcMain.handle('icons:download', async (e, entries) => {
  try {
    const result = await icons.downloadFromWiki(entries, (p) => e.sender.send('icons:progress', p));
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('icons:import', async (e, entries) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Choose a folder of DBD icons', properties: ['openDirectory'] });
  if (canceled) return { ok: false, canceled: true };
  try {
    return { ok: true, ...icons.importFolder(filePaths[0], entries) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('stream:configure', (e, cfg) => streamer.configure(cfg, BrowserWindow.fromWebContents(e.sender)));
ipcMain.handle('stream:status', () => streamer.status());
ipcMain.on('stream:publish', (_e, state) => streamer.publish(state));
ipcMain.handle('icons:clear', () => { icons.clear(); return true; });

ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('win:toggle-maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#07060a',
    title: 'Xurqxys DBD Tool',
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged, // no developer tools in the released app
    },
  });
  // Open external links in the browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // A plain link click must never navigate the app window away.
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  const sendState = () => win.webContents.send('win:state', { maximized: win.isMaximized() });
  win.on('maximize', sendState);
  win.on('unmaximize', sendState);
  // The overlay window shouldn't keep the app alive once the main window is gone.
  win.on('closed', () => { streamer.shutdown(); app.quit(); });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  loadStore();
  icons.init(app.getPath('userData'));
  // CORS header so icons can be drawn onto the share-image canvas without tainting it.
  protocol.handle('dbdicon', async (req) => {
    const res = await net.fetch(pathToFileURL(icons.filePathFor(decodeURIComponent(new URL(req.url).pathname))).toString());
    return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'image/png', 'Access-Control-Allow-Origin': '*' } });
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => streamer.shutdown());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
