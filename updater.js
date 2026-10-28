'use strict';
// One-click updates from GitHub Releases.
// - Portable .exe: download the new exe next to the old one, then a small helper script waits for the
//   app to close, swaps the file and starts it again (a running exe can't overwrite itself on Windows).
// - Installed copy (NSIS): download the new Setup.exe and run it silently; it restarts the app when done.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { app, net } = require('electron');

// XURQXYS_UPDATE_API points the updater at a test server instead of api.github.com.
const API = process.env.XURQXYS_UPDATE_API || 'https://api.github.com';
const UA = { 'User-Agent': 'XurqxysDBDTool', Accept: 'application/vnd.github+json' };

const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

function installKind() {
  if (process.env.PORTABLE_EXECUTABLE_FILE) return 'portable';
  if (app.isPackaged && process.platform === 'win32') return 'installed';
  return 'manual'; // dev builds and other platforms: open the release page instead
}

let latest = null;

async function check(repo) {
  if (!repo) return { ok: false, error: 'No repository configured' };
  try {
    const res = await net.fetch(`${API}/repos/${repo}/releases/latest`, { headers: UA });
    if (res.status === 404) return { ok: true, available: false, current: app.getVersion(), kind: installKind() };
    if (!res.ok) return { ok: false, error: `GitHub returned HTTP ${res.status}` };
    const rel = await res.json();
    const assets = rel.assets || [];
    latest = {
      version: String(rel.tag_name || '').replace(/^v/, ''),
      url: rel.html_url,
      portable: assets.find((a) => /^XurqxysDBDTool-[\d.]+\.exe$/i.test(a.name)),
      setup: assets.find((a) => /-Setup\.exe$/i.test(a.name)),
    };
    const kind = installKind();
    const asset = kind === 'portable' ? latest.portable : kind === 'installed' ? latest.setup : null;
    return {
      ok: true, current: app.getVersion(), latest: rel.tag_name, url: rel.html_url, kind,
      available: newer(rel.tag_name || '0', app.getVersion()), oneClick: !!asset, size: asset?.size || 0,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function download(asset, dest, onProgress) {
  const res = await net.fetch(asset.browser_download_url, { headers: { 'User-Agent': 'XurqxysDBDTool' } });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || asset.size || 0;
  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  let done = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    done += value.length;
    if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
    onProgress({ done, total });
  }
  await new Promise((r, j) => out.end((err) => (err ? j(err) : r())));
  if (asset.size && fs.statSync(tmp).size !== asset.size) throw new Error('Download was incomplete. Please try again.');
  fs.renameSync(tmp, dest);
}

function writable(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
}

// Downloads and installs the latest release, then quits. Returns { ok, error? } if it can't.
async function install(onProgress) {
  if (!latest) return { ok: false, error: 'Check for updates first' };
  const kind = installKind();

  if (kind === 'portable' && latest.portable) {
    const current = process.env.PORTABLE_EXECUTABLE_FILE;
    const dir = writable(path.dirname(current)) ? path.dirname(current) : os.tmpdir();
    const next = path.join(dir, `.xurqxys-update-${latest.version}.exe`);
    await download(latest.portable, next, onProgress);
    // Helper: wait until the old exe is unlocked, replace it (same name, so shortcuts keep working), start it.
    const script = path.join(os.tmpdir(), `xurqxys-update-${Date.now()}.cmd`);
    fs.writeFileSync(script, [
      '@echo off',
      'set tries=0',
      ':retry',
      // ping is the delay that works without a console window (timeout.exe fails there)
      'ping -n 2 127.0.0.1 >nul',
      `move /y "${next}" "${current}" >nul 2>&1`,
      'if not errorlevel 1 goto done',
      'set /a tries+=1',
      'if %tries% lss 60 goto retry',
      `start "" "${next}"`,
      'goto end',
      ':done',
      `start "" "${current}"`,
      ':end',
      'del "%~f0"',
    ].join('\r\n'));
    spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
    setTimeout(() => app.quit(), 300);
    return { ok: true };
  }

  if (kind === 'installed' && latest.setup) {
    const setup = path.join(os.tmpdir(), latest.setup.name);
    await download(latest.setup, setup, onProgress);
    // /S = silent, --force-run = start the app again when the installer finishes.
    spawn(setup, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    setTimeout(() => app.quit(), 300);
    return { ok: true };
  }

  return { ok: false, manual: true, url: latest.url };
}

module.exports = { check, install, installKind, newer, _download: download };
