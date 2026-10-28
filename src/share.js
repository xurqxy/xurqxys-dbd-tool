'use strict';
/* global S, R, IDX, t, esc, svgIcon, iconSrc, slugify, glyphFor, GLYPHS, charsOf, perkName, toast, copyText, openDrawer, drawerHead,
   closeDrawer, $, setRole, go, cap, modeLabel, MODES, track, initials */
// Shareable builds: short checked codes (XQ-…) and a PNG share card for Discord.

// ---------- Codes ----------
// Each slot is a 3-character hash of its id, so codes keep working when new perks are added.
const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const EMPTY = '000';

function h3(id) {
  let h = 0x811c9dc5;
  for (const ch of String(id)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  let n = (h % (36 ** 3 - 1)) + 1; // never 000, which means "empty"
  let out = '';
  for (let i = 0; i < 3; i++) { out = B36[n % 36] + out; n = Math.floor(n / 36); }
  return out;
}

const checksum = (body) => B36[[...body].reduce((a, c) => a + B36.indexOf(c) * 7 + 3, 0) % 36];

// build: { role, characterId, perks: [ids], item: name, addons: [names], offering: name }
function encodeBuild(b) {
  const slot = (v) => (v ? h3(v) : EMPTY);
  const body = (b.role === 'killer' ? 'K' : 'S') + slot(b.characterId) + [0, 1, 2, 3].map((i) => slot(b.perks?.[i])).join('')
    + slot(b.item && slugify(b.item)) + [0, 1].map((i) => slot(b.addons?.[i] && slugify(b.addons[i]))).join('') + slot(b.offering && slugify(b.offering));
  const full = body + checksum(body);
  return `XQ-${full.match(/.{1,5}/g).join('-')}`;
}

function decodeBuild(code) {
  const raw = String(code || '').toUpperCase().replace(/^XQ-?/, '').replace(/[^0-9A-Z]/g, '');
  if (raw.length !== 29) return { error: t('That code is incomplete. Build codes look like XQ-K1A2B-…') };
  const body = raw.slice(0, -1);
  if (checksum(body) !== raw.slice(-1)) return { error: t('That code has a typo. Check it and try again.') };
  const role = body[0] === 'K' ? 'killer' : body[0] === 'S' ? 'survivor' : null;
  if (!role) return { error: t('That code has a typo. Check it and try again.') };
  const parts = body.slice(1).match(/.{3}/g);
  const lookup = (hash, items, key = (x) => x) => (hash === EMPTY ? null : items.find((x) => h3(key(x)) === hash) || undefined);
  const missing = [];
  const char = lookup(parts[0], charsOf(role), (c) => c.id);
  if (char === undefined) missing.push(t(cap(role)));
  const perks = parts.slice(1, 5).map((p) => {
    const found = lookup(p, S.data.perks.filter((x) => x.role === role), (x) => x.id);
    if (found === undefined) missing.push(t('Perk'));
    return found?.id || '';
  });
  const items = S.data.items.flatMap((i) => i.variants.map((v) => ({ name: v, type: i.type })));
  const item = lookup(parts[5], items, (x) => slugify(x.name));
  const addonPool = role === 'killer' ? (char?.addons || []).map((a) => a.name) : (S.data.items.find((i) => i.type === item?.type)?.addons || []);
  const addons = parts.slice(6, 8).map((p) => lookup(p, addonPool, slugify)).filter(Boolean);
  const o = S.data.offerings;
  const offering = lookup(parts[8], [...(o[role] || []), ...(o.shared || [])], slugify);
  return { build: { role, characterId: char?.id || '', perks, item: item?.name || '', addons, offering: offering || '' }, missing };
}

// Loads a build exactly as shared and locks every slot, so Spin doesn't wipe it.
function applySharedBuild(b) {
  setRole(b.role);
  R.mode = 'standard';
  R.fixedChar[b.role] = '';
  const char = IDX.char[b.characterId] || charsOf(b.role)[0];
  const item = b.item ? { name: b.item, type: S.data.items.find((i) => i.variants.includes(b.item))?.type } : null;
  const addonInfo = (name) => (b.role === 'killer' ? (char.addons || []).find((a) => a.name === name) || { name } : { name });
  R.result = { role: b.role, char, perks: [0, 1, 2, 3].map((i) => b.perks[i] || null), item, addons: [0, 1].map((i) => (b.addons[i] ? addonInfo(b.addons[i]) : null)), offering: b.offering || null };
  R.locks = new Set(['char', 'perk0', 'perk1', 'perk2', 'perk3', 'item', 'addon0', 'addon1', 'offering']);
  R.revealed = new Set();
  go('randomizer');
}

// ---------- Share image ----------
const ROLE_COLORS = {
  killer: { main: '#ff3b5c', soft: '#ff8fa3', outer: '#4a0d1b', inner: '#2a0610', glyph: '#ffb3c1', deep: '#3a0712' },
  survivor: { main: '#38bdf8', soft: '#7dd3fc', outer: '#0c3550', inner: '#061c2b', glyph: '#bfe9ff', deep: '#082a40' },
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const glyphImage = (perk, color) => loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyphFor(perk.tags)] || GLYPHS.default}</svg>`)}`);

function diamondPath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
}

function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a) * 0.92, cy + r * Math.sin(a));
  }
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

async function renderShareCard(build) {
  await document.fonts.ready;
  const W = 1200;
  const H = 630;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const col = ROLE_COLORS[build.role];
  const char = IDX.char[build.characterId];

  // Background
  ctx.fillStyle = '#07060a';
  ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(220, 120, 10, 220, 120, 700);
  g.addColorStop(0, `${col.main}55`); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(1100, 600, 10, 1100, 600, 600);
  g.addColorStop(0, 'rgba(139,92,246,0.28)'); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // Header
  ctx.fillStyle = '#fff';
  ctx.font = '800 22px Oxanium, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('XURQXYS DBD TOOL', 60, 66);
  ctx.textAlign = 'right';
  ctx.fillStyle = col.soft;
  ctx.font = '700 18px Oxanium, sans-serif';
  const modeText = R.mode && R.mode !== 'standard' ? `${modeLabel(R.mode).toUpperCase()} · ` : '';
  ctx.fillText(`${modeText}${t(cap(build.role)).toUpperCase()} BUILD`, W - 60, 66);
  ctx.textAlign = 'left';

  // Character
  const cx = 200;
  const cy = 270;
  hexPath(ctx, cx, cy, 120);
  g = ctx.createRadialGradient(cx, cy - 40, 10, cx, cy, 140);
  g.addColorStop(0, col.main); g.addColorStop(1, col.deep);
  ctx.fillStyle = g; ctx.shadowColor = col.main; ctx.shadowBlur = 40; ctx.fill(); ctx.shadowBlur = 0;
  const portrait = char && iconSrc('char', char.id) ? await loadImage(iconSrc('char', char.id)) : null;
  if (portrait) {
    ctx.save(); hexPath(ctx, cx, cy, 120); ctx.clip();
    const s = 240 / Math.min(portrait.width, portrait.height);
    ctx.drawImage(portrait, cx - (portrait.width * s) / 2, cy - 120, portrait.width * s, portrait.height * s);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fff'; ctx.font = '800 76px Oxanium, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(initials(char?.name || '?'), cx, cy + 4);
    ctx.textAlign = 'left';
  }
  hexPath(ctx, cx, cy, 120); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = '800 32px Oxanium, sans-serif';
  ctx.fillText(char?.name || '—', cx, 430);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '500 17px Inter, sans-serif';
  ctx.fillText([char?.power, char?.chapter].filter(Boolean).join(' · '), cx, 462);

  // Perks
  const perks = [0, 1, 2, 3].map((i) => IDX.perk[build.perks[i]]);
  for (let i = 0; i < 4; i++) {
    const px = 470 + i * 190;
    const py = 230;
    const p = perks[i];
    diamondPath(ctx, px, py, 78);
    ctx.fillStyle = p ? col.outer : 'rgba(255,255,255,0.06)';
    ctx.shadowColor = p ? col.main : 'transparent'; ctx.shadowBlur = 26; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = p ? col.main : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3; ctx.stroke();
    diamondPath(ctx, px, py, 64);
    ctx.fillStyle = p ? col.inner : 'rgba(0,0,0,0.4)'; ctx.fill();
    if (p) {
      const official = iconSrc('perk', p.id) ? await loadImage(iconSrc('perk', p.id)) : null;
      const img = official || await glyphImage(p, col.glyph);
      const size = official ? 132 : 64;
      if (img) ctx.drawImage(img, px - size / 2, py - size / 2, size, size);
    }
    ctx.fillStyle = '#fff'; ctx.font = '700 19px Oxanium, sans-serif';
    wrapText(ctx, p?.name || t('No perk'), px, 345, 175, 24);
  }

  // Item / add-ons / offering
  const chips = [build.item, ...(build.addons || []), build.offering].filter(Boolean);
  ctx.font = '600 16px Inter, sans-serif';
  let x = 390;
  const chipY = 450;
  ctx.textAlign = 'left';
  for (const label of chips) {
    const w = Math.min(ctx.measureText(label).width + 30, 300);
    if (x + w > W - 60) break;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, chipY - 18, w, 36, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(label, x + 15, chipY + 1, w - 30);
    x += w + 10;
  }

  // Footer: code + credit
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(60, 520, W - 120, 64, 16); ctx.fill();
  ctx.fillStyle = col.soft; ctx.font = '800 26px Oxanium, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(encodeBuild(build), 86, 553);
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '500 16px Inter, sans-serif';
  ctx.fillText('Free at github.com/xurqxy', W - 86, 553);
  return c.toDataURL('image/png');
}

// ---------- Share panel ----------
async function openShareDrawer(build) {
  const code = build ? encodeBuild(build) : '';
  openDrawer(`
    ${drawerHead(t('Share'), t('Share this build'))}
    ${build ? `
    <div class="drawer-sec">
      <div class="sec-title">${t('Build code')}</div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" readonly value="${esc(code)}" id="sh-code" class="code-input"><button class="btn primary" id="sh-copy">${svgIcon('copy', 15)}${t('Copy')}</button></div>
      <p class="muted small" style="margin-top:8px">${t('Friends paste this code into "Load a code" to get the exact same build.')}</p>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${t('Image for Discord')}</div>
      <div class="share-preview" id="sh-preview"><span class="spinner"></span></div>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" id="sh-img-copy" disabled>${svgIcon('copy', 15)}${t('Copy image')}</button>
        <button class="btn" id="sh-img-save" disabled>${svgIcon('download', 15)}${t('Save PNG')}</button>
      </div>
    </div>` : ''}
    <div class="drawer-sec">
      <div class="sec-title">${t('Load a code')}</div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="sh-load" placeholder="XQ-K1A2B-…" class="code-input"><button class="btn" id="sh-load-btn">${t('Load')}</button></div>
      <div id="sh-load-msg" class="small" style="margin-top:8px"></div>
    </div>`, async (d) => {
    $('#sh-copy', d)?.addEventListener('click', () => { copyText(code); track('share'); });
    const load = () => {
      const r = decodeBuild($('#sh-load', d).value);
      const msg = $('#sh-load-msg', d);
      if (r.error) { msg.innerHTML = `<span style="color:var(--red-2)">${esc(r.error)}</span>`; return; }
      closeDrawer();
      applySharedBuild(r.build);
      toast(r.missing.length ? t('Build loaded. Some parts are from a newer version of the tool and were left empty.') : t('Build loaded and locked. Unlock slots to reroll them.'));
    };
    $('#sh-load-btn', d).onclick = load;
    $('#sh-load', d).onkeydown = (e) => { if (e.key === 'Enter') load(); };
    if (!build) { $('#sh-load', d).focus(); return; }
    const dataUrl = await renderShareCard(build);
    const prev = $('#sh-preview', d);
    if (!prev) return; // drawer was closed meanwhile
    prev.innerHTML = `<img src="${dataUrl}" alt="${esc(t('Share image'))}">`;
    const copyBtn = $('#sh-img-copy', d);
    const saveBtn = $('#sh-img-save', d);
    copyBtn.disabled = false; saveBtn.disabled = false;
    copyBtn.onclick = async () => { await window.api.copyImage(dataUrl); toast(t('Image copied. Paste it into Discord with Ctrl+V.')); track('share'); };
    saveBtn.onclick = async () => {
      const name = `${(IDX.char[build.characterId]?.name || 'build').replace(/[^\w]+/g, '-').toLowerCase()}-build.png`;
      if (await window.api.saveImage({ defaultName: name, dataUrl })) { toast(t('Image saved')); track('share'); }
    };
  });
}
