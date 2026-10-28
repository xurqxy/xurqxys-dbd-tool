'use strict';
/* global perkIcon, emblem, iconSrc: writable */
// Live overlay for OBS / the floating overlay window. Receives rolls over server-sent events.
const params = new URLSearchParams(location.search);
const layout = params.get('layout') === 'v' ? 'v' : 'h';
const showNames = params.get('names') !== '0';
document.body.classList.add(`bg-${params.get('bg') || 'transparent'}`);
if (params.get('window')) document.body.classList.add('window');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = document.getElementById('ov');
let lastTs = 0;
let lastChar = '';

function perkHtml(p, i, size) {
  if (p?.hidden) return `<div class="perk pop" style="--i:${i}">${perkIcon(null, size)}<div class="q">?</div><span>???</span></div>`;
  return `<div class="perk pop" style="--i:${i}">${perkIcon(p, size)}<span>${esc(p?.name || '—')}</span></div>`;
}

function render(s) {
  iconSrc = (kind, id) => {
    const file = s.icons?.[`${kind}:${id}`];
    return file ? `/icons/${encodeURIComponent(file)}` : null;
  };
  const animate = s.ts !== lastTs;
  lastTs = s.ts;
  root.className = `ov-${layout} ${s.role} ${showNames ? '' : 'no-names'}`;
  const mode = s.modeLabel ? `<span class="mode">${esc(s.modeLabel)}</span>` : '';
  if (s.squad) {
    root.innerHTML = `<div class="squad">${s.squad.map((m, r) => `<div class="card">
      <div class="char pop" style="--i:${r}">${emblem(m.char, 44)}<div class="cname">${esc(m.char.name)}</div></div>
      <div class="perks">${m.perks.map((p, i) => perkHtml(p, r + i, 46)).join('')}</div></div>`).join('')}</div>`;
  } else {
    root.innerHTML = `<div class="card">
      <div class="char pop">${emblem(s.char, layout === 'v' ? 96 : 78)}<div><div class="cname">${esc(s.char?.name)}</div>${mode}</div></div>
      <div class="perks">${s.perks.map((p, i) => perkHtml(p, i + 1, 70)).join('')}</div>
    </div>`;
  }
  if (!animate) root.querySelectorAll('.pop').forEach((el) => el.classList.remove('pop'));
  // Same character as before (e.g. picked by the streamer): keep it still, only the perks flip in.
  const charKey = s.squad ? '' : s.char?.id || '';
  if (charKey && charKey === lastChar) root.querySelectorAll('.char.pop').forEach((el) => el.classList.remove('pop'));
  lastChar = charKey;
}

function connect() {
  const es = new EventSource('/state');
  es.onmessage = (e) => render(JSON.parse(e.data));
  es.onerror = () => { es.close(); setTimeout(connect, 2000); };
}
connect();
