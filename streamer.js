'use strict';
// Streamer mode: a local overlay page for OBS (Browser Source), an always-on-top overlay
// window, and global hotkeys. Nothing here touches the game process.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, globalShortcut } = require('electron');
const icons = require('./icon-store');

const SRC = path.join(__dirname, 'src');
const STATIC = {
  '/overlay': ['overlay.html', 'text/html; charset=utf-8'],
  '/overlay.js': ['overlay.js', 'text/javascript; charset=utf-8'],
  '/overlay.css': ['overlay.css', 'text/css; charset=utf-8'],
  '/icons.js': ['icons.js', 'text/javascript; charset=utf-8'],
};
const HOTKEYS = {
  spin: 'CommandOrControl+Shift+S',
  reveal: 'CommandOrControl+Shift+R',
  overlay: 'CommandOrControl+Shift+O',
};

let server = null;
let port = 0;
let state = null;            // latest roll, sent to every overlay
const clients = new Set();   // open SSE responses
let overlayWin = null;
let mainWin = null;
let config = { on: false, overlay: false, port: 7373, layout: 'h', names: true, bg: 'transparent' };

const alive = () => mainWin && !mainWin.isDestroyed();

function send(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/state') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.add(res);
    if (state) send(res, state);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/fonts/')) {
    const file = url.pathname.startsWith('/icons/')
      ? icons.filePathFor(decodeURIComponent(url.pathname.slice(7)))
      : path.join(SRC, 'fonts', path.basename(decodeURIComponent(url.pathname)));
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const type = file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.webp') ? 'image/webp' : file.match(/\.jpe?g$/) ? 'image/jpeg' : 'image/png';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=3600' });
      res.end(buf);
    });
    return;
  }
  const entry = STATIC[url.pathname === '/' ? '/overlay' : url.pathname];
  if (!entry) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-cache' });
  res.end(fs.readFileSync(path.join(SRC, entry[0])));
}

function startServer(wanted) {
  return new Promise((resolve) => {
    if (server && port === wanted) { resolve(port); return; }
    stopServer();
    const s = http.createServer(handle);
    s.on('error', () => {
      // Port taken: fall back to any free port so streamer mode still works.
      if (wanted) { s.close(); startServer(0).then(resolve); } else resolve(0);
    });
    s.listen(wanted, '127.0.0.1', () => {
      server = s;
      port = s.address().port;
      resolve(port);
    });
  });
}

function stopServer() {
  for (const res of clients) res.end();
  clients.clear();
  server?.close();
  server = null;
  port = 0;
}

const overlayUrl = (extra = {}) => {
  const q = new URLSearchParams({ layout: config.layout, names: config.names ? '1' : '0', bg: config.bg, ...extra });
  return `http://127.0.0.1:${port}/overlay?${q}`;
};

function openOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) { overlayWin.show(); return; }
  overlayWin = new BrowserWindow({
    width: config.layout === 'v' ? 300 : 640, height: config.layout === 'v' ? 520 : 170,
    frame: false, transparent: true, alwaysOnTop: true, resizable: true, hasShadow: false,
    skipTaskbar: false, title: 'Xurqxys Overlay', backgroundColor: '#00000000',
    webPreferences: { sandbox: true, contextIsolation: true, devTools: !app.isPackaged },
  });
  // 'screen-saver' keeps it above borderless-fullscreen games.
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.loadURL(overlayUrl({ window: '1', bg: 'transparent' }));
  overlayWin.on('closed', () => {
    overlayWin = null;
    if (config.overlay) { config.overlay = false; alive() && mainWin.webContents.send('stream:changed', status()); }
  });
}

function closeOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.close();
  overlayWin = null;
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const failed = [];
  const reg = (accel, fn) => { if (!globalShortcut.register(accel, fn)) failed.push(accel); };
  reg(HOTKEYS.spin, () => alive() && mainWin.webContents.send('stream:hotkey', 'spin'));
  reg(HOTKEYS.reveal, () => alive() && mainWin.webContents.send('stream:hotkey', 'reveal'));
  reg(HOTKEYS.overlay, () => {
    config.overlay = !config.overlay;
    config.overlay ? openOverlay() : closeOverlay();
    alive() && mainWin.webContents.send('stream:changed', status());
  });
  return failed;
}

function status() {
  return { ...config, running: !!server, port, url: server ? overlayUrl() : '', hotkeys: HOTKEYS, hotkeyErrors: status.hotkeyErrors || [] };
}

async function configure(next, win) {
  mainWin = win || mainWin;
  config = { ...config, ...next };
  if (!config.on) {
    closeOverlay();
    stopServer();
    globalShortcut.unregisterAll();
    status.hotkeyErrors = [];
    return status();
  }
  await startServer(Number(config.port) || 7373);
  status.hotkeyErrors = registerHotkeys();
  if (config.overlay) {
    // Reload so layout changes apply.
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.loadURL(overlayUrl({ window: '1', bg: 'transparent' }));
    else openOverlay();
  } else {
    closeOverlay();
  }
  return status();
}

function publish(next) {
  state = next;
  for (const res of clients) send(res, state);
}

function shutdown() {
  globalShortcut.unregisterAll();
  closeOverlay();
  stopServer();
}

module.exports = { configure, publish, status, shutdown, HOTKEYS };
