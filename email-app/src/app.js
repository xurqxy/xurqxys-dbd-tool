'use strict';
/* global mail */

const $ = id => document.getElementById(id);
const state = {
  presets: {},
  account: null,
  folders: [],
  folder: 'INBOX',
  page: 0,
  messages: [],
  searchQuery: '',
  current: null,      // full open message
  showImages: false,
  compose: { files: [], replyTo: null }
};

// ---------- helpers ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtAddr(a) { return a ? (a.name ? `${a.name} <${a.address}>` : a.address) : ''; }
function shortName(list) { const a = (list || [])[0]; return a ? (a.name || a.address) : '(unknown)'; }
function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function fmtDate(iso, long) {
  const d = new Date(iso), now = new Date();
  if (long) return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return d.toLocaleDateString();
}
let toastTimer;
function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg; t.classList.toggle('err', !!isErr); t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), isErr ? 6000 : 2500);
}
async function call(promise, { quiet } = {}) {
  const res = await promise;
  if (!res.ok) { if (!quiet) toast(res.error, true); throw new Error(res.error); }
  return res.data;
}

// ---------- sign in ----------
function fillPresetFields() {
  const key = $('lf-provider').value;
  const p = state.presets[key];
  $('lf-help').textContent = p ? p.help : '';
  $('lf-custom').classList.toggle('hidden', key !== 'custom');
}

async function showLogin() {
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
  if (!Object.keys(state.presets).length) {
    state.presets = await call(mail.presets());
    $('lf-provider').innerHTML = Object.entries(state.presets).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  }
  fillPresetFields();
  $('lf-email').focus();
}

$('lf-provider').addEventListener('change', fillPresetFields);
$('lf-email').addEventListener('blur', () => {
  // Pick the provider automatically from the address.
  const dom = ($('lf-email').value.split('@')[1] || '').toLowerCase();
  const guess = /^(gmail|googlemail)\.com$/.test(dom) ? 'gmail'
    : /^(yahoo|ymail)\./.test(dom) ? 'yahoo'
    : /^(icloud|me|mac)\.com$/.test(dom) ? 'icloud'
    : /^(outlook|hotmail|live|msn)\./.test(dom) ? 'outlook' : null;
  if (guess && $('lf-provider').value !== guess) { $('lf-provider').value = guess; fillPresetFields(); }
});
['imap', 'smtp'].forEach(k => {
  $(`lf-${k}-port`).addEventListener('change', e => {
    const port = Number(e.target.value);
    if (port === 993 || port === 465) $(`lf-${k}-secure`).checked = true;
    if (port === 143 || port === 587 || port === 25) $(`lf-${k}-secure`).checked = false;
  });
});

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('lf-submit'), err = $('lf-error');
  err.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Connecting…';
  const input = {
    provider: $('lf-provider').value,
    name: $('lf-name').value,
    email: $('lf-email').value,
    password: $('lf-password').value,
    user: $('lf-user').value,
    imap: { host: $('lf-imap-host').value, port: $('lf-imap-port').value, secure: $('lf-imap-secure').checked },
    smtp: { host: $('lf-smtp-host').value, port: $('lf-smtp-port').value, secure: $('lf-smtp-secure').checked }
  };
  const res = await mail.signIn(input);
  btn.disabled = false; btn.textContent = 'Sign in';
  if (!res.ok) { err.textContent = res.error; err.classList.remove('hidden'); return; }
  $('lf-password').value = '';
  state.account = res.data;
  startApp();
});

$('btn-signout').addEventListener('click', async () => {
  if (!confirm('Sign out and remove this account from this computer?')) return;
  await call(mail.signOut());
  state.account = null; state.current = null; state.messages = [];
  showLogin();
});

// ---------- folders ----------
const FOLDER_ICONS = { '\\Inbox': '📥', '\\Sent': '📤', '\\Drafts': '📝', '\\Trash': '🗑', '\\Junk': '⚠', '\\Archive': '🗄', '\\Flagged': '⭐', '\\All': '📚', '\\Important': '❗' };

async function loadFolders() {
  state.folders = await call(mail.folders());
  if (!state.folders.find(f => f.path === state.folder)) state.folder = (state.folders[0] || {}).path || 'INBOX';
  renderFolders();
}

function renderFolders() {
  $('folders').innerHTML = state.folders.map(f => `
    <a class="folder ${f.path === state.folder ? 'active' : ''}" data-path="${esc(f.path)}" title="${esc(f.path)}">
      <span><span class="ico">${FOLDER_ICONS[f.specialUse] || '📁'}</span>${esc(f.name)}</span>
      ${f.unseen ? `<span class="count">${f.unseen}</span>` : ''}
    </a>`).join('');
}

$('folders').addEventListener('click', e => {
  const a = e.target.closest('.folder');
  if (!a) return;
  state.folder = a.dataset.path;
  state.searchQuery = ''; $('search').value = '';
  renderFolders();
  loadMessages();
});

function folderInfo(path) { return state.folders.find(f => f.path === path) || { name: path, path }; }

// ---------- message list ----------
let listToken = 0;
async function loadMessages({ append = false, keepSelection = false } = {}) {
  const token = ++listToken;
  if (!append) {
    state.page = 0;
    if (!keepSelection) $('messages').innerHTML = '<li class="note">Loading…</li>';
  }
  $('list-title').textContent = state.searchQuery ? `Search: “${state.searchQuery}”` : folderInfo(state.folder).name;
  try {
    const res = state.searchQuery
      ? await call(mail.search(state.folder, state.searchQuery))
      : await call(mail.list(state.folder, state.page));
    if (token !== listToken) return;
    state.messages = append ? state.messages.concat(res.messages) : res.messages;
    $('btn-more').classList.toggle('hidden', !res.hasMore);
    renderMessages();
  } catch (e) {
    if (token === listToken) $('messages').innerHTML = `<li class="note">Could not load messages.<br>${esc(e.message)}</li>`;
  }
}

function renderMessages() {
  if (!state.messages.length) {
    $('messages').innerHTML = `<li class="note">${state.searchQuery ? 'No messages match your search.' : 'This folder is empty.'}</li>`;
    return;
  }
  const isSentLike = ['\\Sent', '\\Drafts'].includes(folderInfo(state.folder).specialUse);
  const cur = state.current && state.current.folder === state.folder ? state.current.uid : null;
  $('messages').innerHTML = state.messages.map(m => `
    <li class="msg ${m.seen ? '' : 'unread'} ${m.uid === cur ? 'active' : ''}" data-uid="${m.uid}">
      <div class="top">
        <span class="from">${esc(isSentLike ? 'To: ' + shortName(m.to) : shortName(m.from))}</span>
        <span class="date">${esc(fmtDate(m.date))}</span>
      </div>
      <div class="subject">${esc(m.subject)}<span class="badges">${m.flagged ? ' ⭐' : ''}${m.hasAttachments ? ' 📎' : ''}</span></div>
    </li>`).join('');
}

$('messages').addEventListener('click', e => {
  const li = e.target.closest('.msg');
  if (li) openMessage(Number(li.dataset.uid));
});
$('btn-more').addEventListener('click', () => { state.page++; loadMessages({ append: true }); });
$('btn-refresh').addEventListener('click', refresh);

let searchTimer;
$('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.searchQuery = $('search').value.trim(); loadMessages(); }, 400);
});

async function refresh() {
  await Promise.all([loadFolders().catch(() => {}), loadMessages({ keepSelection: true })]);
}

// ---------- reading ----------
async function openMessage(uid) {
  const folder = state.folder;
  document.querySelectorAll('.msg').forEach(li => li.classList.toggle('active', Number(li.dataset.uid) === uid));
  const summary = state.messages.find(m => m.uid === uid);
  let msg;
  try { msg = await call(mail.get(folder, uid)); } catch { return; }
  if (state.folder !== folder) return;
  state.current = msg;
  state.showImages = false;
  if (summary && !summary.seen) {
    summary.seen = true; renderMessages();
    const f = folderInfo(folder); if (f.unseen) { f.unseen--; renderFolders(); }
  }
  renderReader();
}

function hasRemoteImages(html) {
  return /<img[^>]+src\s*=\s*["']?\s*(https?:)?\/\//i.test(html) || /url\(\s*["']?\s*(https?:)?\/\//i.test(html) || /background\s*=\s*["']?https?:/i.test(html);
}

function buildBodyDoc(msg, allowImages) {
  const imgSrc = allowImages ? 'data: cid: https: http:' : 'data: cid:';
  const csp = `default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; font-src data:`;
  const content = msg.html
    ? msg.html
    : `<pre style="white-space:pre-wrap;word-wrap:break-word;font:14px/1.5 'Segoe UI',system-ui,sans-serif;margin:0">${linkify(esc(msg.text))}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <base target="_blank">
    <style>html,body{margin:0;padding:12px;background:#fff;color:#111;font:14px/1.5 'Segoe UI',system-ui,sans-serif;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{border-left:3px solid #ccc;margin:0 0 0 4px;padding-left:10px;color:#555}</style>
    </head><body>${content}</body></html>`;
}

function linkify(escaped) {
  return escaped.replace(/\bhttps?:\/\/[^\s<>"']+/g, u => `<a href="${u}">${u}</a>`);
}

function renderReader() {
  const m = state.current;
  if (!m) { $('reader-msg').classList.add('hidden'); $('reader-empty').classList.remove('hidden'); return; }
  $('reader-empty').classList.add('hidden');
  $('reader-msg').classList.remove('hidden');
  $('r-subject').textContent = m.subject;
  const from = m.from[0] || {};
  $('r-from').textContent = from.name || from.address || '(unknown sender)';
  $('r-from-addr').textContent = from.name ? `<${from.address}>` : '';
  $('r-to').textContent = m.to.map(fmtAddr).join(', ') || '—';
  $('r-cc').textContent = m.cc.map(fmtAddr).join(', ');
  $('r-cc-wrap').classList.toggle('hidden', !m.cc.length);
  $('r-date').textContent = fmtDate(m.date, true);
  $('btn-flag').textContent = m.flagged ? '★' : '☆';
  $('r-images').classList.toggle('hidden', !(m.html && hasRemoteImages(m.html)) || state.showImages);
  $('r-attachments').innerHTML = m.attachments.map(a =>
    `<button data-att="${a.index}" title="Save ${esc(a.filename)}">📎 ${esc(a.filename)} <span class="muted">(${fmtSize(a.size)})</span></button>`).join('');
  $('r-body').srcdoc = buildBodyDoc(m, state.showImages);
}

$('btn-images').addEventListener('click', () => { state.showImages = true; renderReader(); });
$('r-attachments').addEventListener('click', e => {
  const b = e.target.closest('[data-att]');
  if (b && state.current) call(mail.saveAttachment(state.current.folder, state.current.uid, Number(b.dataset.att))).catch(() => {});
});

function removeFromList(uid) {
  const idx = state.messages.findIndex(m => m.uid === uid);
  state.messages = state.messages.filter(m => m.uid !== uid);
  const next = state.messages[Math.min(idx, state.messages.length - 1)];
  state.current = null;
  renderMessages();
  renderReader();
  if (next) openMessage(next.uid);
}

document.querySelector('#reader-msg .toolbar').addEventListener('click', async e => {
  const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
  const m = state.current;
  if (!act || !m) return;
  try {
    if (act === 'reply' || act === 'replyAll' || act === 'forward') return openCompose(act, m);
    if (act === 'delete') { await call(mail.remove(m.folder, m.uid)); toast('Deleted'); removeFromList(m.uid); loadFolders().catch(() => {}); }
    if (act === 'archive') { await call(mail.archive(m.folder, m.uid)); toast('Archived'); removeFromList(m.uid); }
    if (act === 'flag') {
      m.flagged = !m.flagged;
      await call(mail.flag(m.folder, m.uid, '\\Flagged', m.flagged));
      const s = state.messages.find(x => x.uid === m.uid); if (s) s.flagged = m.flagged;
      renderMessages(); $('btn-flag').textContent = m.flagged ? '★' : '☆';
    }
    if (act === 'unread') {
      await call(mail.flag(m.folder, m.uid, '\\Seen', false));
      const s = state.messages.find(x => x.uid === m.uid); if (s) s.seen = false;
      state.current = null; renderMessages(); renderReader(); loadFolders().catch(() => {});
    }
  } catch { /* toast already shown */ }
});

// ---------- compose ----------
function quote(m) {
  const who = fmtAddr(m.from[0]);
  const body = (m.text || '').split('\n').map(l => '> ' + l).join('\n');
  return `\n\nOn ${fmtDate(m.date, true)}, ${who} wrote:\n${body}`;
}

function openCompose(mode, m) {
  const me = (state.account.email || '').toLowerCase();
  const c = state.compose = { files: [], replyTo: null, mode: mode || 'new' };
  let to = '', cc = '', subject = '', body = '';
  if (m && (mode === 'reply' || mode === 'replyAll')) {
    const replyTo = (m.replyTo.length ? m.replyTo : m.from);
    to = replyTo.map(fmtAddr).join(', ');
    if (mode === 'replyAll') {
      const seen = new Set(replyTo.map(a => a.address.toLowerCase()).concat(me));
      cc = m.to.concat(m.cc).filter(a => a.address && !seen.has(a.address.toLowerCase()) && seen.add(a.address.toLowerCase())).map(fmtAddr).join(', ');
    }
    subject = /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject;
    body = quote(m);
    c.replyTo = { inReplyTo: m.messageId, references: (m.references || []).concat(m.messageId ? [m.messageId] : []) };
  } else if (m && mode === 'forward') {
    subject = /^fwd?:/i.test(m.subject) ? m.subject : 'Fwd: ' + m.subject;
    body = `\n\n---------- Forwarded message ----------\nFrom: ${fmtAddr(m.from[0])}\nDate: ${fmtDate(m.date, true)}\nSubject: ${m.subject}\nTo: ${m.to.map(fmtAddr).join(', ')}\n\n${m.text || ''}`;
  }
  $('c-title').textContent = mode === 'forward' ? 'Forward' : (mode === 'reply' || mode === 'replyAll') ? 'Reply' : 'New email';
  $('c-to').value = to; $('c-cc').value = cc; $('c-bcc').value = ''; $('c-subject').value = subject; $('c-body').value = body;
  $('c-error').classList.add('hidden');
  renderFiles();
  c.initial = composeSnapshot();
  $('compose').classList.remove('hidden');
  if (to) { $('c-body').focus(); $('c-body').setSelectionRange(0, 0); } else $('c-to').focus();
}

function composeSnapshot() {
  return ['c-to', 'c-cc', 'c-bcc', 'c-subject', 'c-body'].map(id => $(id).value).join('\u0000') + state.compose.files.length;
}
function composeDirty() { return composeSnapshot() !== state.compose.initial; }

function closeCompose(force) {
  if (!force && composeDirty() && !confirm('Discard this email?')) return;
  $('compose').classList.add('hidden');
}

function renderFiles() {
  $('c-files').innerHTML = state.compose.files.map((f, i) =>
    `<span>📎 ${esc(f.name)} (${fmtSize(f.size)})<button data-rm="${i}" title="Remove">✕</button></span>`).join('');
}

function composeData() {
  return {
    to: $('c-to').value.trim(), cc: $('c-cc').value.trim(), bcc: $('c-bcc').value.trim(),
    subject: $('c-subject').value, text: $('c-body').value,
    attachments: state.compose.files.map(f => f.path),
    inReplyTo: state.compose.replyTo ? state.compose.replyTo.inReplyTo : undefined,
    references: state.compose.replyTo ? state.compose.replyTo.references : undefined
  };
}

const ADDR_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
function badAddresses(field) {
  return field.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    .map(s => (s.match(/<([^>]+)>/) || [null, s])[1].trim())
    .filter(a => !ADDR_RE.test(a));
}

async function send() {
  const d = composeData();
  const err = $('c-error');
  const showErr = msg => { err.textContent = msg; err.classList.remove('hidden'); };
  if (!d.to && !d.cc && !d.bcc) return showErr('Add at least one recipient.');
  const bad = [d.to, d.cc, d.bcc].flatMap(badAddresses);
  if (bad.length) return showErr('Not a valid email address: ' + bad.join(', '));
  if (!d.subject.trim() && !confirm('Send without a subject?')) return;
  const btn = $('c-send');
  btn.disabled = true; btn.textContent = 'Sending…';
  const res = await mail.send(d);
  btn.disabled = false; btn.textContent = 'Send';
  if (!res.ok) return showErr(res.error);
  closeCompose(true);
  toast('Email sent ✓');
  if (['\\Sent'].includes(folderInfo(state.folder).specialUse)) loadMessages();
}

$('btn-compose').addEventListener('click', () => openCompose('new'));
$('c-close').addEventListener('click', () => closeCompose());
$('c-send').addEventListener('click', send);
$('c-attach').addEventListener('click', async () => {
  const files = await call(mail.pickFiles()).catch(() => []);
  state.compose.files.push(...files);
  const total = state.compose.files.reduce((s, f) => s + f.size, 0);
  if (total > 20 * 1048576) toast('Heads up: most providers reject emails over ~20–25 MB.', true);
  renderFiles();
});
$('c-files').addEventListener('click', e => {
  const b = e.target.closest('[data-rm]');
  if (b) { state.compose.files.splice(Number(b.dataset.rm), 1); renderFiles(); }
});
$('c-draft').addEventListener('click', async () => {
  try { await call(mail.saveDraft(composeData())); closeCompose(true); toast('Draft saved'); } catch { /* toast shown */ }
});

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  const composing = !$('compose').classList.contains('hidden');
  if (composing) {
    if (e.key === 'Escape') closeCompose();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
    return;
  }
  if ($('app').classList.contains('hidden')) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.key === 'F5') { e.preventDefault(); refresh(); }
  if (typing) return;
  if (e.key === 'Delete' && state.current) document.querySelector('[data-act="delete"]').click();
  if (e.key === 'n' || e.key === 'c') { e.preventDefault(); openCompose('new'); }
  if (e.key === 'r' && state.current) { e.preventDefault(); openCompose('reply', state.current); }
  if (e.key === '/') { e.preventDefault(); $('search').focus(); }
  if (e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const i = state.current ? state.messages.findIndex(m => m.uid === state.current.uid) : -1;
    const next = state.messages[(e.key === 'j' || e.key === 'ArrowDown') ? i + 1 : Math.max(0, i - 1)];
    if (next) { e.preventDefault(); openMessage(next.uid); }
  }
});

// ---------- live updates ----------
mail.onEvent(ev => {
  if (ev.type === 'new-mail') {
    loadFolders().catch(() => {});
    if (ev.folder === state.folder && !state.searchQuery && state.page === 0) loadMessages({ keepSelection: true });
  }
});
// Fallback poll in case the server doesn't push (every 2 minutes).
setInterval(() => { if (state.account && document.visibilityState === 'visible') refresh(); }, 120000);

// ---------- start ----------
async function startApp() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('acct-email').textContent = state.account.email;
  $('acct-email').title = state.account.email;
  state.folder = 'INBOX'; state.current = null;
  renderReader();
  try { await loadFolders(); } catch { /* toast shown */ }
  loadMessages();
}

(async () => {
  const res = await mail.getAccount();
  state.presets = await call(mail.presets());
  $('lf-provider').innerHTML = Object.entries(state.presets).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  if (res.ok && res.data) { state.account = res.data; startApp(); } else showLogin();
})();
