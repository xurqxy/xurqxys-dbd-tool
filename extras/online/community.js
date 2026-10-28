'use strict';
/* global S, t, esc, svgIcon, emblem, toast, render, save, $, $$, IDX, charName, MODES, plural, unlockedCount, modal, pct */
// Community page: Discord login, leaderboards and anonymous community stats (Supabase).

const O = { status: null, metric: 'spins', board: null, me: null, community: null, days: 7, loading: false, error: null };

// ---------- Anonymous spin stats (batched) ----------
let spinQueue = [];
function queueSpin(role, character, mode) {
  if (!O.status?.configured || S.settings.shareStats === false || !character) return;
  spinQueue.push({ role, character, mode: mode || 'standard' });
}
async function flushSpins() {
  if (!spinQueue.length) return;
  const counts = new Map();
  for (const s of spinQueue.splice(0)) {
    const key = `${s.role}|${s.character}|${s.mode}`;
    counts.set(key, Math.min(20, (counts.get(key) || 0) + 1));
  }
  const items = [...counts].map(([k, count]) => { const [role, character, mode] = k.split('|'); return { role, character, mode, count }; });
  await window.api.online.spins(items.slice(0, 100));
}

// ---------- Leaderboard progress ----------
let lastSubmitted = '';
async function syncProgress() {
  if (!O.status?.user) return;
  const payload = { spins: S.progress.spins, achievements: unlockedCount(), days: S.progress.days.length };
  const key = JSON.stringify(payload);
  if (key === lastSubmitted) return;
  const r = await window.api.online.submit(payload);
  if (r.ok) { lastSubmitted = key; O.me = r.data; }
}

async function initOnline() {
  const r = await window.api.online.status();
  O.status = r.ok ? r.data : { configured: false };
  if (!O.status.configured) return;
  syncProgress();
  setInterval(() => { flushSpins(); syncProgress(); }, 60_000);
  window.addEventListener('beforeunload', () => { flushSpins(); });
}

async function loadCommunityData() {
  if (!O.status?.configured) return;
  O.loading = true;
  const [board, community, me] = await Promise.all([
    window.api.online.leaderboard(O.metric),
    window.api.online.community(O.days),
    O.status.user ? window.api.online.me() : Promise.resolve({ ok: true, data: null }),
  ]);
  O.loading = false;
  O.error = [board, community, me].find((x) => !x.ok)?.error || null;
  if (board.ok) O.board = board.data;
  if (community.ok) O.community = community.data;
  if (me.ok) O.me = me.data;
  if (S.view === 'community') render();
}

// ---------- Page ----------
const METRIC_LABELS = { spins: 'Spins', achievements: 'Achievements', days: 'Days active' };
const metricValue = (row) => (O.metric === 'achievements' ? row.achievements : O.metric === 'days' ? row.days_active : row.spins);
const discordIcon = (size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.1-.8-9.5-3.6-13.6zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>`;
const avatar = (url, name, size = 32) => (url
  ? `<img class="avatar" src="${esc(url)}" width="${size}" height="${size}" alt="" referrerpolicy="no-referrer">`
  : `<span class="avatar avatar-fallback" style="width:${size}px;height:${size}px">${esc((name || '?').slice(0, 1).toUpperCase())}</span>`);

function renderCommunity(root) {
  if (!O.status?.configured) {
    root.innerHTML = `<div class="page">
      <div class="page-head"><div><div class="eyebrow">${t('Community')}</div><h1>${t('Community')}</h1></div></div>
      <div class="glass empty"><div class="e-ico">${svgIcon('globe', 28)}</div><b>${t('Online features are not set up in this version')}</b>
        <div>${t('Leaderboards and community stats need an online database. The developer can switch them on in a future update.')}</div></div>
    </div>`;
    return;
  }
  if (!O.board && !O.loading) loadCommunityData();
  const user = O.status.user;
  const rows = O.board || [];
  const myIndex = user ? rows.findIndex((r) => r.id === user.id) : -1;
  const list = (items, role) => {
    if (!items?.length) return `<p class="muted small">${t('No spins yet in this period. Be the first!')}</p>`;
    const max = Math.max(...items.map((i) => Number(i.spins)));
    return items.slice(0, 8).map((i) => {
      const c = IDX.char[i.character_id] || { role, name: i.character_id };
      return `<div class="cm-row">${emblem(c, 28)}<span class="cm-name">${esc(c.name)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(Number(i.spins) / max) * 100}%"></div></div><span class="num small">${Number(i.spins).toLocaleString()}</span></div>`;
    }).join('');
  };
  const modes = (O.community?.modes || []).filter((m) => MODES[m.mode]);
  const modeMax = Math.max(1, ...modes.map((m) => Number(m.spins)));

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">${t('Community')}</div><h1>${t('Leaderboard & community')}</h1></div>
      <div class="seg">${[7, 30].map((d) => `<button data-days="${d}" class="${O.days === d ? 'on' : ''}">${t('{n} days', { n: d })}</button>`).join('')}</div>
    </div>
    ${O.error ? `<div class="note" style="margin-bottom:14px">${svgIcon('info', 15)}<span>${esc(t("Couldn't reach the server: {error}", { error: O.error }))}</span></div>` : ''}
    <div class="glass panel account-card">
      ${user ? `
        <div class="row" style="flex-wrap:nowrap">${avatar(user.avatar, user.name, 44)}<div><b>${esc(user.name)}</b>
          <div class="muted small">${myIndex >= 0 ? t('Rank #{n} in {metric}', { n: myIndex + 1, metric: t(METRIC_LABELS[O.metric]) }) : t('Logged in with Discord')}</div></div></div>
        <div class="row">
          <label class="switch" style="padding:0;gap:10px"><span class="sw-text">${t('Show me on the leaderboard')}</span><input type="checkbox" id="on-visible" ${O.me?.show_on_leaderboard !== false ? 'checked' : ''}></label>
          <button class="btn ghost" id="on-logout">${t('Log out')}</button>
          <button class="btn ghost danger" id="on-delete">${t('Delete account')}</button>
        </div>`
      : `
        <div><b>${t('Join the leaderboard')}</b><div class="muted small">${t('Log in with Discord to show your spins, achievements and active days. Only your Discord name and picture are shown.')}</div></div>
        <button class="btn discord-btn" id="on-login">${discordIcon(18)}${t('Log in with Discord')}</button>`}
    </div>
    <div class="grid-2" style="margin-top:18px;align-items:start">
      <div class="glass panel">
        <div class="row" style="margin-bottom:12px"><h2 style="margin:0">🏆 ${t('Leaderboard')}</h2><span class="spacer"></span>
          <div class="seg">${Object.entries(METRIC_LABELS).map(([k, l]) => `<button data-metric="${k}" class="${O.metric === k ? 'on' : ''}">${t(l)}</button>`).join('')}</div></div>
        ${O.loading && !O.board ? '<div class="empty"><span class="spinner"></span></div>' : rows.length ? `<div class="lb">${rows.slice(0, 50).map((r, i) => `
          <div class="lb-row ${user && r.id === user.id ? 'me' : ''}">
            <span class="lb-rank">${i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}</span>${avatar(r.avatar_url, r.display_name, 28)}
            <span class="lb-name">${esc(r.display_name)}</span><span class="lb-val num">${Number(metricValue(r)).toLocaleString()}</span>
          </div>`).join('')}</div>` : `<p class="muted small">${t('Nobody on the leaderboard yet. Log in to be the first!')}</p>`}
        <p class="muted tiny" style="margin-top:12px">${t("Leaderboards only count things the tool can see itself (spins, achievements, days used), so they can't be faked by typing in wins.")}</p>
      </div>
      <div class="stack">
        <div class="glass panel"><h2>${t('Most rolled killers')}</h2>${list(O.community?.killers, 'killer')}</div>
        <div class="glass panel"><h2>${t('Most rolled survivors')}</h2>${list(O.community?.survivors, 'survivor')}</div>
        <div class="glass panel"><h2>${t('Most played challenge modes')}</h2>${modes.length ? modes.map((m) => `<div class="cm-row no-ico"><span class="cm-name">${esc(t(MODES[m.mode].label))}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(Number(m.spins) / modeMax) * 100}%"></div></div><span class="num small">${Number(m.spins).toLocaleString()}</span></div>`).join('') : `<p class="muted small">${t('No spins yet in this period. Be the first!')}</p>`}</div>
        <label class="switch glass panel" style="padding:12px 16px"><span class="sw-text">${t('Share my spins anonymously')}<small>${t('Adds your spins to these community stats. No name or ID is sent.')}</small></span><input type="checkbox" id="on-share" ${S.settings.shareStats !== false ? 'checked' : ''}></label>
      </div>
    </div>
  </div>`;

  $$('[data-days]', root).forEach((b) => b.onclick = () => { O.days = Number(b.dataset.days); O.board = null; loadCommunityData(); render(); });
  $$('[data-metric]', root).forEach((b) => b.onclick = () => { O.metric = b.dataset.metric; O.board = null; loadCommunityData(); render(); });
  $('#on-share', root).onchange = async (e) => { S.settings.shareStats = e.target.checked; await save('settings'); };
  $('#on-login', root)?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.innerHTML = `<span class="spinner"></span>${t('Finish logging in in your browser…')}`;
    const r = await window.api.online.login();
    if (r.ok) {
      O.status.user = r.user;
      toast(t('Logged in as {name}', { name: r.user.name }));
      lastSubmitted = '';
      await syncProgress();
    } else {
      toast(t('Login failed: {error}', { error: r.error }));
    }
    O.board = null;
    loadCommunityData();
    render();
  });
  $('#on-logout', root)?.addEventListener('click', async () => {
    await window.api.online.logout();
    O.status.user = null;
    O.me = null;
    render();
  });
  $('#on-visible', root)?.addEventListener('change', async (e) => {
    const r = await window.api.online.visibility(e.target.checked);
    if (!r.ok) toast(r.error);
    O.board = null;
    loadCommunityData();
  });
  $('#on-delete', root)?.addEventListener('click', () => {
    modal(`<h2>${t('Delete your account?')}</h2>
      <p class="muted small">${t('This removes your leaderboard entry and your login from the server. Your matches and builds on this PC are not touched.')}</p>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn danger" id="del-yes">${t('Delete account')}</button></div>`, (m, close) => {
      $('#del-yes', m).onclick = async () => {
        const r = await window.api.online.deleteAccount();
        close();
        if (!r.ok) { toast(r.error); return; }
        O.status.user = null;
        O.me = null;
        O.board = null;
        toast(t('Your account was deleted'));
        loadCommunityData();
        render();
      };
    });
  });
}
