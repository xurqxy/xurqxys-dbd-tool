'use strict';
// Online features on Supabase: Discord login, leaderboard, anonymous community stats.
// Only the project URL and the public "anon" key live in the app (online.config.json);
// the database functions in supabase/schema.sql do all checking server-side.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { net, shell } = require('electron');

const CALLBACK_PORT = 7374;
const CALLBACK_PATH = '/auth/callback';
const REDIRECT = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`;

function loadConfig() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(path.join(__dirname, 'online.config.json'), 'utf8')); } catch { /* no config */ }
  return {
    url: (process.env.XURQXYS_SUPABASE_URL || file.url || '').replace(/\/+$/, ''),
    anonKey: process.env.XURQXYS_SUPABASE_KEY || file.anonKey || '',
  };
}
const cfg = loadConfig();
const configured = () => !!(cfg.url && cfg.anonKey);

let store;      // { get(), set(session) } supplied by main.js
let pendingLogin = null;

function init(sessionStore) { store = sessionStore; }

async function request(pathname, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await net.fetch(`${cfg.url}${pathname}`, {
    method,
    // Newer "publishable" keys aren't JWTs, so the key only goes in apikey; Authorization is for a logged-in user.
    headers: { apikey: cfg.anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new Error(json?.msg || json?.message || json?.error_description || json?.error || `Server returned HTTP ${res.status}`);
  return json;
}

function profileFromUser(user) {
  const m = user?.user_metadata || {};
  return {
    id: user?.id,
    name: m.custom_claims?.global_name || m.full_name || m.name || m.user_name || 'Player',
    avatar: m.avatar_url || m.picture || null,
  };
}

function saveSession(data) {
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: profileFromUser(data.user),
  };
  store.set(session);
  return session;
}

// Returns a valid session, refreshing the access token when it is about to expire.
async function session() {
  const s = store.get();
  if (!s) return null;
  if (s.expires_at - Date.now() > 60_000) return s;
  try {
    return saveSession(await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } }));
  } catch {
    store.set(null);
    return null;
  }
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const PAGE = (title, text) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#07060a;color:#f1edf7;font:16px system-ui,sans-serif">
<div style="text-align:center"><div style="font-size:42px">${title.includes('✓') ? '✅' : '⚠️'}</div><h2>${title}</h2><p style="color:#b8b0c6">${text}</p></div>`;

// Discord login with PKCE: the browser does the login, Supabase redirects back to a one-shot local server.
function login() {
  if (!configured()) return Promise.resolve({ ok: false, error: 'Online features are not set up in this build' });
  if (pendingLogin) return pendingLogin;
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  pendingLogin = new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      server.close();
      pendingLogin = null;
      resolve(result);
    };
    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== CALLBACK_PATH) { res.writeHead(404); res.end(); return; }
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error_description') || u.searchParams.get('error');
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(PAGE('Login failed', err || 'No login code received. Close this tab and try again.'));
        finish({ ok: false, error: err || 'No login code received' });
        return;
      }
      try {
        const data = await request('/auth/v1/token?grant_type=pkce', { method: 'POST', body: { auth_code: code, code_verifier: verifier } });
        const s = saveSession(data);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(PAGE('Logged in ✓', `Welcome, ${s.user.name.replace(/[<>&]/g, '')}! You can close this tab and go back to Xurqxys DBD Tool.`));
        finish({ ok: true, user: s.user });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(PAGE('Login failed', e.message.replace(/[<>&]/g, '')));
        finish({ ok: false, error: e.message });
      }
    });
    server.on('error', (e) => finish({ ok: false, error: e.code === 'EADDRINUSE' ? `Port ${CALLBACK_PORT} is in use by another program` : e.message }));
    const timer = setTimeout(() => finish({ ok: false, error: 'Login timed out' }), 5 * 60_000);
    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      const q = new URLSearchParams({ provider: 'discord', redirect_to: REDIRECT, code_challenge: challenge, code_challenge_method: 's256' });
      shell.openExternal(`${cfg.url}/auth/v1/authorize?${q}`);
    });
  });
  return pendingLogin;
}

async function logout() {
  const s = store.get();
  if (s) { try { await request('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch { /* already invalid */ } }
  store.set(null);
  return true;
}

async function status() {
  if (!configured()) return { configured: false };
  const s = await session();
  return { configured: true, user: s?.user || null };
}

async function rpc(fn, args, { auth = false } = {}) {
  const s = auth ? await session() : null;
  if (auth && !s) throw new Error('Please log in again');
  return request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args, token: s?.access_token });
}

async function submitProgress({ spins, achievements, days }) {
  const s = await session();
  if (!s) return null;
  return rpc('submit_progress', { p_spins: spins, p_achievements: achievements, p_days: days, p_name: s.user.name, p_avatar: s.user.avatar }, { auth: true });
}

const METRICS = { spins: 'spins', achievements: 'achievements', days: 'days_active' };
async function leaderboard(metric = 'spins') {
  const col = METRICS[metric] || 'spins';
  const rows = await request(`/rest/v1/profiles?select=id,display_name,avatar_url,spins,achievements,days_active&show_on_leaderboard=eq.true&order=${col}.desc,updated_at.asc&limit=100`);
  return rows || [];
}

async function myProfile() {
  const s = await session();
  if (!s) return null;
  const rows = await request(`/rest/v1/profiles?select=id,display_name,spins,achievements,days_active,show_on_leaderboard&id=eq.${s.user.id}`, { token: s.access_token });
  return rows?.[0] || null;
}

const recordSpins = (items) => rpc('record_spins', { p_items: items });
const community = async (days = 7) => ({
  killers: await rpc('community_top', { p_role: 'killer', p_days: days }),
  survivors: await rpc('community_top', { p_role: 'survivor', p_days: days }),
  modes: await rpc('community_modes', { p_days: days }),
});
const setVisibility = (visible) => rpc('set_leaderboard_visibility', { p_visible: visible }, { auth: true });
async function deleteAccount() {
  await rpc('delete_my_account', {}, { auth: true });
  store.set(null);
  return true;
}

module.exports = { init, configured, status, login, logout, submitProgress, leaderboard, myProfile, recordSpins, community, setVisibility, deleteAccount, REDIRECT };
