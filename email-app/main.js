'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { MailClient, PRESETS } = require('./mail');

let win = null;
let client = null;
let account = null; // { name, email, user, password, imap:{}, smtp:{}, provider }

const configPath = () => path.join(app.getPath('userData'), 'account.json');

// ---------- account storage (password encrypted with the OS keychain) ----------
function saveAccount(acc) {
  const { password, ...rest } = acc;
  let secret;
  if (safeStorage.isEncryptionAvailable()) {
    secret = { enc: 'safe', value: safeStorage.encryptString(password).toString('base64') };
  } else {
    secret = { enc: 'none', value: Buffer.from(password, 'utf8').toString('base64') };
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ ...rest, secret }, null, 2), { mode: 0o600 });
}

function loadAccount() {
  try {
    const data = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    const { secret, ...rest } = data;
    const buf = Buffer.from(secret.value, 'base64');
    const password = secret.enc === 'safe' ? safeStorage.decryptString(buf) : buf.toString('utf8');
    return { ...rest, password };
  } catch {
    return null;
  }
}

function publicAccount(acc) {
  if (!acc) return null;
  return { name: acc.name, email: acc.email, provider: acc.provider };
}

async function startClient(acc) {
  if (client) { client.removeAllListeners(); await client.close(); }
  account = acc;
  client = new MailClient(acc);
  client.on('new-mail', ev => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('mail:event', { type: 'new-mail', ...ev });
    if (!win.isFocused() && Notification.isSupported()) {
      new Notification({ title: 'New email', body: `New message in ${ev.folder}` }).show();
    }
  });
  client.on('flags', ev => { if (win && !win.isDestroyed()) win.webContents.send('mail:event', { type: 'flags', ...ev }); });
}

// ---------- IPC ----------
// Every handler returns {ok, data} or {ok:false, error} so the UI can show readable messages.
function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try { return { ok: true, data: await fn(...args) }; }
    catch (err) { return { ok: false, error: (err && err.message) || String(err) }; }
  });
}

function needClient() {
  if (!client) throw new Error('Not signed in.');
  return client;
}

function validateAccount(input) {
  const preset = PRESETS[input.provider] || PRESETS.custom;
  const email = String(input.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!input.password) throw new Error('Enter your password or app password.');
  const imap = input.provider === 'custom' ? input.imap : preset.imap;
  const smtp = input.provider === 'custom' ? input.smtp : preset.smtp;
  if (!imap || !imap.host || !smtp || !smtp.host) throw new Error('Enter both IMAP and SMTP server names.');
  return {
    provider: input.provider in PRESETS ? input.provider : 'custom',
    name: String(input.name || '').trim(),
    email,
    user: String(input.user || '').trim() || email,
    password: String(input.password),
    imap: { host: String(imap.host).trim(), port: Number(imap.port) || 993, secure: !!imap.secure },
    smtp: { host: String(smtp.host).trim(), port: Number(smtp.port) || 465, secure: !!smtp.secure },
    savesSentAutomatically: !!preset.savesSentAutomatically && input.provider !== 'custom'
  };
}

handle('account:presets', () => Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, { label: v.label, help: v.help, imap: v.imap, smtp: v.smtp }])));
handle('account:get', () => publicAccount(account));
handle('account:signIn', async input => {
  const acc = validateAccount(input);
  await MailClient.verify(acc);
  saveAccount(acc);
  await startClient(acc);
  return publicAccount(acc);
});
handle('account:signOut', async () => {
  if (client) { client.removeAllListeners(); await client.close(); }
  client = null; account = null;
  try { fs.unlinkSync(configPath()); } catch { /* already gone */ }
  return true;
});

handle('mail:folders', () => needClient().listFolders());
handle('mail:list', (folder, page) => needClient().listMessages(folder, page || 0));
handle('mail:search', (folder, query) => needClient().search(folder, query));
handle('mail:get', (folder, uid) => needClient().getMessage(folder, uid));
handle('mail:flag', (folder, uid, flag, on) => {
  if (!['\\Seen', '\\Flagged'].includes(flag)) throw new Error('Unsupported flag');
  return needClient().setFlag(folder, uid, flag, on);
});
handle('mail:delete', (folder, uid) => needClient().remove(folder, uid));
handle('mail:archive', (folder, uid) => needClient().archive(folder, uid));
handle('mail:move', (folder, uid, target) => needClient().move(folder, uid, target));
handle('mail:send', mail => needClient().send(mail));
handle('mail:saveDraft', mail => needClient().saveDraft(mail));

handle('mail:saveAttachment', async (folder, uid, index) => {
  const att = needClient().getAttachment(folder, uid, index);
  if (!att) throw new Error('Attachment no longer available, reopen the message.');
  const safeName = path.basename(att.filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'attachment';
  const res = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), safeName) });
  if (res.canceled || !res.filePath) return false;
  fs.writeFileSync(res.filePath, att.content);
  shell.showItemInFolder(res.filePath);
  return true;
});

handle('dialog:pickFiles', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] });
  if (res.canceled) return [];
  return res.filePaths.map(p => ({ path: p, name: path.basename(p), size: fs.statSync(p).size }));
});

handle('shell:openExternal', url => {
  if (/^(https?:|mailto:)/i.test(String(url))) shell.openExternal(String(url));
  return true;
});

// ---------- window ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 560,
    title: 'Mail',
    backgroundColor: '#14161b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Links clicked inside emails open in the real browser, never inside the app.
  const openOutside = url => { if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url); };
  win.webContents.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { e.preventDefault(); openOutside(url); });
  win.webContents.on('will-frame-navigate', e => {
    if (!e.isMainFrame && !/^about:/.test(e.url)) { e.preventDefault(); openOutside(e.url); }
  });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  const saved = loadAccount();
  if (saved) await startClient(saved);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', async () => {
  if (client) await client.close();
  if (process.platform !== 'darwin') app.quit();
});
