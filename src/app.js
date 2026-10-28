'use strict';
/* global SFX, ACHIEVEMENTS, achievementsHtml, checkAchievements, track, openShareDrawer, encodeBuild, githubIcon, svgIcon, perkIcon, emblem, glyphFor, thingIcon, slugify, iconSrc: writable, t, LANG, LANGUAGES, setLanguage, detectLanguage */

// ---------- State & helpers ----------
const S = {
  data: null,
  matches: [],
  builds: [],
  settings: {},
  owned: {},
  overrides: { perks: {}, killers: {}, survivors: {} },
  view: 'randomizer',
  role: t('killer'), // shared by randomizer, match log and stats
};
const IDX = { perk: {}, char: {}, charByName: {} };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pct = (n) => `${Math.round(n * 100)}%`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, word, pl = `${word}s`) => `${n} ${t(n === 1 ? word : pl)}`;
const rarityClass = (r) => (r ? `rarity-${String(r).toLowerCase().replace(/\s+/g, '-')}` : '');
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span class="t-dot"></span><span>${esc(msg)}</span>${action ? `<button class="btn sm" id="toast-act">${svgIcon('undo', 14)}${esc(action.label)}</button>` : ''}`;
  if (action) $('#toast-act').onclick = () => { t.classList.remove('show'); action.run(); };
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2000);
}

async function copyText(text) {
  SFX.play('pop');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Copied to clipboard');
}

function modal(innerHtml, onMount) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal glass" role="dialog" aria-modal="true">${innerHtml}</div>`;
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.body.append(back);
  onMount?.(back, close);
  back.querySelector('input, textarea, select')?.focus();
}

function openDrawer(html, onMount) {
  const inner = $('#drawer-inner');
  inner.innerHTML = html;
  $('#tooltip').style.display = 'none';
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('show');
  $$('[data-close-drawer]', inner).forEach((b) => b.onclick = closeDrawer);
  onMount?.(inner);
}
function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('show');
}
const drawerOpen = () => $('#drawer').classList.contains('open');
const drawerHead = (eyebrow, title) => `<div class="drawer-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h2 style="margin:0;font-size:22px">${esc(title)}</h2></div>
  <button class="btn icon ghost" data-close-drawer aria-label="Close">${svgIcon('x')}</button></div>`;

const save = (key) => window.api.set(key, S[key === 'dataOverrides' ? 'overrides' : key]);

function setRole(role) {
  S.role = role;
  document.body.classList.toggle('survivor', role === 'survivor');
  document.body.classList.toggle('killer', role === 'killer');
  placeGlider();
}

function roleSwitch() {
  return `<div class="role-switch" role="tablist" aria-label="Role">
    <button class="killer ${S.role === 'killer' ? 'on' : ''}" data-role="killer">${svgIcon('skull', 18)}${t('Killer')}</button>
    <button class="survivor ${S.role === 'survivor' ? 'on' : ''}" data-role="survivor">${svgIcon('run', 18)}${t('Survivor')}</button>
  </div>`;
}
function bindRoleSwitch(root, after) {
  $$('[data-role]', root).forEach((b) => b.onclick = () => {
    if (S.role === b.dataset.role) return;
    setRole(b.dataset.role);
    after?.();
    render();
  });
}

function emptyState(icon, title, text) {
  return `<div class="glass empty"><div class="e-ico">${svgIcon(icon, 28)}</div><b>${esc(title)}</b><div>${esc(text)}</div></div>`;
}

// ---------- Data access ----------
async function loadData() {
  S.data = await window.api.getData();
  IDX.perk = Object.fromEntries(S.data.perks.map((p) => [p.id, p]));
  IDX.char = {};
  IDX.charByName = {};
  for (const role of ['killers', 'survivors']) {
    for (const c of S.data[role]) {
      const entry = { ...c, role: role.slice(0, -1) };
      IDX.char[c.id] = entry;
      IDX.charByName[c.name] = entry;
    }
  }
}

const charsOf = (role) => (role === 'killer' ? S.data.killers : S.data.survivors).map((c) => IDX.char[c.id]);
const perksOf = (role) => S.data.perks.filter((p) => p.role === role);
const isOwned = (c) => S.owned[c.id] !== false;
const banned = () => new Set(S.settings.bannedPerks || []);
function perkAvailable(p) {
  if (p.owner === 'General') return true;
  const c = IDX.charByName[p.owner];
  return c ? isOwned(c) : true;
}
const perkName = (id) => IDX.perk[id]?.name || id;
const charName = (id) => IDX.char[id]?.name || id || '—';
const allTags = (role) => [...new Set(perksOf(role).flatMap((p) => p.tags))].sort();
const isWin = (m) => (m.role === 'killer' ? m.kills >= 3 : m.result === 'escaped' || m.result === 'hatch');
const perkDesc = (p) => p?.desc || t('No description yet. Update game data from the DBD Wiki in Settings.');
const perkTip = (p) => (p ? `<strong>${esc(p.name)}</strong>${esc(perkDesc(p))}` : '');
const miniPerk = (id, size = 34) => `<span data-tip="${esc(perkTip(IDX.perk[id]))}">${perkIcon(IDX.perk[id], size)}</span>`;

// ---------- Randomizer ----------
const R = {
  theme: 'any',
  fixedChar: { killer: '', survivor: '' },
  ownPerksOnly: false,
  includeItem: true,
  includeAddons: true,
  includeOffering: true,
  result: null,
  locks: new Set(),
  mode: 'standard',
  modeTheme: null,
  revealed: new Set(),
  squad: null,
  note: '',
};
const ADDON_WEIGHTS = [30, 28, 22, 14, 6];

function weightedRarity() {
  const rarities = S.data.addonRarities || ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Ultra Rare'];
  let roll = Math.random() * ADDON_WEIGHTS.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rarities.length; i++) {
    roll -= ADDON_WEIGHTS[i] ?? 1;
    if (roll <= 0) return rarities[i];
  }
  return rarities[0];
}

// ---------- Challenge modes ----------
const MODES = {
  standard: { label: t('Standard'), icon: 'dice', desc: t('Any character, any perks.') },
  adept: { label: t('Adept'), icon: 'obsession', desc: "Only the character's own 3 perks, like the Adept achievement." },
  nometa: { label: t('No Meta'), icon: 'ban', desc: t('Leaves out the most popular perks. Win without the crutches.') },
  theme: { label: t('Theme Roulette'), icon: 'spark', desc: t('All 4 perks share one random theme each spin.') },
  hexboon: { label: t('Hex Only'), survivorLabel: t('Totems & Boons'), icon: 'hex', desc: t('Killer: only Hex perks. Survivor: only totem and Boon perks.') },
  noperks: { label: t('No Perks'), icon: 'x', desc: t('No perks at all. Just you, your power and your item.') },
  mystery: { label: t('Mystery'), icon: 'info', desc: t('Perks stay hidden. Reveal them one by one, which is great on stream.') },
  squad: { label: t('Squad of 4'), icon: 'altruism', survivorOnly: true, desc: t('4 survivor builds for you and your friends, with no character or perk used twice.') },
};
// Popular perks left out by t('No Meta'). Editable if the meta shifts.
const META = {
  killer: new Set(['Barbecue & Chilli', 'Pop Goes the Weasel', 'Scourge Hook: Pain Resonance', 'Deadlock', 'Grim Embrace', 'No Way Out',
    'Lethal Pursuer', 'Hex: No One Escapes Death', 'Corrupt Intervention', 'Eruption', "Dead Man's Switch", 'Sloppy Butcher', 'Hex: Ruin',
    'Bamboozle', 'Nowhere to Hide', 'Floods of Rage', 'Scourge Hook: Floods of Rage', 'Starstruck', 'Agitation', 'Leverage']),
  survivor: new Set(['Dead Hard', 'Sprint Burst', 'Lithe', 'Adrenaline', 'Windows of Opportunity', 'Borrowed Time', 'Decisive Strike',
    'Off the Record', 'Unbreakable', 'Prove Thyself', 'Déjà Vu', 'Resilience', 'Kindred', 'Bond', 'Made for This', 'Distortion',
    'Overcome', 'Background Player', 'Deliverance', 'Boon: Circle of Healing', 'Hope', 'Self-Care']),
};
const modeLabel = (k) => t((S.role === 'survivor' && MODES[k].survivorLabel) || MODES[k].label);
const modesFor = (role) => Object.keys(MODES).filter((k) => role === 'survivor' || !MODES[k].survivorOnly);

function modeAllows(p) {
  switch (R.mode) {
    case 'nometa': return !META[S.role].has(p.name);
    case 'hexboon': return S.role === 'killer' ? p.tags.includes('hex') : p.tags.includes('boon') || p.tags.includes('totem');
    case 'theme': return p.tags.includes(R.modeTheme);
    default: return true;
  }
}

function perkPool(char, { useTheme = true } = {}) {
  const ban = banned();
  return perksOf(S.role).filter((p) =>
    !ban.has(p.id) &&
    (!S.settings.onlyOwned || perkAvailable(p)) &&
    (!R.ownPerksOnly || p.owner === 'General' || p.owner === char?.name) &&
    modeAllows(p) &&
    (!useTheme || R.theme === 'any' || p.tags.includes(R.theme)));
}

function rollChar() {
  const fixed = IDX.char[R.fixedChar[S.role]];
  if (fixed) return fixed;
  const owned = charsOf(S.role).filter(isOwned);
  return pick(owned.length ? owned : charsOf(S.role));
}

function rollPerks(res, onlyIndex = null) {
  if (R.mode === 'noperks') { res.perks = [null, null, null, null]; R.note = ''; return; }
  if (R.mode === 'adept') { res.perks = [...(res.char?.perks || []).slice(0, 3), null]; R.note = ''; return; }
  const keep = res.perks.filter((id, i) => id && (R.locks.has(`perk${i}`) || (onlyIndex !== null && i !== onlyIndex)));
  const used = new Set(keep);
  const themed = shuffle(perkPool(res.char).filter((p) => !used.has(p.id)));
  const fallback = shuffle(perkPool(res.char, { useTheme: false }).filter((p) => !used.has(p.id)));
  R.note = '';
  for (let i = 0; i < 4; i++) {
    const shouldRoll = onlyIndex === null ? !R.locks.has(`perk${i}`) : i === onlyIndex;
    if (!shouldRoll && res.perks[i]) continue;
    let next = themed.find((p) => !used.has(p.id));
    if (!next) {
      next = fallback.find((p) => !used.has(p.id));
      if (next && R.theme !== 'any') R.note = t('Not enough "{theme}" perks, so the rest were filled with any perk.', { theme: R.theme });
    }
    res.perks[i] = next?.id || null;
    if (next) used.add(next.id);
  }
  if (res.perks.some((p) => !p)) R.note = t('Not enough perks with these filters. Unban perks or mark more characters as owned.');
}

function rollItem(res) {
  if (S.role === 'killer') {
    res.item = null;
    return;
  }
  const item = pick(S.data.items);
  res.item = { type: item.type, name: pick(item.variants) };
  res.addons = shuffle(item.addons).slice(0, 2).map((name) => ({ name }));
}

function rollAddons(res, onlyIndex = null) {
  const skip = (i) => (onlyIndex !== null ? i !== onlyIndex : R.locks.has(`addon${i}`));
  const taken = new Set(res.addons.filter((a, i) => a && skip(i)).map((a) => a.name));
  if (S.role === 'survivor') {
    const item = S.data.items.find((i) => i.type === res.item?.type);
    if (!item) return;
    const pool = shuffle(item.addons.filter((a) => !taken.has(a)));
    for (let i = 0; i < 2; i++) {
      if (skip(i)) continue;
      const name = pool.shift();
      res.addons[i] = name ? { name } : null;
    }
    return;
  }
  const list = res.char?.addons || [];
  for (let i = 0; i < 2; i++) {
    if (skip(i)) continue;
    if (list.length >= 2) {
      const a = pick(list.filter((x) => !taken.has(x.name)));
      res.addons[i] = a;
      taken.add(a.name);
    } else {
      const rarity = weightedRarity();
      res.addons[i] = { name: `${rarity} add-on`, rarity, generic: true };
    }
  }
}

function rollOffering(res) {
  const o = S.data.offerings;
  res.offering = pick([...(o[S.role] || []), ...(o.shared || [])]);
}

function rollAll() {
  const prev = R.result;
  const sameRole = prev && prev.role === S.role;
  const res = sameRole
    ? { ...prev, perks: [...prev.perks], addons: [...prev.addons] }
    : { role: S.role, char: null, perks: [null, null, null, null], item: null, addons: [null, null], offering: null };
  if (!sameRole) R.locks.clear();
  if (!R.locks.has('char') || !res.char) res.char = rollChar();
  if (R.mode === 'theme') {
    const ok = allTags(S.role).filter((t) => perksOf(S.role).filter((p) => p.tags.includes(t)).length >= 6);
    R.modeTheme = pick(ok);
  }
  R.revealed = new Set();
  rollPerks(res);
  if (!R.locks.has('item')) {
    // A new item invalidates add-ons locked for the old one.
    if (S.role === 'survivor') { R.locks.delete('addon0'); R.locks.delete('addon1'); }
    rollItem(res);
  }
  rollAddons(res);
  if (!R.locks.has('offering')) rollOffering(res);
  R.result = res;
  if (R.mode === 'squad') rollSquad();
}

// Squad of 4: unique survivors, and no perk used twice across the team.
function rollSquad() {
  const owned = charsOf('survivor').filter(isOwned);
  const chars = shuffle(owned.length >= 4 ? owned : charsOf('survivor')).slice(0, 4);
  const pool = shuffle(perkPool(null));
  R.squad = chars.map((char) => ({ char, perks: pool.splice(0, 4).map((p) => p.id) }));
}

function rollSlot(key) {
  const res = R.result;
  if (!res || R.locks.has(key)) return [];
  if (key === 'char') {
    res.char = rollChar();
    const changed = ['char'];
    if (S.role === 'killer') { rollAddons(res); changed.push('addon0', 'addon1'); }
    if (R.ownPerksOnly) { rollPerks(res); changed.push('perk0', 'perk1', 'perk2', 'perk3'); }
    return changed;
  }
  if (key.startsWith('perk')) rollPerks(res, Number(key.slice(4)));
  else if (key === 'item') {
    rollItem(res);
    R.locks.delete('addon0');
    R.locks.delete('addon1');
    return ['item', 'addon0', 'addon1'];
  } else if (key.startsWith('addon')) rollAddons(res, Number(key.slice(5)));
  else if (key === 'offering') rollOffering(res);
  return [key];
}

function buildText(res) {
  if (R.mode === 'squad' && R.squad) {
    return `${R.squad.map((m, i) => `P${i + 1} ${m.char.name}: ${m.perks.map(perkName).join(', ')}`).join('\n')}\n(Squad rolled with Xurqxys DBD Tool)`;
  }
  const parts = [`${cap(res.role)}: ${res.char?.name}`, `Perks: ${res.perks.filter(Boolean).map(perkName).join(', ')}`];
  if (R.includeItem && res.item) parts.push(`Item: ${res.item.name}`);
  if (R.includeAddons && res.addons.some(Boolean)) parts.push(`Add-ons: ${res.addons.filter(Boolean).map((a) => a.name).join(', ')}`);
  if (R.includeOffering && res.offering) parts.push(`Offering: ${res.offering}`);
  const mode = R.mode !== 'standard' ? ` [${modeLabel(R.mode)}${R.mode === 'theme' ? `: ${cap(R.modeTheme)}` : ''}]` : '';
  return `${parts.join(' | ')}${mode}  (rolled with Xurqxys DBD Tool)`;
}

function lockBtn(key) {
  const locked = R.locks.has(key);
  return `<button class="lock-btn" data-lock="${key}" aria-label="${locked ? t('Unlock') : t('Lock')}" data-tip="${locked ? t('Unlock') : t('Lock this slot')}">${svgIcon(locked ? 'lock' : 'unlock', 15)}</button>`;
}

function activeFilters() {
  const f = [];
  if (R.theme !== 'any') f.push({ key: 'theme', label: `${cap(R.theme)} perks`, icon: R.theme });
  if (R.fixedChar[S.role]) f.push({ key: 'char', label: charName(R.fixedChar[S.role]), icon: 'lock' });
  if (R.ownPerksOnly) f.push({ key: 'own', label: t('Own + general perks'), icon: 'check' });
  if (S.settings.onlyOwned) f.push({ key: t('owned'), label: t('Owned perks only'), icon: 'check' });
  const b = banned().size;
  if (b) f.push({ key: 'banned', label: `${plural(b, 'banned perk')}`, icon: 'ban' });
  return f;
}

function squadHtml() {
  return `<div class="squad">${R.squad.map((m, i) => `
    <div class="glass squad-row" data-squad="${i}" tabindex="0" data-tip="${t('Click to reroll player {n}', { n: i + 1 })}">
      <div class="sq-player">P${i + 1}</div>
      ${emblem(m.char, 54)}
      <div class="sq-name">${esc(m.char.name)}</div>
      <div class="sq-perks">${m.perks.map((id) => `<div class="sq-perk">${perkIcon(IDX.perk[id], 48)}<span>${esc(perkName(id))}</span></div>`).join('')}</div>
    </div>`).join('')}</div>`;
}

// Your own record with a perk or character (current role), shown on the rolled build once there are 3+ games.
function myRecord(kind, id) {
  if (!id) return null;
  const list = S.matches.filter((m) => m.role === S.role && (kind === 'char' ? m.characterId === id : (m.perks || []).includes(id)));
  return list.length >= 3 ? { n: list.length, w: list.filter(isWin).length } : null;
}
function recordBadge(rec) {
  if (!rec) return '';
  const r = rec.w / rec.n;
  return `<div class="my-rate ${r >= 0.6 ? 'good' : r < 0.4 ? 'bad' : ''}">${pct(r)} · ${rec.n}</div>`;
}
const recordTip = (rec) => (rec ? `<br><span class='muted'>${esc(t('Your win rate: {rate} in {n} games', { rate: pct(rec.w / rec.n), n: rec.n }))}</span>` : '');

const CHAR_SIZE = 116;
const PERK_SIZE = 92;

function renderRandomizer(root) {
  if (!modesFor(S.role).includes(R.mode)) R.mode = 'standard';
  if (!R.result || R.result.role !== S.role || (R.mode === 'squad' && !R.squad)) rollAll();
  const res = R.result;
  const filters = activeFilters();
  const hidden = (i) => R.mode === 'mystery' && res.perks[i] && !R.revealed.has(`perk${i}`);

  const perkCards = res.perks.map((id, i) => {
    const p = IDX.perk[id];
    if (hidden(i)) {
      return `<div class="slot perk-slot mystery-slot" data-slot="perk${i}" tabindex="0" data-tip="${t('Click to reveal')}">
        <div class="p-icon">${perkIcon(null, PERK_SIZE)}<span class="q-mark">?</span></div>
        <div class="p-name">${t('Reveal perk {n}', { n: i + 1 })}</div>
      </div>`;
    }
    const empty = R.mode === 'noperks' ? t('No perk') : R.mode === 'adept' ? t('Empty (Adept)') : t('No perk');
    const rec = myRecord('perk', id);
    return `<div class="slot perk-slot ${R.locks.has(`perk${i}`) ? 'locked' : ''} ${p ? '' : 'empty'}" data-slot="perk${i}" tabindex="0" data-tip="${esc(perkTip(p))}${p ? `<br><span class='muted'>${esc(p.owner === 'General' ? t('General perk') : p.owner)}</span>` : ''}${recordTip(rec)}">
      ${p && !['adept', 'noperks'].includes(R.mode) ? lockBtn(`perk${i}`) : ''}
      <div class="p-icon">${perkIcon(p, PERK_SIZE)}</div>
      <div class="p-name">${esc(p?.name || empty)}</div>
      ${recordBadge(rec)}
    </div>`;
  }).join('');
  const charRec = myRecord('char', res.char?.id);

  const mini = (key, label, name, sub, icon, rarity, kind) => `<div class="slot mini ${R.locks.has(key) ? 'locked' : ''}" data-slot="${key}" tabindex="0" data-tip="<strong>${esc(label)}</strong>${esc(sub || '')}">
    ${lockBtn(key)}
    <div class="m-ico ${rarityClass(rarity)}">${kind ? thingIcon(kind, name, icon, 18) : svgIcon(icon, 18)}</div>
    <div class="m-text"><div class="m-label">${esc(label)}</div><div class="m-name ${rarityClass(rarity)}">${esc(name || '—')}</div></div>
  </div>`;
  const extras = [];
  if (S.role === 'survivor' && R.includeItem) extras.push(mini('item', 'Item', res.item?.name, res.item?.type, 'item', null, 'item'));
  if (R.includeAddons && (S.role === 'killer' || R.includeItem)) {
    res.addons.forEach((a, i) => extras.push(mini(`addon${i}`, t('Add-on {n}', { n: i + 1 }), a?.name, a?.generic ? t('No add-on list for this killer, so pick any add-on of this rarity.') : a?.rarity, 'spark', a?.rarity, a?.generic ? null : 'addon')));
  }
  if (R.includeOffering) extras.push(mini('offering', t('Offering'), res.offering, '', 'boon', null, 'offering'));

  root.innerHTML = `<div class="page rz">
    <div class="rz-bar">
      ${roleSwitch()}
      ${R.mode === 'squad' ? '' : `<label class="mode-pick char-pick" data-tip="${t(S.role === 'killer' ? 'Pick your killer, or leave it random' : 'Pick your survivor, or leave it random')}">${svgIcon(S.role === 'killer' ? 'skull' : 'run', 15)}
        <select id="char-pick"><option value="">${t(S.role === 'killer' ? 'Random killer' : 'Random survivor')}</option>${[...charsOf(S.role)].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}" ${R.fixedChar[S.role] === c.id ? 'selected' : ''}>${esc(c.name)}${isOwned(c) ? '' : ` (${t('not owned')})`}</option>`).join('')}</select>
      </label>`}
      <label class="mode-pick" data-tip="${t('Challenge mode')}">${svgIcon(MODES[R.mode].icon, 15)}
        <select id="mode">${modesFor(S.role).map((k) => `<option value="${k}" ${R.mode === k ? 'selected' : ''}>${esc(modeLabel(k))}</option>`).join('')}</select>
      </label>
      <button class="btn" id="open-filters" data-tip="Filters (F)">${svgIcon('sliders', 15)}${t('Filters')}${filters.length ? ` <span class="count-badge">${filters.length}</span>` : ''}</button>
      <span class="spacer"></span>
      <button class="btn icon ghost" id="save-build" data-tip="${t('Save build')}">${svgIcon('save', 17)}</button>
      <button class="btn icon ghost" id="copy-build" data-tip="${t('Copy build text')}">${svgIcon('copy', 17)}</button>
      ${R.mode === 'squad' ? '' : `<button class="btn icon ghost" id="share-build" data-tip="${t('Share: code or image for Discord')}">${svgIcon('share', 17)}</button>`}
      <button class="btn icon ghost" id="log-build" data-tip="${t('Log a match with this build')}">${svgIcon('list', 17)}</button>
      ${R.locks.size ? `<button class="btn icon ghost" id="clear-locks" data-tip="${t('Unlock all')}">${svgIcon('unlock', 17)}</button>` : ''}
      <button class="btn icon ${S.stream?.on ? 'on' : 'ghost'}" id="stream-btn" data-tip="${t('Streamer mode')}">${svgIcon('cast', 17)}</button>
      <button class="spin-btn" id="roll" data-tip="Spin (Space)">${svgIcon('dice', 18)}${t('Spin')}</button>
    </div>
    ${R.mode !== 'standard' ? `<div class="mode-line">${svgIcon(MODES[R.mode].icon, 14)}<b>${esc(modeLabel(R.mode))}${R.mode === 'theme' && R.modeTheme ? `: ${esc(cap(R.modeTheme))}` : ''}</b><span>${esc(t(MODES[R.mode].desc))}</span>
      ${R.mode === 'mystery' && R.revealed.size < res.perks.filter(Boolean).length ? `<button class="btn sm ghost" id="reveal-all">${t('Reveal all')}</button>` : ''}</div>` : ''}
    ${filters.length ? `<div class="filter-summary">${filters.map((f) => `<button class="chip on" data-unfilter="${f.key}" data-tip="${t('Remove filter')}">${svgIcon(f.icon, 12)}${esc(f.label)} ${svgIcon('x', 11)}</button>`).join('')}</div>` : ''}
    ${R.note ? `<div class="note">${svgIcon('info', 15)}${esc(R.note)}</div>` : ''}
    ${R.mode === 'squad' ? squadHtml() : `<div class="glass loadout">
      <div class="slot char-slot ${R.fixedChar[S.role] ? 'chosen' : R.locks.has('char') ? 'locked' : ''}" data-slot="char" tabindex="0" data-tip="<strong>${esc(res.char?.name)}</strong>${esc([res.char?.power, res.char?.chapter].filter(Boolean).join(' · '))}${R.fixedChar[S.role] ? `<br><span class='muted'>${esc(t('Chosen by you. Change it in the dropdown above.'))}</span>` : ''}${recordTip(charRec)}">
        ${R.fixedChar[S.role] ? `<span class="chosen-badge">${svgIcon('check', 12)}${t('Chosen')}</span>` : lockBtn('char')}
        <div class="c-emblem">${emblem(res.char, CHAR_SIZE)}</div>
        <div class="c-name">${esc(res.char?.name)}</div>
        ${recordBadge(charRec)}
      </div>
      <div class="perk-row">${perkCards}</div>
    </div>
    ${extras.length ? `<div class="extras-row">${extras.join('')}</div>` : ''}`}
    <div class="hint">${t("Click a slot to reroll it · hover for details · {key} spins everything that isn't locked", { key: '<span class="kbd">Space</span>' })}</div>
  </div>`;

  bindRoleSwitch(root, () => { R.theme = 'any'; });
  $('#stream-btn', root).onclick = openStreamDrawer;
  $('#char-pick', root)?.addEventListener('change', (e) => {
    R.fixedChar[S.role] = e.target.value;
    R.locks.delete('char');
    spinAll();
  });
  $('#mode', root).onchange = (e) => { R.mode = e.target.value; R.locks.clear(); R.squad = null; spinAll(); };
  $('#reveal-all', root)?.addEventListener('click', () => {
    const keys = res.perks.map((p, i) => `perk${i}`).filter((k) => !R.revealed.has(k));
    keys.forEach((k) => R.revealed.add(k));
    render();
    animateSlots(keys);
  });
  $$('[data-squad]', root).forEach((row) => row.onclick = () => {
    const i = Number(row.dataset.squad);
    const others = new Set(R.squad.flatMap((m, j) => (j === i ? [] : m.perks)));
    const used = new Set(R.squad.map((m) => m.char.id));
    const chars = charsOf('survivor').filter((c) => isOwned(c) && (!used.has(c.id) || c.id === R.squad[i].char.id));
    R.squad[i] = { char: pick(chars), perks: shuffle(perkPool(null).filter((p) => !others.has(p.id))).slice(0, 4).map((p) => p.id) };
    render();
  });
  $('#roll', root).onclick = () => spinAll();
  $('#open-filters', root).onclick = openFilters;
  $$('[data-unfilter]', root).forEach((b) => b.onclick = async () => {
    const k = b.dataset.unfilter;
    if (k === 'theme') R.theme = 'any';
    if (k === 'char') R.fixedChar[S.role] = '';
    if (k === 'own') R.ownPerksOnly = false;
    if (k === 'owned') { S.settings.onlyOwned = false; await save('settings'); }
    if (k === 'banned') { go('database'); return; }
    spinAll();
  });
  $$('[data-slot]', root).forEach((el) => {
    const reroll = () => {
      const key = el.dataset.slot;
      if (R.mode === 'mystery' && key.startsWith('perk') && !R.revealed.has(key)) {
        R.revealed.add(key);
        SFX.play('reveal');
        render();
        animateSlots([key], true);
        return;
      }
      if (key === 'char' && R.fixedChar[S.role]) { $('#char-pick', root)?.focus(); return; }
      if (R.locks.has(key)) return;
      const changed = rollSlot(el.dataset.slot);
      render();
      animateSlots(changed, true);
    };
    el.onclick = (e) => { if (!e.target.closest('[data-lock]')) reroll(); };
    el.onkeydown = (e) => { if (e.key === 'Enter') reroll(); };
  });
  $$('[data-lock]', root).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const k = b.dataset.lock;
    SFX.play(R.locks.has(k) ? 'unlock' : 'lock');
    R.locks.has(k) ? R.locks.delete(k) : R.locks.add(k);
    render();
  });
  $('#clear-locks', root)?.addEventListener('click', () => { R.locks.clear(); render(); });
  $('#copy-build', root).onclick = () => copyText(buildText(res));
  $('#share-build', root)?.addEventListener('click', () => openShareDrawer(resultToBuild(res)));
  $('#save-build', root).onclick = () => editBuild(resultToBuild(res));
  $('#log-build', root).onclick = () => { setQuick(resultToBuild(res)); go('matches'); };
}

// Slot-machine animation: cycle random names/icons, then land one slot at a time.
let spinTimers = [];
function animateSlots(keys, quick = false) {
  if (reducedMotion()) return;
  const pools = {
    char: charsOf(S.role),
    perk: perksOf(S.role),
    item: S.data.items.flatMap((i) => i.variants),
    offering: [...(S.data.offerings[S.role] || []), ...(S.data.offerings.shared || [])],
  };
  // A chosen killer/survivor stays put; only random slots get the slot-machine roll.
  const rollers = keys.filter((k) => !R.locks.has(k) && !(k === 'char' && R.fixedChar[S.role]) && $(`[data-slot="${k}"]`));
  let landed = 0;
  rollers.forEach((key, idx) => {
    const el = $(`[data-slot="${key}"]`);
    SFX.rollStart();
    const nameEl = el.querySelector('.p-name, .c-name, .m-name');
    const iconEl = el.querySelector('.p-icon, .c-emblem');
    const finalName = nameEl?.innerHTML;
    const finalIcon = iconEl?.innerHTML;
    el.classList.add('rolling');
    const tick = setInterval(() => {
      if (key === 'char') {
        const c = pick(pools.char);
        nameEl.textContent = c.name;
        iconEl.innerHTML = emblem(c, CHAR_SIZE);
      } else if (key.startsWith('perk')) {
        const p = pick(pools.perk);
        nameEl.textContent = p.name;
        iconEl.innerHTML = perkIcon(p, PERK_SIZE);
      } else if (nameEl) {
        const addonPool = S.role === 'killer' && (R.result?.char?.addons || []).length >= 2
          ? R.result.char.addons.map((a) => a.name) : ['Common add-on', 'Rare add-on', 'Very Rare add-on', 'Ultra Rare add-on'];
        nameEl.textContent = pick(key === 'item' ? pools.item : key === 'offering' ? pools.offering : addonPool);
      }
    }, 70);
    const stop = setTimeout(() => {
      clearInterval(tick);
      if (nameEl) nameEl.innerHTML = finalName;
      if (iconEl) iconEl.innerHTML = finalIcon;
      el.classList.remove('rolling');
      el.classList.add('landed');
      setTimeout(() => el.classList.remove('landed'), 650);
      SFX.rollStop();
      SFX.play('land', idx);
      if (++landed === rollers.length && rollers.length > 2) setTimeout(() => SFX.play('done'), 90);
    }, (quick ? 380 : 520) + idx * (quick ? 90 : 150));
    spinTimers.push(tick, stop);
  });
}

function spinAll() {
  spinTimers.forEach((t) => { clearInterval(t); clearTimeout(t); });
  spinTimers = [];
  SFX.rollStop(true);
  if (S.settings.spinAnim === false || reducedMotion()) SFX.play('done');
  rollAll();
  render();
  animateSlots(['char', 'perk0', 'perk1', 'perk2', 'perk3', 'item', 'addon0', 'addon1', 'offering']);
  track('spin', { mode: R.mode });
}

function openFilters() {
  const chars = charsOf(S.role);
  const tags = allTags(S.role);
  const ban = [...banned()];
  openDrawer(`
    ${drawerHead('Randomizer', t('Filters'))}
    <div class="drawer-sec">
      <div class="sec-title">${t('Theme')}</div>
      <div class="chips">
        <button class="chip ${R.theme === 'any' ? 'on' : ''}" data-theme="any">${svgIcon('dice', 13)}${t('Any')}</button>
        ${tags.map((t) => `<button class="chip ${R.theme === t ? 'on' : ''}" data-theme="${t}">${svgIcon(t, 13)}${esc(cap(t))}</button>`).join('')}
      </div>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${S.role === 'killer' ? t('Killer') : t('Survivor')}</div>
      <select id="f-char" style="width:100%"><option value="">${t('Random')}</option>${chars.map((c) => `<option value="${c.id}" ${R.fixedChar[S.role] === c.id ? 'selected' : ''}>${esc(c.name)}${isOwned(c) ? '' : ' (not owned)'}</option>`).join('')}</select>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${t('Perks')}</div>
      <label class="switch"><span class="sw-text">${t('Own + general perks only')}<small>${t('Only the character\'s own perks and general perks')}</small></span><input type="checkbox" id="f-own" ${R.ownPerksOnly ? 'checked' : ''}></label>
      <label class="switch"><span class="sw-text">${t('Only perks I own')}<small>${t('Uses your owned characters in Settings')}</small></span><input type="checkbox" id="f-owned" ${S.settings.onlyOwned ? 'checked' : ''}></label>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${t('Include')}</div>
      ${S.role === 'survivor' ? `<label class="switch"><span class="sw-text">${t('Item')}</span><input type="checkbox" id="f-item" ${R.includeItem ? 'checked' : ''}></label>` : ''}
      <label class="switch"><span class="sw-text">${t('Add-ons')}</span><input type="checkbox" id="f-addons" ${R.includeAddons ? 'checked' : ''}></label>
      <label class="switch"><span class="sw-text">${t('Offering')}</span><input type="checkbox" id="f-offering" ${R.includeOffering ? 'checked' : ''}></label>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${t('Banned perks ({n})', { n: ban.length })}</div>
      ${ban.length ? `<div class="chips">${ban.map((id) => `<button class="chip" data-unban="${id}" data-tip="${t('Unban')}">${esc(perkName(id))} ${svgIcon('x', 12)}</button>`).join('')}</div>`
        : `<div class="muted small">${t('Ban perks from the Perks page to keep them out of your rolls.')}</div>`}
    </div>
    <div class="row" style="margin-top:8px">
      <button class="btn ghost" id="f-reset">${t('Reset filters')}</button><span class="spacer"></span>
      <button class="btn primary" id="f-apply">${svgIcon('spark', 16)}${t('Spin with these')}</button>
    </div>`, (d) => {
    const reopen = () => { openFilters(); render(); };
    $$('[data-theme]', d).forEach((b) => b.onclick = () => { R.theme = b.dataset.theme; rollAll(); reopen(); });
    $('#f-char', d).onchange = (e) => { R.fixedChar[S.role] = e.target.value; R.locks.delete('char'); rollAll(); render(); };
    $('#f-own', d).onchange = (e) => { R.ownPerksOnly = e.target.checked; rollAll(); render(); };
    $('#f-owned', d).onchange = async (e) => { S.settings.onlyOwned = e.target.checked; await save('settings'); rollAll(); render(); };
    const inc = (id, key) => { const el = $(id, d); if (el) el.onchange = (e) => { R[key] = e.target.checked; render(); }; };
    inc('#f-item', 'includeItem');
    inc('#f-addons', 'includeAddons');
    inc('#f-offering', 'includeOffering');
    $$('[data-unban]', d).forEach((b) => b.onclick = async () => {
      S.settings.bannedPerks = (S.settings.bannedPerks || []).filter((id) => id !== b.dataset.unban);
      await save('settings');
      reopen();
    });
    $('#f-reset', d).onclick = async () => {
      Object.assign(R, { theme: 'any', ownPerksOnly: false, includeItem: true, includeAddons: true, includeOffering: true });
      R.fixedChar[S.role] = '';
      S.settings.onlyOwned = false;
      await save('settings');
      rollAll();
      reopen();
    };
    $('#f-apply', d).onclick = () => { closeDrawer(); spinAll(); };
  });
}

function resultToBuild(res) {
  return {
    role: res.role,
    characterId: res.char?.id || '',
    perks: [...res.perks].map((p) => p || ''),
    item: R.includeItem && res.item ? res.item.name : '',
    addons: R.includeAddons ? res.addons.filter(Boolean).map((a) => a.name) : [],
    offering: R.includeOffering ? res.offering || '' : '',
    name: `${res.char?.name || ''} build`,
    notes: '',
    mode: R.mode,
  };
}

function loadBuildIntoRandomizer(b) {
  setRole(b.role);
  const char = IDX.char[b.characterId] || IDX.char[R.fixedChar[b.role]] || rollChar();
  R.result = { role: b.role, char, perks: [0, 1, 2, 3].map((i) => b.perks[i] || null), item: null, addons: [null, null], offering: b.offering || null };
  R.locks = new Set([...(IDX.char[b.characterId] ? ['char'] : []), ...b.perks.map((p, i) => (p ? `perk${i}` : null)).filter(Boolean)]);
  rollPerks(R.result);
  rollItem(R.result);
  rollAddons(R.result);
  if (!R.result.offering) rollOffering(R.result);
  go('randomizer');
}

// ---------- Database ----------
const D = { tab: t('perks'), q: '', role: 'all', tags: new Set(), showBanned: false };

function renderDatabase(root) {
  const tabs = [['perks', 'Perks'], ['killers', t('Killers')], ['survivors', t('Survivors')], ['items', t('Items & Offerings')]];
  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">${t('Database')}</div><h1>${D.tab === 'items' ? t('Items & Offerings') : cap(D.tab)}</h1></div>
      <div class="seg">${tabs.map(([t, l]) => `<button data-tab="${t}" class="${D.tab === t ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div id="db-body"></div>
  </div>`;
  $$('[data-tab]', root).forEach((b) => b.onclick = () => { D.tab = b.dataset.tab; D.q = ''; D.tags.clear(); render(); });
  const body = $('#db-body', root);
  if (D.tab === 'perks') renderPerkDb(body);
  else if (D.tab === 'items') renderItemsDb(body);
  else renderCharDb(body, D.tab.slice(0, -1));
}

function renderPerkDb(body) {
  const base = S.data.perks.filter((p) => D.role === 'all' || p.role === D.role);
  const tagCounts = {};
  for (const p of base) for (const t of p.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
  body.innerHTML = `<div class="db-layout">
    <div class="glass db-side">
      <div class="search">${svgIcon('search', 16)}<input type="search" id="q" placeholder="${t('Search perks…')}" value="${esc(D.q)}" aria-label="Search perks"></div>
      <div class="seg" style="display:flex">${['all', 'killer', 'survivor'].map((r) => `<button style="flex:1;justify-content:center" data-r="${r}" class="${D.role === r ? 'on' : ''}">${t(cap(r))}</button>`).join('')}</div>
      <div>
        <div class="sec-title">${t('Categories')}</div>
        <div class="tag-list">${Object.keys(tagCounts).sort().map((t) => `<button class="tag-row ${D.tags.has(t) ? 'on' : ''}" data-tag="${t}">${svgIcon(t, 15)}${esc(cap(t))}<span class="count">${tagCounts[t]}</span></button>`).join('')}</div>
      </div>
      <label class="switch" style="padding:0"><span class="sw-text">${t('Banned only')}</span><input type="checkbox" id="show-banned" ${D.showBanned ? 'checked' : ''}></label>
    </div>
    <div>
      <div class="row" style="margin-bottom:12px"><span class="muted small" id="count"></span>
        ${D.tags.size ? `<button class="btn sm ghost" id="clear-tags">${svgIcon('x', 13)}${t('Clear categories')}</button>` : ''}</div>
      <div class="perk-grid" id="grid"></div>
    </div>
  </div>`;
  const draw = () => {
    const ban = banned();
    const q = D.q.trim().toLowerCase();
    const list = base.filter((p) =>
      [...D.tags].every((t) => p.tags.includes(t)) &&
      (!D.showBanned || ban.has(p.id)) &&
      (!q || `${p.name} ${p.owner} ${p.desc} ${p.tags.join(' ')}`.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    $('#count', body).textContent = plural(list.length, 'perk');
    $('#grid', body).innerHTML = list.map((p) => `
      <div class="glass perk-tile ${p.role} ${ban.has(p.id) ? 'banned' : ''}" data-perk="${p.id}" tabindex="0" data-tip="${esc(perkTip(p))}">
        ${perkIcon(p, 72)}
        <div class="t-name">${esc(p.name)}</div>
        <div class="t-owner">${esc(p.owner === 'General' ? 'General' : p.owner.replace(/^The /, ''))}</div>
      </div>`).join('') || `<div style="grid-column:1/-1">${emptyState('search', t('No perks match'), t('Try another search or clear the categories.'))}</div>`;
  };
  draw();
  $('#q', body).oninput = (e) => { D.q = e.target.value; draw(); };
  $$('[data-r]', body).forEach((b) => b.onclick = () => { D.role = b.dataset.r; D.tags.clear(); renderPerkDb(body); });
  $('#show-banned', body).onchange = (e) => { D.showBanned = e.target.checked; draw(); };
  $('#clear-tags', body)?.addEventListener('click', () => { D.tags.clear(); renderPerkDb(body); });
  $$('[data-tag]', body).forEach((b) => b.onclick = () => {
    D.tags.has(b.dataset.tag) ? D.tags.delete(b.dataset.tag) : D.tags.add(b.dataset.tag);
    renderPerkDb(body);
  });
  const open = (e) => {
    const tile = e.target.closest('[data-perk]');
    if (tile) openPerkDetail(IDX.perk[tile.dataset.perk], draw);
  };
  $('#grid', body).onclick = open;
  $('#grid', body).onkeydown = (e) => { if (e.key === 'Enter') open(e); };
}

function openPerkDetail(p, refresh) {
  const isBanned = banned().has(p.id);
  const canUse = p.role === S.role || true;
  openDrawer(`
    ${drawerHead(p.role === 'killer' ? t('Killer perk') : t('Survivor perk'), '')}
    <div class="detail-hero ${p.role}" style="--role:${p.role === 'killer' ? 'var(--red)' : 'var(--cyan)'}">
      ${perkIcon(p, 150)}
      <h2 style="font-size:24px;margin:6px 0 0">${esc(p.name)}</h2>
      <div><span class="role-pill ${p.role}">${p.role}</span> <span class="muted small">${esc(p.owner === 'General' ? t('General perk (everyone)') : p.owner)}</span></div>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${t('What it does')}</div>
      <p class="dim">${esc(perkDesc(p))}</p>
      <div>${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    </div>
    <div class="drawer-sec stack" style="gap:10px">
      ${canUse ? `<button class="btn primary" id="d-use">${svgIcon('lock', 16)}${t('Lock into my next roll')}</button>` : ''}
      <div class="row">
        <button class="btn" id="d-ban">${svgIcon(isBanned ? 'check' : 'ban', 16)}${isBanned ? t('Unban') : t('Ban from randomizer')}</button>
        <button class="btn" id="d-edit">${svgIcon('edit', 16)}${t('Edit summary')}</button>
      </div>
    </div>
    <div class="drawer-sec" id="d-editor" hidden>
      <label class="field">${t('Summary')}<textarea id="e-desc" rows="4">${esc(p.desc)}</textarea></label>
      <label class="field" style="margin-top:10px">${t('Tags (comma separated)')}<input type="text" id="e-tags" value="${esc(p.tags.join(', '))}"></label>
      <div class="row" style="margin-top:12px"><button class="btn ghost" id="e-reset">${t('Reset to default')}</button><span class="spacer"></span><button class="btn primary" id="e-save">${t('Save')}</button></div>
    </div>`, (d) => {
    $('#d-use', d)?.addEventListener('click', () => {
      setRole(p.role);
      if (!R.result || R.result.role !== p.role) rollAll();
      const res = R.result;
      if (!res.perks.includes(p.id)) {
        let i = [0, 1, 2, 3].find((n) => !R.locks.has(`perk${n}`));
        if (i === undefined) i = 3;
        res.perks[i] = p.id;
        R.locks.add(`perk${i}`);
      }
      closeDrawer();
      toast(`${p.name} locked in`);
      go('randomizer');
    });
    $('#d-ban', d).onclick = async () => {
      const set = banned();
      set.has(p.id) ? set.delete(p.id) : set.add(p.id);
      S.settings.bannedPerks = [...set];
      await save('settings');
      refresh?.();
      openPerkDetail(p, refresh);
    };
    $('#d-edit', d).onclick = () => { $('#d-editor', d).hidden = false; $('#e-desc', d).focus(); };
    $('#e-save', d).onclick = async () => {
      S.overrides.perks[p.id] = {
        desc: $('#e-desc', d).value.trim(),
        tags: $('#e-tags', d).value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      };
      await save('dataOverrides');
      await loadData();
      refresh?.();
      openPerkDetail(IDX.perk[p.id], refresh);
      toast('Perk updated');
    };
    $('#e-reset', d).onclick = async () => {
      delete S.overrides.perks[p.id];
      await save('dataOverrides');
      await loadData();
      refresh?.();
      openPerkDetail(IDX.perk[p.id], refresh);
    };
  });
}

function renderCharDb(body, role) {
  body.innerHTML = `
    <div class="row" style="margin-bottom:16px">
      <div class="search" style="flex:1;max-width:420px">${svgIcon('search', 16)}<input type="search" id="q" placeholder="${t(role === 'killer' ? 'Search killers, powers, perks…' : 'Search survivors, powers, perks…')}" value="${esc(D.q)}"></div>
      <span class="muted small" id="count"></span>
    </div>
    <div class="char-grid" id="grid"></div>`;
  const draw = () => {
    const q = D.q.trim().toLowerCase();
    const list = charsOf(role).filter((c) => !q || `${c.name} ${c.power || ''} ${c.chapter} ${c.perks.map(perkName).join(' ')}`.toLowerCase().includes(q));
    $('#count', body).textContent = `${plural(list.length, role)} · ${charsOf(role).filter(isOwned).length} owned`;
    $('#grid', body).innerHTML = list.map((c) => `
      <div class="glass char-tile ${isOwned(c) ? '' : 'unowned'}" data-char="${c.id}" tabindex="0">
        ${emblem(c, 64)}
        <div style="min-width:0;flex:1">
          <div class="ct-name">${esc(c.name)}</div>
          <div class="ct-meta">${esc([c.power, c.chapter].filter(Boolean).join(' · '))}</div>
          <div class="ct-perks">${c.perks.map((id) => miniPerk(id, 28)).join('')}</div>
        </div>
      </div>`).join('') || emptyState('search', t('Nothing matches'), t('Try another search.'));
  };
  draw();
  $('#q', body).oninput = (e) => { D.q = e.target.value; draw(); };
  const open = (e) => {
    const t = e.target.closest('[data-char]');
    if (t) openCharDetail(IDX.char[t.dataset.char], draw);
  };
  $('#grid', body).onclick = open;
  $('#grid', body).onkeydown = (e) => { if (e.key === 'Enter') open(e); };
}

function openCharDetail(c, refresh) {
  openDrawer(`
    ${drawerHead(cap(c.role), '')}
    <div class="detail-hero" style="--role:${c.role === 'killer' ? 'var(--red)' : 'var(--cyan)'}">
      ${emblem(c, 140)}
      <h2 style="font-size:24px;margin:4px 0 0">${esc(c.name)}</h2>
      <div class="muted small">${esc([c.power, c.chapter].filter(Boolean).join(' · '))}</div>
    </div>
    <div class="drawer-sec">
      <label class="switch"><span class="sw-text">${t(c.role === 'killer' ? t('I own this killer') : t('I own this survivor'))}<small>${t('Used by "Only perks I own" and random picks')}</small></span><input type="checkbox" id="c-own" ${isOwned(c) ? 'checked' : ''}></label>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${t('Unique perks')}</div>
      <div class="stack" style="gap:12px">${c.perks.map((id) => { const p = IDX.perk[id]; return `<div class="row" style="flex-wrap:nowrap;align-items:flex-start">${perkIcon(p, 46)}<div><b>${esc(p.name)}</b><div class="small dim">${esc(perkDesc(p))}</div></div></div>`; }).join('')}</div>
    </div>
    <div class="drawer-sec stack" style="gap:10px">
      <button class="btn primary" id="c-roll">${svgIcon('spark', 16)}${t('Randomize a build for {name}', { name: esc(c.name) })}</button>
      ${c.role === 'killer' ? `<button class="btn" id="c-addons">${svgIcon('spark', 16)}${t('Edit add-ons ({n})', { n: (c.addons || []).length })}</button>` : ''}
    </div>`, (d) => {
    $('#c-own', d).onchange = async (e) => {
      if (e.target.checked) delete S.owned[c.id]; else S.owned[c.id] = false;
      await save('owned');
      refresh?.();
    };
    $('#c-roll', d).onclick = () => {
      setRole(c.role);
      R.fixedChar[c.role] = c.id;
      R.locks.delete('char');
      R.result = null;
      closeDrawer();
      go('randomizer');
      animateSlots(['char', 'perk0', 'perk1', 'perk2', 'perk3', 'item', 'addon0', 'addon1', 'offering']);
    };
    $('#c-addons', d)?.addEventListener('click', () => editAddons(c, () => { refresh?.(); openCharDetail(IDX.char[c.id], refresh); }));
  });
}

function editAddons(k, done) {
  const text = (k.addons || []).map((a) => (a.rarity ? `${a.name} | ${a.rarity}` : a.name)).join('\n');
  modal(`
    <div class="eyebrow">${t('Add-ons')}</div><h2>${esc(k.name)}</h2>
    <p class="muted small">One add-on per line, optionally followed by <code>| Rarity</code> (Common, Uncommon, Rare, Very Rare, Ultra Rare). With at least 2 saved, the randomizer rolls exact add-ons.</p>
    <textarea id="a-list" rows="14" placeholder="Bloody Coil | Uncommon">${esc(text)}</textarea>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" id="a-save">${svgIcon('save', 16)}${t('Save')}</button></div>`, (m, close) => {
    $('#a-save', m).onclick = async () => {
      const addons = $('#a-list', m).value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [name, rarity] = l.split('|').map((s) => s.trim());
        return rarity ? { name, rarity } : { name };
      });
      S.overrides.killers[k.id] = { ...(S.overrides.killers[k.id] || {}), addons };
      await save('dataOverrides');
      await loadData();
      if (R.result?.char?.id === k.id) R.result.char = IDX.char[k.id];
      close();
      done?.();
      toast(`Saved ${plural(addons.length, 'add-on')}`);
    };
  });
}

function renderItemsDb(body) {
  const o = S.data.offerings;
  body.innerHTML = `<div class="grid-2">
    <div class="glass panel"><h2>${t('Items')}</h2>${S.data.items.map((i) => `
      <div style="margin-top:14px"><div class="row" style="margin-bottom:6px">${svgIcon('item', 16)}<b>${esc(i.type)}</b></div>
      <div>${i.variants.map((v) => `<span class="tag icon-tag">${thingIcon('item', v, 'item', 12)}${esc(v)}</span>`).join('')}</div>
      <div class="sec-title" style="margin:8px 0 6px">${t('Add-ons')}</div><div>${i.addons.map((v) => `<span class="tag icon-tag">${thingIcon('addon', v, 'spark', 12)}${esc(v)}</span>`).join('')}</div></div>`).join('')}
    </div>
    <div class="stack">
      <div class="glass panel"><h2>${t('Offerings')}</h2>${['killer', 'survivor', 'shared'].map((k) => `
        <div class="sec-title" style="margin-top:12px">${cap(k)}</div><div>${(o[k] || []).map((v) => `<span class="tag icon-tag">${thingIcon('offering', v, 'boon', 12)}${esc(v)}</span>`).join('')}</div>`).join('')}</div>
      <div class="glass panel"><h2>${t('Realms')}</h2><div>${S.data.realms.map((v) => `<span class="tag">${esc(v)}</span>`).join('')}</div></div>
    </div>
  </div>`;
}

// ---------- Builds ----------
function perkSelect(role, value, name) {
  const groups = {};
  for (const p of perksOf(role)) (groups[p.owner] ||= []).push(p);
  const owners = Object.keys(groups).sort((a, b) => (a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)));
  return `<select name="${name}"><option value="">— none —</option>${owners.map((o) => `<optgroup label="${esc(o)}">${groups[o]
    .map((p) => `<option value="${p.id}" ${value === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}</select>`;
}

function charSelect(role, value, name = 'characterId') {
  return `<select name="${name}">${charsOf(role).map((c) => `<option value="${c.id}" ${value === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
}

function editBuild(build) {
  const b = { id: null, role: S.role, characterId: '', perks: ['', '', '', ''], name: '', notes: '', ...build };
  modal(`
    <div class="eyebrow">${b.id ? t('Edit build') : t('New build')}</div>
    <form id="b-form" class="stack" style="margin-top:10px">
      <label class="field">${t('Name')}<input type="text" name="name" value="${esc(b.name)}" required placeholder="e.g. Gen slowdown Nurse"></label>
      <label class="field">${cap(b.role)}${charSelect(b.role, b.characterId)}</label>
      <div class="grid-2" style="gap:12px">${[0, 1, 2, 3].map((i) => `<label class="field">${t('Perk')} ${i + 1}${perkSelect(b.role, b.perks[i], `perk${i}`)}</label>`).join('')}</div>
      ${b.item || b.addons?.length || b.offering ? `<div class="muted small">${esc([b.item, ...(b.addons || []), b.offering].filter(Boolean).join(' · '))}</div>` : ''}
      <label class="field">${t('Notes')}<textarea name="notes" rows="3" placeholder="${t('Optional')}">${esc(b.notes)}</textarea></label>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" type="submit">${svgIcon('save', 16)}${t('Save build')}</button></div>
    </form>`, (m, close) => {
    $('#b-form', m).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const saved = { ...b, id: b.id || uid(), createdAt: b.createdAt || new Date().toISOString(),
        name: f.get('name').trim(), characterId: f.get('characterId'), notes: f.get('notes').trim(),
        perks: [0, 1, 2, 3].map((i) => f.get(`perk${i}`)) };
      const i = S.builds.findIndex((x) => x.id === saved.id);
      if (i >= 0) S.builds[i] = saved;
      else S.builds.unshift(saved);
      await save('builds');
      close();
      toast(t('Build saved'));
      SFX.play('pop');
      setTimeout(() => checkAchievements(), 2200);
      if (S.view === 'builds') render();
    };
  });
}

function renderBuilds(root) {
  const f = S.buildsFilter || 'all';
  const list = S.builds.filter((b) => f === 'all' || b.role === f);
  const presets = (S.data.presets || []).filter((b) => (f === 'all' || b.role === f) && b.perks.every((id) => IDX.perk[id]));
  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">${t('Loadouts')}</div><h1>${t('Builds')}</h1></div>
      <div class="row">
        <div class="seg">${['all', 'killer', 'survivor'].map((r) => `<button data-bf="${r}" class="${f === r ? 'on' : ''}">${t(cap(r))}</button>`).join('')}</div>
        <button class="btn" id="load-code">${svgIcon('upload', 16)}${t('Load a code')}</button>
        <button class="btn primary" id="new-build">${svgIcon('plus', 16)}${t(S.role === 'killer' ? 'New killer build' : 'New survivor build')}</button>
      </div>
    </div>
    ${list.length ? `<div class="build-grid">${list.map((b) => {
      const ms = S.matches.filter((m) => m.buildId === b.id);
      const wr = ms.length ? ms.filter(isWin).length / ms.length : 0;
      const c = IDX.char[b.characterId];
      return `<div class="glass build-card" style="--role:${b.role === 'killer' ? 'var(--red)' : 'var(--cyan)'}">
        <div class="row" style="flex-wrap:nowrap">
          ${emblem(c || { role: b.role, name: '?' }, 54)}
          <div style="flex:1;min-width:0"><div class="b-name">${esc(b.name)}</div><div class="muted small">${esc(charName(b.characterId))}</div></div>
          <div class="ring" style="--p:${Math.round(wr * 100)}" data-tip="<strong>${t('Win rate')}</strong>${ms.length ? `${plural(ms.length, 'match', 'matches')} logged` : t('No matches logged yet')}"><span>${ms.length ? pct(wr) : '—'}</span></div>
        </div>
        <div class="b-perks">${b.perks.filter(Boolean).map((id) => miniPerk(id, 52)).join('')}</div>
        ${b.item || b.addons?.length || b.offering ? `<div class="small muted">${esc([b.item, ...(b.addons || []), b.offering].filter(Boolean).join(' · '))}</div>` : ''}
        ${b.notes ? `<div class="small dim">${esc(b.notes)}</div>` : ''}
        <div class="row">
          <button class="btn sm primary" data-log="${b.id}">${svgIcon('list', 14)}${t('Log match')}</button>
          <button class="btn sm" data-load="${b.id}">${svgIcon('dice', 14)}${t('Spin from this')}</button>
          <span class="spacer"></span>
          <button class="btn sm icon ghost" data-share="${b.id}" data-tip="${t('Share')}">${svgIcon('share', 15)}</button>
          <button class="btn sm icon ghost" data-copy="${b.id}" data-tip="${t('Copy')}">${svgIcon('copy', 15)}</button>
          <button class="btn sm icon ghost" data-edit="${b.id}" data-tip="${t('Edit')}">${svgIcon('edit', 15)}</button>
          <button class="btn sm icon ghost danger" data-del="${b.id}" data-tip="${t('Delete')}">${svgIcon('trash', 15)}</button>
        </div>
      </div>`;
    }).join('')}</div>` : presets.length ? `<div class="glass panel muted small builds-empty">${svgIcon('layers', 16)}${t('No builds yet')}. ${t('Spin one in the Randomizer and hit Save, or start from a popular build below.')}</div>` : emptyState('layers', t('No builds yet'), t('Spin one in the Randomizer and hit Save, or make one here.'))}
    ${presets.length ? `<h2 class="section-title">${svgIcon('spark', 18)}${t('Popular builds')}</h2>
    <div class="build-grid preset-grid">${presets.map((b) => {
      const c = IDX.char[b.characterId];
      return `<div class="glass build-card preset-card" style="--role:${b.role === 'killer' ? 'var(--red)' : 'var(--cyan)'}">
        <div class="row" style="flex-wrap:nowrap">
          ${c ? emblem(c, 44) : `<div class="any-char">${svgIcon(b.role === 'killer' ? 'skull' : 'run', 22)}</div>`}
          <div style="flex:1;min-width:0"><div class="b-name">${esc(t(b.name))}</div><div class="muted small">${c ? esc(c.name) : t(b.role === 'killer' ? 'Any killer' : 'Any survivor')}${b.credit ? ` · ${esc(b.credit)}` : ''}</div></div>
        </div>
        <div class="b-perks">${b.perks.map((id) => miniPerk(id, 46)).join('')}</div>
        ${b.notes ? `<div class="small dim">${esc(t(b.notes))}</div>` : ''}
        <div class="row">
          <button class="btn sm primary" data-pload="${b.id}">${svgIcon('dice', 14)}${t('Spin from this')}</button>
          <button class="btn sm" data-psave="${b.id}">${svgIcon('save', 14)}${t('Save to my builds')}</button>
        </div>
      </div>`;
    }).join('')}</div>` : ''}
  </div>`;
  $$('[data-bf]', root).forEach((b) => b.onclick = () => { S.buildsFilter = b.dataset.bf; render(); });
  $('#load-code', root).onclick = () => openShareDrawer(null);
  $('#new-build', root).onclick = () => editBuild({ role: S.role, characterId: charsOf(S.role)[0].id });
  root.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const t = btn.dataset;
    const preset = (S.data.presets || []).find((x) => x.id === (t.pload || t.psave));
    if (preset && t.pload) { loadBuildIntoRandomizer(preset); return; }
    if (preset && t.psave) {
      const copy = { ...structuredClone(preset), id: uid(), name: window.t(preset.name), notes: window.t(preset.notes || ''), characterId: preset.characterId || charsOf(preset.role)[0].id, createdAt: new Date().toISOString() };
      delete copy.credit;
      S.builds.unshift(copy);
      await save('builds');
      render();
      toast(window.t('Saved "{name}" to your builds', { name: copy.name }));
      SFX.play('pop');
      return;
    }
    const b = S.builds.find((x) => x.id === (t.log || t.copy || t.edit || t.del || t.load || t.share));
    if (!b) return;
    if (t.log) { setQuick({ ...b, buildId: b.id }); go('matches'); }
    if (t.load) loadBuildIntoRandomizer(b);
    if (t.share) openShareDrawer(b);
    if (t.copy) copyText(`${b.name}: ${charName(b.characterId)} | ${b.perks.filter(Boolean).map(perkName).join(', ')}`);
    if (t.edit) editBuild(b);
    if (t.del) {
      const idx = S.builds.findIndex((x) => x.id === b.id);
      S.builds.splice(idx, 1);
      await save('builds');
      render();
      toast(`Deleted "${b.name}"`, { label: t('Undo'), run: async () => { S.builds.splice(idx, 0, b); await save('builds'); render(); } });
    }
  };
}

// ---------- Match log ----------
const SURV_RESULTS = { escaped: t('Escaped'), hatch: t('Hatch'), sacrificed: t('Sacrificed'), killed: t('Killed'), dc: t('DC') };
const SURV_WIN = { escaped: true, hatch: true };
const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const Q = { killer: null, survivor: null, details: false };

function setQuick(b) {
  setRole(b.role);
  Q[b.role] = { characterId: b.characterId, perks: [0, 1, 2, 3].map((i) => b.perks?.[i] || ''), buildId: b.buildId || null, buildName: b.buildId ? b.name : '', mode: b.mode && b.mode !== 'standard' ? b.mode : null };
}

function quickState() {
  if (!Q[S.role]) {
    // Default to the loadout of the last match logged for this role.
    const last = S.matches.find((m) => m.role === S.role);
    Q[S.role] = last
      ? { characterId: last.characterId, perks: [0, 1, 2, 3].map((i) => last.perks[i] || ''), buildId: null, buildName: '' }
      : { characterId: charsOf(S.role)[0].id, perks: ['', '', '', ''], buildId: null, buildName: '' };
  }
  return Q[S.role];
}

function matchResultLabel(m) {
  return m.role === 'killer' ? `${m.kills}K` : t(SURV_RESULTS[m.result] || m.result);
}

function renderMatches(root) {
  const q = quickState();
  const filter = S.matchFilter || (S.matchFilter = { role: 'all', q: '' });
  const outcomes = S.role === 'killer'
    ? [0, 1, 2, 3, 4].map((k) => `<button class="outcome ${k >= 3 ? 'win' : 'loss'}" data-out="${k}">${k}K<small>${k === 0 ? t('No kills') : k === 1 ? t('1 kill') : t('{n} kills', { n: k })}</small></button>`).join('')
    : Object.entries(SURV_RESULTS).map(([k, l]) => `<button class="outcome ${SURV_WIN[k] ? 'win' : k === 'dc' ? 'dc' : 'loss'}" data-out="${k}">${t(l)}<small>${{ escaped: t('Through the gates'), hatch: t('Hatch escape'), sacrificed: t('Hooked out'), killed: t('Mori / bled out'), dc: t('Disconnected') }[k]}</small></button>`).join('');

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">${t('Match log')}</div><h1>${t('Log a match')}</h1></div>
      <div class="row">${roleSwitch()}<button class="btn" id="export-csv">${svgIcon('download', 16)}${t('Export CSV')}</button></div>
    </div>
    <div class="glass quick">
      <div class="quick-top">
        <label class="field" style="min-width:220px">${t('Playing as')}${charSelect(S.role, q.characterId, 'q-char')}</label>
        <div>
          <div class="sec-title" style="margin-bottom:6px">${t('Loadout')}${q.buildName ? ` · <span style="color:var(--role)">${esc(q.buildName)}</span>` : ''}</div>
          <div class="q-loadout">${q.perks.map((id) => (id ? miniPerk(id, 44) : `<span data-tip="${t('Empty slot')}">${perkIcon(null, 44)}</span>`)).join('')}
            <button class="btn sm" id="edit-loadout">${svgIcon('edit', 14)}${t('Change')}</button></div>
        </div>
        <button class="btn sm ghost details-toggle" id="toggle-details">${svgIcon('chevron', 14, `style="transform:rotate(${Q.details ? 90 : 0}deg);transition:transform .2s"`)}${t('More details')}</button>
      </div>
      <div class="details-grid" id="details" ${Q.details ? '' : 'hidden'}>
        <label class="field">${t('Realm / map')}<input type="text" id="d-realm" list="realms" placeholder="${t('Optional')}"></label>
        <datalist id="realms">${S.data.realms.map((r) => `<option value="${esc(r)}">`).join('')}</datalist>
        <label class="field">${S.role === 'killer' ? t('Generators left') : t('Generators done')}<select id="d-gens"><option value="">—</option>${[0, 1, 2, 3, 4, 5].map((k) => `<option>${k}</option>`).join('')}</select></label>
        <label class="field">${t('Bloodpoints')}<input type="number" id="d-bp" min="0" step="1000" placeholder="${t('Optional')}"></label>
        <label class="field">${t('Date')}<input type="datetime-local" id="d-date" value="${toLocalInput(Date.now())}"></label>
        <label class="field" style="grid-column:1/-1">${t('Notes')}<input type="text" id="d-notes" placeholder="${t('Optional')}"></label>
      </div>
      <div>
        <div class="sec-title">${t('How did it go?')} <span class="muted" style="letter-spacing:0;text-transform:none;font-family:var(--body);font-weight:400">${t('One click logs it.')}</span></div>
        <div class="outcomes">${outcomes}</div>
      </div>
    </div>

    <div class="row" style="margin:30px 0 14px">
      <h2 style="margin:0">${t('History')}</h2><span class="muted small">${plural(S.matches.length, 'match', 'matches')}</span><span class="spacer"></span>
      <div class="search" style="width:260px">${svgIcon('search', 15)}<input type="search" id="mq" placeholder="${t('Search matches…')}" value="${esc(filter.q)}"></div>
      <div class="seg">${['all', 'killer', 'survivor'].map((r) => `<button data-mr="${r}" class="${filter.role === r ? 'on' : ''}">${t(cap(r))}</button>`).join('')}</div>
    </div>
    <div id="m-list"></div>
  </div>`;

  const drawList = () => {
    const s = filter.q.trim().toLowerCase();
    const rows = S.matches.filter((m) => (filter.role === 'all' || m.role === filter.role) &&
      (!s || `${charName(m.characterId)} ${m.realm} ${m.notes} ${m.perks.map(perkName).join(' ')}`.toLowerCase().includes(s)));
    $('#m-list', root).innerHTML = rows.length ? `<div class="match-list">${rows.slice(0, 300).map((m) => `
      <div class="glass match-row ${isWin(m) ? 'win' : 'loss'}">
        <div class="bar"></div>
        <div class="res">${esc(matchResultLabel(m))}</div>
        <div style="min-width:0"><div style="font-weight:600">${esc(charName(m.characterId))}</div>
          <div class="muted tiny">${esc(new Date(m.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}${m.notes ? ` · ${esc(m.notes)}` : ''}</div></div>
        <div class="mperks">${m.perks.filter(Boolean).map((id) => miniPerk(id, 30)).join('')}</div>
        <div class="small dim">${esc(m.realm || '')}</div>
        <div class="num small dim" style="text-align:right">${m.bp ? `${Number(m.bp).toLocaleString()} BP` : ''}</div>
        <button class="btn sm icon ghost danger del" data-mdel="${m.id}" aria-label="Delete match">${svgIcon('trash', 15)}</button>
      </div>`).join('')}</div>` : emptyState('list', t('No matches yet'), t('Pick how your match went above. It takes one click.'));
  };
  drawList();

  bindRoleSwitch(root);
  $('[name=q-char]', root).onchange = (e) => { q.characterId = e.target.value; q.buildId = null; q.buildName = ''; };
  $('#toggle-details', root).onclick = () => { Q.details = !Q.details; render(); };
  $('#edit-loadout', root).onclick = () => openLoadoutDrawer(q);
  $('#mq', root).oninput = (e) => { filter.q = e.target.value; drawList(); };
  $$('[data-mr]', root).forEach((b) => b.onclick = () => { filter.role = b.dataset.mr; render(); });
  $('#export-csv', root).onclick = exportCsv;
  $('#m-list', root).onclick = async (e) => {
    const id = e.target.closest('[data-mdel]')?.dataset.mdel;
    if (!id) return;
    const idx = S.matches.findIndex((m) => m.id === id);
    const [m] = S.matches.splice(idx, 1);
    await save('matches');
    render();
    toast('Match deleted', { label: t('Undo'), run: async () => { S.matches.splice(idx, 0, m); await save('matches'); render(); } });
  };
  $$('[data-out]', root).forEach((b) => b.onclick = async () => {
    const val = (id) => $(id, root)?.value?.trim() || '';
    const m = {
      id: uid(),
      date: new Date(val('#d-date') || Date.now()).toISOString(),
      role: S.role,
      characterId: q.characterId,
      perks: q.perks.filter(Boolean),
      realm: val('#d-realm'),
      gens: val('#d-gens') === '' ? null : Number(val('#d-gens')),
      bp: val('#d-bp') ? Number(val('#d-bp')) : null,
      notes: val('#d-notes'),
      buildId: q.buildId,
      mode: q.mode || null,
    };
    if (S.role === 'killer') m.kills = Number(b.dataset.out);
    else m.result = b.dataset.out;
    S.matches.unshift(m);
    S.matches.sort((a, c) => c.date.localeCompare(a.date));
    await save('matches');
    render();
    SFX.play('pop');
    toast(t('Logged {result} as {name}', { result: matchResultLabel(m), name: charName(m.characterId) }), {
      label: t('Undo'),
      run: async () => { S.matches = S.matches.filter((x) => x.id !== m.id); await save('matches'); render(); },
    });
    setTimeout(() => checkAchievements(), 2600);
  });
}

function openLoadoutDrawer(q) {
  const builds = S.builds.filter((b) => b.role === S.role);
  openDrawer(`
    ${drawerHead(t('Match log'), t('Loadout'))}
    ${builds.length ? `<div class="drawer-sec"><div class="sec-title">${t('Use a saved build')}</div><div class="stack" style="gap:8px">${builds.map((b) => `
      <button class="btn" style="justify-content:flex-start" data-use="${b.id}">${b.perks.filter(Boolean).map((id) => perkIcon(IDX.perk[id], 24)).join('')}<span style="margin-left:6px">${esc(b.name)}</span></button>`).join('')}</div></div>` : ''}
    <div class="drawer-sec"><div class="sec-title">${t('Or pick perks')}</div>
      <form id="lo-form" class="stack" style="gap:10px">${[0, 1, 2, 3].map((i) => `<label class="field">${t('Perk')} ${i + 1}${perkSelect(S.role, q.perks[i], `perk${i}`)}</label>`).join('')}
        <div class="row"><button type="button" class="btn ghost" id="lo-clear">${t('Clear')}</button><span class="spacer"></span><button class="btn primary" type="submit">${svgIcon('check', 16)}${t('Use these perks')}</button></div>
      </form>
    </div>`, (d) => {
    $$('[data-use]', d).forEach((btn) => btn.onclick = () => {
      const b = S.builds.find((x) => x.id === btn.dataset.use);
      setQuick({ ...b, buildId: b.id });
      closeDrawer();
      render();
    });
    $('#lo-clear', d).onclick = () => { $$('select', d).forEach((s) => { s.value = ''; }); };
    $('#lo-form', d).onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      Object.assign(q, { perks: [0, 1, 2, 3].map((i) => f.get(`perk${i}`)), buildId: null, buildName: '', mode: null });
      closeDrawer();
      render();
    };
  });
}

function exportCsv() {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['date', 'role', 'character', 'result', 'win', 'perk1', 'perk2', 'perk3', 'perk4', 'realm', 'generators', 'bloodpoints', 'notes'];
  const rows = S.matches.map((m) => [m.date, m.role, charName(m.characterId), matchResultLabel(m), isWin(m) ? 'yes' : 'no',
    ...[0, 1, 2, 3].map((i) => (m.perks[i] ? perkName(m.perks[i]) : '')), m.realm, m.gens ?? '', m.bp ?? '', m.notes]);
  const csv = [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  window.api.saveFile({ defaultName: 'xurqxys-matches.csv', content: csv, ext: 'csv' }).then((ok) => ok && toast('CSV exported'));
}

// ---------- Stats & charts ----------
const ST = { range: 'all' };
const CHART_DEFS = `<defs>
  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--role)"/><stop offset="1" style="stop-color:var(--role);stop-opacity:.35"/></linearGradient>
  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--role);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--role);stop-opacity:0"/></linearGradient>
</defs>`;

function barChart(items, { height = 210, width = 560 } = {}) {
  const W = width, H = height, padL = 34, padB = 26, padT = 18;
  // Counts: round the top up to an even number so the midpoint tick is a whole match.
  const rawMax = Math.max(2, ...items.map((i) => i.value));
  const max = rawMax + (rawMax % 2);
  const plotW = W - padL - 8, plotH = H - padB - padT;
  const slot = plotW / items.length;
  const bw = Math.min(54, slot - 2 - slot * 0.3);
  const y = (v) => padT + plotH - (v / max) * plotH;
  const bars = items.map((it, i) => {
    const x = padL + i * slot + (slot - bw) / 2;
    const top = y(it.value);
    const hgt = Math.max(0, padT + plotH - top);
    const r = Math.min(4, hgt, bw / 2);
    const path = hgt > 0 ? `M${x},${padT + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${padT + plotH} Z` : '';
    return `<g data-tip="${esc(it.tip)}">
      <rect x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}" fill="transparent"></rect>
      ${path ? `<path class="mark" d="${path}"></path>` : ''}
      ${it.value ? `<text class="val" x="${x + bw / 2}" y="${top - 6}" text-anchor="middle">${it.value}</text>` : ''}
      <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(it.label)}</text>
    </g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${CHART_DEFS}
    ${[0, max / 2, max].map((t) => `<line class="gridline" x1="${padL}" x2="${W - 8}" y1="${y(t)}" y2="${y(t)}"></line><text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
    ${bars}
  </svg>`;
}

function lineChart(points, { height = 210 } = {}) {
  const W = 560, H = height, padL = 40, padB = 24, padT = 18, padR = 12;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = points.length;
  const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padT + plotH - v * plotH;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(n - 1).toFixed(1)},${padT + plotH} L${x(0).toFixed(1)},${padT + plotH} Z`;
  const colW = n > 1 ? plotW / (n - 1) : plotW;
  const last = points[n - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${CHART_DEFS}
    ${[0, 0.5, 1].map((t) => `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"></line><text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${pct(t)}</text>`).join('')}
    <path class="area" d="${area}"></path>
    <path class="line" d="${d}"></path>
    <circle class="dot" cx="${x(n - 1)}" cy="${y(last.value)}" r="5"></circle>
    <text class="val" x="${x(n - 1) - 8}" y="${y(last.value) - 10}" text-anchor="end">${pct(last.value)}</text>
    <text x="${padL}" y="${H - 6}">Match 1</text><text x="${W - padR}" y="${H - 6}" text-anchor="end">Match ${n}</text>
    ${points.map((p, i) => `<g class="xh" data-tip="${esc(p.tip)}">
      <rect x="${x(i) - colW / 2}" y="${padT}" width="${colW}" height="${plotH}" fill="transparent"></rect>
      <line class="crosshair" x1="${x(i)}" x2="${x(i)}" y1="${padT}" y2="${padT + plotH}" visibility="hidden"></line>
      <circle class="dot" cx="${x(i)}" cy="${y(p.value)}" r="5" visibility="hidden"></circle>
    </g>`).join('')}
  </svg>`;
}

const rateCell = (w, n) => `<div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${n ? (w / n) * 100 : 0}%"></div></div><span class="num small" style="width:38px;text-align:right">${n ? pct(w / n) : '—'}</span></div>`;
const deltaCell = (d) => (d === null ? '<span class="muted">—</span>'
  : `<span class="delta ${d > 0.005 ? 'pos' : d < -0.005 ? 'neg' : ''}">${d > 0.005 ? '▲' : d < -0.005 ? '▼' : '•'} ${Math.abs(Math.round(d * 100))} pts</span>`);

// cols: [{ h: header, num: bool, cell: (row) => html }]
function statTable(rows, cols, rowAttr = () => '') {
  return `<table><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${c.h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr ${rowAttr(r)}>${cols.map((c) => `<td class="${c.num ? 'num' : ''}">${c.cell(r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function renderStats(root) {
  const cutoff = { 7: 7, 30: 30, 90: 90 }[ST.range];
  const since = cutoff ? Date.now() - cutoff * 864e5 : 0;
  const ms = S.matches.filter((m) => m.role === S.role && new Date(m.date).getTime() >= since);
  ST.tab ||= 'overview';
  const tabs = [['overview', t('Overview')], ['perks', t('Perks')], ['maps', t('Maps')], ['chars', S.role === 'killer' ? t('Killers') : t('Survivors')], ['achievements', `🏆 ${t('Achievements')}`]];
  const head = `<div class="page-head">
      <div><div class="eyebrow">${t('Performance')}</div><h1>${t('Stats')}</h1><div class="muted small" style="margin-top:4px">${S.role === 'killer' ? t('A win is 3 or more kills.') : t('A win is an escape, including hatch.')}</div></div>
      <div class="row">${roleSwitch()}
        <div class="seg">${[['7', '7D'], ['30', '30D'], ['90', '90D'], ['all', 'All']].map(([k, l]) => `<button data-range="${k}" class="${ST.range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
    </div>
    <div class="seg stat-tabs">${tabs.map(([k, l]) => `<button data-stab="${k}" class="${ST.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (ST.tab === 'achievements') {
    root.innerHTML = `<div class="page">${head}<div class="stack">${achievementsHtml()}</div></div>`;
    bindStats(root, ms);
    return;
  }
  if (!ms.length) {
    root.innerHTML = `<div class="page">${head}${emptyState('chart', t(S.role === 'killer' ? 'No killer matches here yet' : 'No survivor matches here yet'), t('Log a few matches and your stats show up here.'))}</div>`;
    bindStats(root);
    return;
  }
  const body = { overview: statsOverview, perks: statsPerks, maps: statsMaps, chars: statsChars }[ST.tab](ms);
  root.innerHTML = `<div class="page">${head}<div class="stack">${body}</div></div>`;
  bindStats(root, ms);
}

function statsOverview(ms) {
  const wins = ms.filter(isWin).length;
  const bpList = ms.filter((m) => m.bp);
  const avgBp = bpList.length ? Math.round(bpList.reduce((a, m) => a + m.bp, 0) / bpList.length) : null;
  const chrono = [...ms].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  const lastWin = isWin(chrono[chrono.length - 1]);
  for (let i = chrono.length - 1; i >= 0 && isWin(chrono[i]) === lastWin; i--) streak++;
  let best = 0;
  let run = 0;
  for (const m of chrono) { run = isWin(m) ? run + 1 : 0; best = Math.max(best, run); }
  const kpis = [
    [t('Matches'), ms.length, ST.range === 'all' ? t('all time') : t('last {n} days', { n: ST.range })],
    [t('Win rate'), pct(wins / ms.length), t('{w} won · {l} lost', { w: wins, l: ms.length - wins })],
    S.role === 'killer'
      ? [t('Avg kills'), (ms.reduce((a, m) => a + m.kills, 0) / ms.length).toFixed(2), t('{n} four-kills', { n: ms.filter((m) => m.kills === 4).length })]
      : [t('Escapes'), ms.filter((m) => m.result === 'escaped').length, t('{n} through hatch', { n: ms.filter((m) => m.result === 'hatch').length })],
    [t('Streak'), `${lastWin ? 'W' : 'L'}${streak}`, t('best win streak: {n}', { n: best })],
    [t('Avg Bloodpoints'), avgBp ? avgBp.toLocaleString() : '—', bpList.length ? t('from {n}', { n: plural(bpList.length, 'match', 'matches') }) : t('add BP in More details')],
  ];
  const dist = S.role === 'killer'
    ? [0, 1, 2, 3, 4].map((k) => { const c = ms.filter((m) => m.kills === k).length; return { label: `${k}K`, value: c, tip: `<strong>${k} kills</strong>${plural(c, 'match', 'matches')} · ${pct(c / ms.length)}` }; })
    : Object.entries(SURV_RESULTS).map(([k, l]) => { const c = ms.filter((m) => m.result === k).length; return { label: t(l), value: c, tip: `<strong>${t(l)}</strong>${plural(c, 'match', 'matches')} · ${pct(c / ms.length)}` }; });
  const WINDOW = 10;
  const trend = chrono.map((m, i) => {
    const slice = chrono.slice(Math.max(0, i - WINDOW + 1), i + 1);
    const v = slice.filter(isWin).length / slice.length;
    return { value: v, tip: `<strong>Match ${i + 1}</strong>${esc(charName(m.characterId))} · ${esc(matchResultLabel(m))}<br>Win rate over last ${slice.length}: ${pct(v)}` };
  });
  // Last 10 weeks, oldest first.
  const thisWeek = weekStart(Date.now()).getTime();
  const weeks = Array.from({ length: 10 }, (_, i) => thisWeek - (9 - i) * 7 * 864e5);
  const weekly = weeks.map((w) => {
    const list = ms.filter((m) => { const t = new Date(m.date).getTime(); return t >= w && t < w + 7 * 864e5; });
    const label = new Date(w).toLocaleDateString([], { month: 'short', day: 'numeric' });
    return { label, value: list.length, tip: `<strong>Week of ${label}</strong>${plural(list.length, 'match', 'matches')}${list.length ? ` · ${pct(list.filter(isWin).length / list.length)} win rate` : ''}` };
  });
  return `
    <div class="kpis">${kpis.map(([l, v, sub]) => `<div class="glass kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${sub}</div></div>`).join('')}</div>
    <div class="grid-2">
      <div class="glass panel"><h2>${S.role === 'killer' ? t('Kills per match') : t('Match results')}</h2>${barChart(dist)}</div>
      <div class="glass panel"><h2>${t('Win rate trend')} <span class="muted small" style="font-family:var(--body);font-weight:400">${t('rolling, last {n}', { n: WINDOW })}</span></h2>${lineChart(trend)}</div>
    </div>
    <div class="glass panel"><h2>${t('Matches per week')}</h2>${barChart(weekly, { height: 190, width: 1100 })}</div>`;
}

function statsPerks(allMs) {
  const min = ST.minGames || 1;
  const played = [...new Set(allMs.map((m) => m.characterId))].filter((id) => IDX.char[id]).sort((a, b) => charName(a).localeCompare(charName(b)));
  if (ST.perkChar && !played.includes(ST.perkChar)) ST.perkChar = '';
  const ms = ST.perkChar ? allMs.filter((m) => m.characterId === ST.perkChar) : allMs;
  const total = ms.length;
  const winsAll = ms.filter(isWin).length;
  const byPerk = {};
  for (const m of ms) for (const p of new Set(m.perks)) (byPerk[p] ||= []).push(m);
  const rows = Object.entries(byPerk).map(([id, list]) => {
    const w = list.filter(isWin).length;
    const restN = total - list.length;
    const restW = winsAll - w;
    return { id, name: perkName(id), n: list.length, w, delta: restN ? w / list.length - restW / restN : null };
  }).filter((r) => r.n >= min).sort((a, b) => b.n - a.n || (b.delta ?? 0) - (a.delta ?? 0));
  const pairs = {};
  for (const m of ms) {
    const ps = [...new Set(m.perks)].sort();
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) (pairs[`${ps[i]}|${ps[j]}`] ||= []).push(m);
  }
  const pairRows = Object.entries(pairs).map(([k, list]) => ({ ids: k.split('|'), n: list.length, w: list.filter(isWin).length }))
    .filter((r) => r.n >= Math.max(2, min)).sort((a, b) => b.w / b.n - a.w / a.n || b.n - a.n).slice(0, 12);
  if (!Object.keys(byPerk).length) return emptyState('obsession', t('No perks logged yet'), t('Set your loadout on the Matches page. It is saved with every match you log.'));
  return `
    <div class="row"><span class="muted small">${t('Minimum games')}</span>
      <div class="seg">${[1, 3, 5, 10].map((n) => `<button data-min="${n}" class="${min === n ? 'on' : ''}">${n}+</button>`).join('')}</div>
      ${played.length > 1 ? `<label class="mode-pick perk-char-pick">${svgIcon(S.role === 'killer' ? 'skull' : 'run', 15)}<select id="perk-char"><option value="">${t(S.role === 'killer' ? 'All killers' : 'All survivors')}</option>${played.map((id) => `<option value="${id}" ${ST.perkChar === id ? 'selected' : ''}>${esc(charName(id))}</option>`).join('')}</select></label>` : ''}
      <span class="spacer"></span><span class="muted small">${t('"vs. without" compares your win rate with the perk to your win rate without it.')}</span></div>
    <div class="glass panel table-wrap"><h2>${t('Perk impact')}</h2>
      ${rows.length ? statTable(rows, [
        { h: t('Perk'), cell: (r) => `<div class="row" style="flex-wrap:nowrap;gap:10px">${perkIcon(IDX.perk[r.id], 30)}${esc(r.name)}</div>` },
        { h: t('Games'), num: true, cell: (r) => r.n },
        { h: t('Win rate'), cell: (r) => rateCell(r.w, r.n) },
        { h: t('vs. without'), num: true, cell: (r) => deltaCell(r.delta) },
      ]) : `<p class="muted small">No perk has ${min}+ games yet.</p>`}
    </div>
    <div class="glass panel table-wrap"><h2>${t('Best perk combos')}</h2>
      ${pairRows.length ? statTable(pairRows, [
        { h: t('Combo'), cell: (r) => `<div class="row" style="flex-wrap:nowrap;gap:8px">${r.ids.map((id) => perkIcon(IDX.perk[id], 28)).join('')}<span>${r.ids.map((id) => esc(perkName(id))).join(' + ')}</span></div>` },
        { h: t('Games'), num: true, cell: (r) => r.n },
        { h: t('Win rate'), cell: (r) => rateCell(r.w, r.n) },
      ]) : `<p class="muted small">${t('Play a pair of perks together in at least 2 matches to see combos here.')}</p>`}
    </div>`;
}

function statsMaps(ms) {
  const withMap = ms.filter((m) => m.realm);
  if (!withMap.length) return emptyState('endgame', t('No maps logged yet'), t('Open "More details" when logging a match and pick the realm. Map stats show up here.'));
  const by = {};
  for (const m of withMap) (by[m.realm] ||= []).push(m);
  const rows = Object.entries(by).map(([realm, list]) => {
    const chars = {};
    for (const m of list) (chars[m.characterId] ||= []).push(m);
    const bestChar = Object.entries(chars).map(([id, l]) => ({ id, rate: l.filter(isWin).length / l.length, n: l.length }))
      .sort((a, b) => b.rate - a.rate || b.n - a.n)[0];
    return { realm, n: list.length, w: list.filter(isWin).length, list, bestChar };
  }).sort((a, b) => b.n - a.n);
  return `<div class="glass panel table-wrap"><h2>${t('By map')}</h2>${statTable(rows, [
    { h: t('Realm'), cell: (r) => esc(r.realm) },
    { h: t('Games'), num: true, cell: (r) => r.n },
    { h: t('Win rate'), cell: (r) => rateCell(r.w, r.n) },
    S.role === 'killer'
      ? { h: t('Avg kills'), num: true, cell: (r) => (r.list.reduce((a, m) => a + m.kills, 0) / r.n).toFixed(2) }
      : { h: t('Avg gens'), num: true, cell: (r) => { const g = r.list.filter((m) => m.gens != null); return g.length ? (g.reduce((a, m) => a + m.gens, 0) / g.length).toFixed(1) : '—'; } },
    { h: t(S.role === 'killer' ? 'Best killer' : 'Best survivor'), cell: (r) => `<div class="row" style="flex-wrap:nowrap;gap:8px">${emblem(IDX.char[r.bestChar.id] || { role: S.role, name: '?' }, 26)}${esc(charName(r.bestChar.id))}</div>` },
  ])}<p class="muted small" style="margin-top:10px">${t("{n} matches without a map aren't counted here.", { n: ms.length - withMap.length })}</p></div>`;
}

function statsChars(ms) {
  const by = {};
  for (const m of ms) (by[m.characterId] ||= []).push(m);
  const rows = Object.entries(by).map(([id, list]) => ({
    id, name: charName(id), n: list.length, w: list.filter(isWin).length, list,
    last: list.reduce((a, m) => (m.date > a ? m.date : a), ''),
  })).sort((a, b) => b.n - a.n);
  return `<div class="glass panel table-wrap"><h2>${t(S.role === 'killer' ? 'By killer' : 'By survivor')} <span class="muted small" style="font-family:var(--body);font-weight:400">${t('click a row for details')}</span></h2>${statTable(rows, [
    { h: cap(S.role), cell: (r) => `<div class="row" style="flex-wrap:nowrap;gap:10px">${emblem(IDX.char[r.id] || { role: S.role, name: r.name }, 30)}${esc(r.name)}</div>` },
    { h: t('Games'), num: true, cell: (r) => r.n },
    { h: t('Win rate'), cell: (r) => rateCell(r.w, r.n) },
    S.role === 'killer'
      ? { h: t('Avg kills'), num: true, cell: (r) => (r.list.reduce((a, m) => a + m.kills, 0) / r.n).toFixed(2) }
      : { h: t('Escapes'), num: true, cell: (r) => r.list.filter((m) => m.result === 'escaped' || m.result === 'hatch').length },
    { h: t('Last played'), num: true, cell: (r) => esc(new Date(r.last).toLocaleDateString()) },
  ], (r) => `class="clickable" data-cstat="${r.id}"`)}</div>`;
}

function openCharStats(id, ms) {
  const list = ms.filter((m) => m.characterId === id).sort((a, b) => a.date.localeCompare(b.date));
  const c = IDX.char[id] || { role: S.role, name: charName(id) };
  const w = list.filter(isWin).length;
  const perks = {};
  for (const m of list) for (const p of m.perks) (perks[p] ||= []).push(m);
  const perkRows = Object.entries(perks).map(([pid, l]) => ({ id: pid, n: l.length, w: l.filter(isWin).length })).sort((a, b) => b.n - a.n).slice(0, 8);
  const trend = list.map((m, i) => {
    const slice = list.slice(Math.max(0, i - 4), i + 1);
    const v = slice.filter(isWin).length / slice.length;
    return { value: v, tip: `<strong>Match ${i + 1}</strong>${esc(matchResultLabel(m))}<br>Last ${slice.length}: ${pct(v)}` };
  });
  openDrawer(`
    ${drawerHead(t('Character stats'), '')}
    <div class="detail-hero">${emblem(c, 110)}<h2 style="font-size:22px;margin:4px 0 0">${esc(c.name)}</h2>
      <div class="muted small">${plural(list.length, 'match', 'matches')} · ${pct(w / list.length)} win rate</div></div>
    ${list.length > 1 ? `<div class="drawer-sec"><div class="sec-title">${t('Win rate trend (last 5)')}</div>${lineChart(trend, { height: 160 })}</div>` : ''}
    <div class="drawer-sec"><div class="sec-title">${t('Perks you used')}</div>
      ${perkRows.length ? statTable(perkRows, [
        { h: t('Perk'), cell: (r) => `<div class="row" style="flex-wrap:nowrap;gap:8px">${perkIcon(IDX.perk[r.id], 26)}${esc(perkName(r.id))}</div>` },
        { h: t('Games'), num: true, cell: (r) => r.n },
        { h: t('Win'), num: true, cell: (r) => pct(r.w / r.n) },
      ]) : `<p class="muted small">${t('No perks logged for this character.')}</p>`}
    </div>`);
}

function bindStats(root, ms) {
  bindRoleSwitch(root);
  $$('[data-range]', root).forEach((b) => b.onclick = () => { ST.range = b.dataset.range; render(); });
  $$('[data-stab]', root).forEach((b) => b.onclick = () => { ST.tab = b.dataset.stab; render(); });
  $$('[data-min]', root).forEach((b) => b.onclick = () => { ST.minGames = Number(b.dataset.min); render(); });
  $('#perk-char', root)?.addEventListener('change', (e) => { ST.perkChar = e.target.value; render(); });
  $$('[data-cstat]', root).forEach((tr) => tr.onclick = () => openCharStats(tr.dataset.cstat, ms));
}

// ---------- Settings & data ----------
function renderSettings(root) {
  const ownedSection = (role) => `
    <div class="glass panel">
      <div class="row" style="margin-bottom:12px">
        <h2 style="margin:0">${t(role === 'killer' ? 'Owned killers' : 'Owned survivors')}</h2><span class="muted small">${charsOf(role).filter(isOwned).length}/${charsOf(role).length}</span><span class="spacer"></span>
        <button class="btn sm" data-all="${role}">${t('Select all')}</button><button class="btn sm ghost" data-none="${role}">${t('None')}</button>
      </div>
      <div class="owned-grid">${charsOf(role).map((c) => `<label class="check"><input type="checkbox" data-own="${c.id}" ${isOwned(c) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</div>
    </div>`;
  const editedPerks = Object.keys(S.overrides.perks).length;
  const editedKillers = Object.keys(S.overrides.killers).length;
  root.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">${t('Settings')}</div><h1>${t('Settings &amp; Data')}</h1></div></div>
    <div class="stack">
      <div class="glass panel support-card">
        <div class="support-text">
          <h2 style="margin-bottom:4px">${t('Support & updates')}</h2>
          <p class="muted small" style="margin:0">${t('Xurqxys DBD Tool is free. If it helps you, a coffee keeps it going.')}</p>
          <p class="muted small" style="margin:6px 0 0">${t('Version {v}', { v: esc(S.app?.version || '') })}${S.update?.available ? ` · <b style="color:var(--good)">${esc(t('{v} is available', { v: S.update.latest }))}</b>` : ''}</p>
          ${S.app?.links.repo ? `<p class="muted tiny legal-links" style="margin:6px 0 0">${[['LICENSE.txt', t('License')], ['PRIVACY.md', t('Privacy')], ['THIRD-PARTY-NOTICES.txt', t('Third-party notices')]].map(([f, l]) => `<a href="${S.app.links.repo}/blob/main/${f}" target="_blank" rel="noopener">${l}</a>`).join(' · ')} · ${t('Not affiliated with Behaviour Interactive.')}</p>` : ''}
          ${S.app?.kind === 'portable' ? `<p class="muted tiny" style="margin:6px 0 0">${t('Portable version: it unpacks itself on every start, which takes a few seconds. The Setup version on GitHub installs once and starts instantly.')}</p>` : ''}
        </div>
        <div class="row">
          <a class="btn coffee-btn" href="${S.app?.links.coffee}" target="_blank" rel="noopener"><span aria-hidden="true">☕</span>${t('Buy me a coffee')}</a>
          <a class="btn" href="${S.app?.links.github}" target="_blank" rel="noopener">${githubIcon(16)}GitHub</a>
          ${S.update?.available ? `<button class="btn primary" id="do-update">${svgIcon('download', 16)}${t('Update now')}</button>`
            : `<button class="btn ghost" id="check-update">${svgIcon('undo', 15)}${t('Check for updates')}</button>`}
        </div>
      </div>
      <div class="grid-2">
        <div class="glass panel">
          <h2>${t('Appearance')}</h2>
          <label class="switch"><span class="sw-text">${t('Language')}<small>${t('Perk and character names stay in English so they match the game wiki.')}</small></span>
            <select id="s-lang">${Object.entries(LANGUAGES).map(([k, l]) => `<option value="${k}" ${LANG === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="switch ${S.settings.cpuSaver ? 'disabled' : ''}"><span class="sw-text">${t('Background effects')}<small>${S.settings.cpuSaver ? t('Off while CPU saver is on.') : t('Animated fog and embers. Turn off on slower PCs.')}</small></span><input type="checkbox" id="s-fx" ${fxEnabled() ? 'checked' : ''} ${S.settings.cpuSaver ? 'disabled' : ''}></label>
          <label class="switch"><span class="sw-text">${t('Spin animation')}<small>${t('Slot-machine roll when you spin')}</small></span><input type="checkbox" id="s-anim" ${S.settings.spinAnim !== false ? 'checked' : ''}></label>
          <label class="switch"><span class="sw-text">⚡ ${t('CPU saver')}<small>${t('Turns off background effects and decorative animations. The app already pauses itself while it is in the background.')}</small></span><input type="checkbox" id="s-cpu" ${S.settings.cpuSaver ? 'checked' : ''}></label>
          <label class="switch"><span class="sw-text">🔊 ${t('Sound effects')}<small>${t('Spins, locks, reveals and achievements')}</small></span><input type="checkbox" id="s-sfx" ${S.settings.sfx !== false ? 'checked' : ''}></label>
          <div class="sfx-volume ${S.settings.sfx === false ? 'disabled' : ''}">
            <span class="muted small">${t('Volume')}</span>
            <input type="range" id="s-vol" min="0" max="100" step="5" value="${Math.round((S.settings.sfxVolume ?? 0.5) * 100)}" aria-label="${t('Volume')}" ${S.settings.sfx === false ? 'disabled' : ''}>
            <button class="btn sm ghost" id="s-sfx-test" ${S.settings.sfx === false ? 'disabled' : ''}>${t('Test')}</button>
          </div>
        </div>
        <div class="glass panel">
          <h2>${t('Backup')}</h2>
          <p class="muted small">${t("{matches}, {builds}, owned characters and settings. Restoring replaces what's saved now.", { matches: plural(S.matches.length, 'match', 'matches'), builds: plural(S.builds.length, 'build') })}</p>
          <div class="row"><button class="btn" id="bk-export">${svgIcon('download', 16)}${t('Export backup')}</button><button class="btn" id="bk-import">${svgIcon('upload', 16)}${t('Restore backup')}</button></div>
        </div>
      </div>
      <div class="glass panel">
        <div class="row" style="margin-bottom:6px"><h2 style="margin:0">${t('Official icons')}</h2><span class="spacer"></span><span class="muted small">${iconSummary()}</span></div>
        <p class="muted small">${t('Download the real Dead by Daylight icons from the {wiki}, or load a folder of icon images, such as an icon pack or icons exported from the game. Files are matched by name. Anything without an icon keeps the drawn diamond icon.', { wiki: '<a href="https://deadbydaylight.wiki.gg" target="_blank" style="color:var(--role)">DBD Wiki</a>' })}</p>
        <div class="icon-progress" id="icon-progress" hidden><div class="bar-track"><div class="bar-fill" id="icon-bar" style="width:0"></div></div><span class="small muted" id="icon-pct"></span></div>
        <div class="row">
          <button class="btn primary" id="ic-download">${svgIcon('download', 16)}${iconCount() ? t('Update from DBD Wiki') : t('Download from DBD Wiki')}</button>
          <button class="btn" id="ic-folder">${svgIcon('upload', 16)}${t('Load from folder')}</button>
          ${iconCount() ? `<button class="btn ghost danger" id="ic-clear">${svgIcon('trash', 16)}${t('Remove icons')}</button>` : ''}
        </div>
        ${S.iconError ? `<div class="note" style="margin-top:12px">${svgIcon('info', 16)}<span>Last download failed: ${esc(S.iconError)}. Check your internet connection, or use <b>${t('Load from folder')}</b>.</span></div>` : ''}
        <p class="muted tiny" style="margin-top:10px">${t('Icons and character art © Behaviour Interactive. They\'re downloaded to your PC for personal use and aren\'t included in this free app.')}</p>
      </div>
      <div class="glass panel">
        <h2>${t('Game data')}</h2>
        <p>Dataset <b>${esc(S.data.version || 'custom')}</b> (${esc(S.data.source)}) · ${S.data.perks.length} perks, ${S.data.killers.length} killers, ${S.data.survivors.length} survivors, ${S.data.killers.reduce((n, k) => n + (k.addons || []).length, 0)} killer add-ons.</p>
        <p class="muted small">${S.data.wikiSyncedAt ? t('Add-ons and missing perks last updated from the DBD Wiki on {date}.', { date: new Date(S.data.wikiSyncedAt).toLocaleString() }) : t('Killer add-ons and the newest perks come from the DBD Wiki. They update automatically once a week.')}</p>
        ${S.wikiError ? `<div class="note" style="margin-bottom:10px">${svgIcon('info', 16)}<span>${esc(t('Last update failed: {error}', { error: S.wikiError }))}</span></div>` : ''}
        <p class="muted small">${t('{edits} and {lists} saved. When a new chapter comes out, export the dataset, add the new killers, survivors and perks, then import it back.', { edits: plural(editedPerks, 'perk edit'), lists: plural(editedKillers, 'killer add-on list') })}</p>
        <div class="row">
          <button class="btn primary" id="ds-wiki">${svgIcon('globe', 16)}${t('Update game data from DBD Wiki')}</button>
          <button class="btn" id="ds-export">${svgIcon('download', 16)}${t('Export dataset')}</button>
          <button class="btn" id="ds-import">${svgIcon('upload', 16)}${t('Import dataset')}</button>
          <button class="btn ghost danger" id="ds-reset">${t('Reset to bundled data')}</button>
        </div>
      </div>
      ${ownedSection('killer')}
      ${ownedSection('survivor')}
      <div class="muted tiny" style="text-align:center">${t('Xurqxys DBD Tool is free and fan-made. It is not affiliated with or endorsed by Behaviour Interactive. Dead by Daylight and its art are trademarks and property of Behaviour Interactive.')}</div>
    </div>
  </div>`;

  root.onchange = async (e) => {
    const id = e.target.dataset.own;
    if (!id) return;
    if (e.target.checked) delete S.owned[id]; else S.owned[id] = false;
    await save('owned');
    render();
  };
  $('#s-lang', root).onchange = async (e) => {
    S.settings.lang = e.target.value;
    await save('settings');
    setLanguage(S.settings.lang);
    labelNav();
    render();
  };
  $('#s-fx', root).onchange = async (e) => { S.settings.fx = e.target.checked; await save('settings'); applyFx(); };
  $('#s-anim', root).onchange = async (e) => { S.settings.spinAnim = e.target.checked; await save('settings'); };
  $('#s-cpu', root).onchange = async (e) => { S.settings.cpuSaver = e.target.checked; await save('settings'); applyFx(); render(); };
  $('#s-sfx', root).onchange = async (e) => { S.settings.sfx = e.target.checked; await save('settings'); render(); if (e.target.checked) SFX.preview(); };
  $('#s-vol', root).oninput = (e) => { S.settings.sfxVolume = Number(e.target.value) / 100; };
  $('#s-vol', root).onchange = async () => { await save('settings'); SFX.preview(); };
  $('#s-sfx-test', root).onclick = () => SFX.preview();
  $('#ic-download', root).onclick = () => downloadIcons();
  $('#ic-folder', root).onclick = async () => {
    const r = await window.api.importIcons(iconEntries());
    if (r.canceled) return;
    if (!r.ok) { toast(`Couldn't load icons: ${r.error}`); return; }
    await reloadIcons();
    toast(r.matched ? t('Matched {n} from {m}', { n: plural(r.matched, 'icon'), m: plural(r.scanned, 'image') }) : t('No matching icons in {m}', { m: plural(r.scanned, 'image') }));
    render();
  };
  $('#ic-clear', root)?.addEventListener('click', async () => {
    if (!confirm('Remove all downloaded icons? The app goes back to the drawn icons.')) return;
    await window.api.clearIcons();
    await reloadIcons();
    render();
  });
  $$('[data-all],[data-none]', root).forEach((b) => b.onclick = async () => {
    const role = b.dataset.all || b.dataset.none;
    for (const c of charsOf(role)) { if (b.dataset.all) delete S.owned[c.id]; else S.owned[c.id] = false; }
    await save('owned');
    render();
  });
  $('#ds-wiki', root).onclick = () => syncGameData();
  $('#do-update', root)?.addEventListener('click', () => confirmUpdate());
  $('#check-update', root)?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await checkUpdate();
    if (!S.update?.ok) toast(t("Couldn't check for updates: {error}", { error: S.update?.error || '?' }));
    else if (!S.update.available) toast(t("You're on the latest version"));
    render();
  });
  $('#ds-export', root).onclick = async () => {
    const { source, ...data } = S.data;
    if (await window.api.saveFile({ defaultName: 'xurqxys-dataset.json', content: JSON.stringify(data, null, 2), ext: 'json' })) toast('Dataset exported');
  };
  $('#ds-import', root).onclick = async () => {
    const r = await window.api.importDataset();
    if (r.canceled) return;
    if (!r.ok) { toast(r.error); return; }
    await loadData();
    R.result = null;
    toast('Dataset imported');
    render();
  };
  $('#ds-reset', root).onclick = async () => {
    if (!confirm('Remove the imported dataset and all perk and add-on edits?')) return;
    await window.api.resetDataset();
    S.overrides = { perks: {}, killers: {}, survivors: {} };
    await loadData();
    R.result = null;
    render();
  };
  $('#bk-export', root).onclick = async () => {
    const backup = { app: 'xurqxys-dbd-tool', exportedAt: new Date().toISOString(), matches: S.matches, builds: S.builds, settings: S.settings, owned: S.owned, dataOverrides: S.overrides };
    if (await window.api.saveFile({ defaultName: 'xurqxys-backup.json', content: JSON.stringify(backup, null, 2), ext: 'json' })) toast('Backup exported');
  };
  $('#bk-import', root).onclick = async () => {
    const text = await window.api.openFile({ ext: 'json' });
    if (!text) return;
    let b;
    try { b = JSON.parse(text); } catch { toast('That file is not valid JSON'); return; }
    if (b.app !== 'xurqxys-dbd-tool' || !Array.isArray(b.matches)) { toast('That is not a Xurqxys DBD Tool backup'); return; }
    if (!confirm(`Restore ${plural(b.matches.length, 'match', 'matches')} and ${plural(b.builds?.length || 0, 'build')}? This replaces your current data.`)) return;
    Object.assign(S, { matches: b.matches, builds: b.builds || [], settings: b.settings || {}, owned: b.owned || {}, overrides: b.dataOverrides || S.overrides });
    await Promise.all(['matches', 'builds', 'settings', 'owned', 'dataOverrides'].map(save));
    await loadData();
    applyFx();
    toast('Backup restored');
    render();
  };
}

// ---------- Background embers ----------
const FX = { raf: 0, parts: [] };
// Embers: a pre-rendered glow sprite instead of shadowBlur, half-resolution canvas (they're soft glows anyway), ~30 fps,
// and nothing at all while the window is in the background.
function emberSprite(col) {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(12, 12, 0, 12, 12, 12);
  grad.addColorStop(0, `rgba(${col}, 1)`);
  grad.addColorStop(0.25, `rgba(${col}, 0.8)`);
  grad.addColorStop(1, `rgba(${col}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 24, 24);
  return c;
}

function applyFx() {
  document.body.classList.toggle('cpu-saver', !!S.settings.cpuSaver);
  const on = fxEnabled() && !reducedMotion();
  $('.bg').style.display = on ? '' : 'none';
  cancelAnimationFrame(FX.raf);
  FX.raf = 0;
  FX.on = on;
  if (!on) return;
  const cv = $('#embers');
  const ctx = cv.getContext('2d');
  const resize = () => { cv.width = Math.ceil(innerWidth / 2); cv.height = Math.ceil(innerHeight / 2); };
  resize();
  window.onresize = () => { resize(); placeGlider(); };
  const sprites = { killer: emberSprite('255, 110, 90'), survivor: emberSprite('120, 200, 255') };
  const spawn = () => ({ x: Math.random() * cv.width, y: cv.height + Math.random() * cv.height * 0.5, r: Math.random() * 0.9 + 0.2,
    vy: Math.random() * 0.25 + 0.1, vx: (Math.random() - 0.5) * 0.15, life: Math.random() * 0.6 + 0.4, ph: Math.random() * 6.28 });
  FX.parts = Array.from({ length: 40 }, () => { const p = spawn(); p.y = Math.random() * cv.height; return p; });
  let last = 0;
  FX.step = (now) => {
    FX.raf = requestAnimationFrame(FX.step);
    if (now - last < 33) return;
    const dt = Math.min(3, (now - last) / 16.7);
    last = now;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const sprite = sprites[S.role] || sprites.killer;
    for (const p of FX.parts) {
      p.y -= p.vy * dt;
      p.ph += 0.02 * dt;
      p.x += (p.vx + Math.sin(p.ph) * 0.15) * dt;
      if (p.y < -10) Object.assign(p, spawn());
      ctx.globalAlpha = Math.min(1, p.y / cv.height + 0.2) * p.life * 0.8;
      const size = p.r * 8;
      ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  };
  syncEmbers();
}

// Pause embers and CSS animations whenever the window is minimized, hidden or not focused,
// and the embers alone after a minute without mouse or keyboard input.
const IDLE_MS = 60_000;
let idleTimer = 0;
function syncEmbers() {
  const run = FX.on && FX.step && !document.body.classList.contains('paused') && !FX.idle;
  if (run && !FX.raf) FX.raf = requestAnimationFrame(FX.step);
  if (!run && FX.raf) { cancelAnimationFrame(FX.raf); FX.raf = 0; }
}
function setPaused(paused) {
  document.body.classList.toggle('paused', paused);
  if (!paused) wake();
  syncEmbers();
}
function wake() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { FX.idle = true; syncEmbers(); }, IDLE_MS);
  if (FX.idle) { FX.idle = false; syncEmbers(); }
}
window.addEventListener('blur', () => setPaused(true));
window.addEventListener('focus', () => setPaused(false));
document.addEventListener('visibilitychange', () => setPaused(document.hidden || !document.hasFocus()));
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, wake, { passive: true });
wake();

// Shared tooltip + chart crosshair.
document.addEventListener('mousemove', (e) => {
  const tip = $('#tooltip');
  const target = e.target.closest?.('[data-tip]');
  $$('.xh.active').forEach((g) => { if (g !== target) { g.classList.remove('active'); $$('[visibility]', g).forEach((n) => n.setAttribute('visibility', 'hidden')); } });
  if (!target || !target.dataset.tip) { tip.style.display = 'none'; return; }
  if (target.classList.contains('xh')) {
    target.classList.add('active');
    $$('[visibility]', target).forEach((n) => n.setAttribute('visibility', 'visible'));
  }
  tip.innerHTML = target.dataset.tip;
  tip.style.display = 'block';
  tip.style.left = `${Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8)}px`;
  tip.style.top = `${Math.min(e.clientY + 16, innerHeight - tip.offsetHeight - 8)}px`;
});

// ---------- Router & shell ----------
const VIEWS = { randomizer: renderRandomizer, database: renderDatabase, builds: renderBuilds, matches: renderMatches, stats: renderStats, settings: renderSettings };
const NAV = { randomizer: ['dice', 'Randomize'], database: ['book', 'Perks'], builds: ['layers', 'Builds'], matches: ['list', 'Matches'], stats: ['chart', 'Stats'] };

function render() {
  const root = $('#view');
  const scroll = root.scrollTop;
  root.onclick = null;
  root.onchange = null;
  $('#tooltip').style.display = 'none';
  VIEWS[S.view](root);
  // Re-renders within a page shouldn't replay the entrance animation.
  if (render.last === S.view) $('.page', root)?.style.setProperty('animation', 'none');
  render.last = S.view;
  root.scrollTop = scroll;
  publishStream();
}

function placeGlider() {
  const active = $('#nav button.active');
  const g = $('#glider');
  if (!active) { g.style.opacity = 0; return; }
  g.style.opacity = 1;
  g.style.left = `${active.offsetLeft}px`;
  g.style.width = `${active.offsetWidth}px`;
}

function go(view) {
  closeDrawer();
  S.view = view;
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#settings-btn').classList.toggle('active', view === 'settings');
  placeGlider();
  $('#view').scrollTop = 0;
  render();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawerOpen()) { closeDrawer(); return; }
  if ($('.modal-back') || e.target.closest('input, select, textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const nav = $(`#nav button[data-key="${e.key}"]`);
  if (nav) { go(nav.dataset.view); return; }
  if (S.view !== 'randomizer' || drawerOpen()) return;
  if (e.code === 'Space' && !e.target.closest('button, [data-slot]')) { e.preventDefault(); spinAll(); }
  if (e.key.toLowerCase() === 'f') openFilters();
});

function labelNav() {
  $$('#nav button').forEach((b) => {
    const [icon, label] = NAV[b.dataset.view];
    b.innerHTML = `${svgIcon(icon, 16)}${t(label)}`;
    b.title = `${t(label)} (${b.dataset.key})`;
  });
  $('#settings-btn').title = t('Settings');
  if ($('.tb-coffee-text')) $('.tb-coffee-text').textContent = t('Buy me a coffee');
  requestAnimationFrame(placeGlider);
}

// Phone / browser version (PWA or Android app): no window controls, streamer mode or folder import.
const IS_WEB = ['web', 'android'].includes(window.api.platform);
// Background effects default to off on phones to save battery.
const fxEnabled = () => !S.settings.cpuSaver && (S.settings.fx ?? !IS_WEB) !== false;

function initShell() {
  if (window.api.platform === 'darwin') document.body.classList.add('mac');
  if (IS_WEB) document.body.classList.add('web');
  labelNav();
  $$('#nav button').forEach((b) => { b.onclick = () => go(b.dataset.view); });
  $('#settings-btn').innerHTML = svgIcon('gear', 18);
  $('#github-link').innerHTML = githubIcon(17);
  $('#github-link').href = S.app.links.github;
  $('#coffee-link').href = S.app.links.coffee;
  $('.tb-coffee-text').textContent = t('Buy me a coffee');
  $('#settings-btn').onclick = () => go('settings');
  $('#w-min').innerHTML = svgIcon('min', 14);
  $('#w-max').innerHTML = svgIcon('max', 13);
  $('#w-close').innerHTML = svgIcon('x', 15);
  $('#w-min').onclick = () => window.api.minimize();
  $('#w-max').onclick = () => window.api.toggleMaximize();
  $('#w-close').onclick = () => window.api.close();
  $('.titlebar').ondblclick = (e) => { if (!e.target.closest('button')) window.api.toggleMaximize(); };
  window.api.onWindowState(({ maximized }) => { $('#w-max').innerHTML = svgIcon(maximized ? 'restore' : 'max', 13); });
  $('#scrim').onclick = closeDrawer;
  document.fonts.ready.then(placeGlider);
}

// Respect the t('Spin animation') setting without touching every call site.
const animateSlotsImpl = animateSlots;
// eslint-disable-next-line no-func-assign
animateSlots = (keys, quick) => { if (S.settings.spinAnim !== false) animateSlotsImpl(keys, quick); };

// ---------- Streamer mode ----------
let lastStreamKey = '';
function streamPayload() {
  const res = R.result;
  if (!res) return null;
  const icons = {};
  const addIcon = (k, id) => { const f = S.icons?.[k]?.[id]; if (f) icons[`${k}:${id}`] = f; };
  const perkObj = (id, i) => {
    if (!id) return null;
    if (R.mode === 'mystery' && i >= 0 && !R.revealed.has(`perk${i}`)) return { hidden: true };
    const p = IDX.perk[id];
    addIcon('perk', id);
    return { id, name: p.name, role: p.role, tags: p.tags };
  };
  const charObj = (c) => { addIcon('char', c.id); return { id: c.id, name: c.name, role: c.role }; };
  const out = { role: res.role, modeLabel: R.mode !== 'standard' ? `${modeLabel(R.mode)}${R.mode === 'theme' && R.modeTheme ? `: ${cap(R.modeTheme)}` : ''}` : '' };
  if (R.mode === 'squad' && R.squad) out.squad = R.squad.map((m) => ({ char: charObj(m.char), perks: m.perks.map((id) => perkObj(id, -1)) }));
  else { out.char = charObj(res.char); out.perks = res.perks.map(perkObj); }
  out.ts = JSON.stringify(out);
  out.icons = icons;
  return out;
}

function publishStream() {
  if (!S.stream?.on) return;
  const payload = streamPayload();
  if (!payload || payload.ts === lastStreamKey) return;
  lastStreamKey = payload.ts;
  window.api.publishStream(payload);
}

async function configureStream(patch) {
  if (patch.on) track('streamer');
  S.settings.stream = { ...(S.settings.stream || {}), ...patch };
  await save('settings');
  S.stream = await window.api.configureStream(S.settings.stream);
  lastStreamKey = '';
  publishStream();
}

function revealNext() {
  if (R.mode !== 'mystery' || !R.result) return;
  const i = R.result.perks.findIndex((p, n) => p && !R.revealed.has(`perk${n}`));
  if (i < 0) return;
  R.revealed.add(`perk${i}`);
  SFX.play('reveal');
  if (S.view === 'randomizer') { render(); animateSlots([`perk${i}`], true); } else publishStream();
}

function openStreamDrawer() {
  const st = S.stream || {};
  const cfg = S.settings.stream || {};
  const obsUrl = st.url ? st.url.replace(/bg=[^&]*/, `bg=${cfg.bg || 'transparent'}`) : '';
  openDrawer(`
    ${drawerHead(t('Streaming'), t('Streamer mode'))}
    <div class="drawer-sec">
      <label class="switch"><span class="sw-text">${t('Streamer mode')}<small>${t('Turns on the overlay link and global hotkeys')}</small></span><input type="checkbox" id="st-on" ${st.on ? 'checked' : ''}></label>
      ${st.on ? `<label class="switch"><span class="sw-text">${t('Overlay window')}<small>${t('Floats on top of the game. Use borderless/windowed fullscreen in DBD. Drag it anywhere.')}</small></span><input type="checkbox" id="st-overlay" ${st.overlay ? 'checked' : ''}></label>` : ''}
    </div>
    ${st.on ? `
    <div class="drawer-sec">
      <div class="sec-title">${t('OBS Browser Source')}</div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" readonly value="${esc(obsUrl)}" id="st-url" style="flex:1"><button class="btn" id="st-copy">${svgIcon('copy', 15)}${t('Copy')}</button></div>
      <p class="muted small" style="margin-top:8px">${t('In OBS: {path}, paste the link, size 680 × 180 (horizontal) or 320 × 520 (vertical). It updates live every time you spin.', { path: '<b>Sources → + → Browser</b>' })}</p>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${t('Look')}</div>
      <div class="row" style="margin-bottom:10px"><span class="small dim" style="width:90px">${t('Layout')}</span><div class="seg">${[['h', t('Horizontal')], ['v', t('Vertical')]].map(([k, l]) => `<button data-st-layout="${k}" class="${(cfg.layout || 'h') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="row" style="margin-bottom:6px"><span class="small dim" style="width:90px">${t('Background')}</span><div class="seg">${[['transparent', t('Transparent')], ['green', t('Green screen')], ['dark', t('Dark')]].map(([k, l]) => `<button data-st-bg="${k}" class="${(cfg.bg || 'transparent') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <label class="switch"><span class="sw-text">${t('Show perk names')}</span><input type="checkbox" id="st-names" ${cfg.names !== false ? 'checked' : ''}></label>
    </div>
    <div class="drawer-sec">
      <div class="sec-title">${t('Global hotkeys')} <span class="muted" style="letter-spacing:0;text-transform:none">${t('(work while the game is focused)')}</span></div>
      <div class="hotkeys">
        <div><span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">S</span></div><div>${t('Spin')}</div>
        <div><span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">R</span></div><div>${t('Reveal next perk (Mystery mode)')}</div>
        <div><span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">O</span></div><div>${t('Show / hide overlay window')}</div>
      </div>
      ${st.hotkeyErrors?.length ? `<div class="note" style="margin-top:10px">${svgIcon('info', 15)}<span>Another program already uses ${esc(st.hotkeyErrors.join(', '))}.</span></div>` : ''}
      <p class="muted small" style="margin-top:10px">${t('Tip: use {mode} mode and reveal perks one at a time on stream.', { mode: `<b>${t('Mystery')}</b>` })}</p>
    </div>` : `<p class="muted small">${t('Show your current roll on stream, in OBS or in a small window over the game. Spin and reveal with hotkeys without leaving the game. The tool never touches the game itself.')}</p>`}`, (d) => {
    const apply = async (patch) => { await configureStream(patch); openStreamDrawer(); if (S.view === 'randomizer') render(); };
    $('#st-on', d).onchange = (e) => apply({ on: e.target.checked });
    $('#st-overlay', d)?.addEventListener('change', (e) => apply({ overlay: e.target.checked }));
    $('#st-names', d)?.addEventListener('change', (e) => apply({ names: e.target.checked }));
    $$('[data-st-layout]', d).forEach((b) => b.onclick = () => apply({ layout: b.dataset.stLayout }));
    $$('[data-st-bg]', d).forEach((b) => b.onclick = () => apply({ bg: b.dataset.stBg }));
    $('#st-copy', d)?.addEventListener('click', () => copyText($('#st-url', d).value));
  });
}

// ---------- Official icons ----------
const ICON_KINDS = { perk: t('perks'), char: 'characters', item: 'items', addon: t('add-ons'), offering: 'offerings' };

async function reloadIcons() {
  S.icons = await window.api.getIcons();
  S.iconVer = Date.now();
  iconSrc = (kind, id) => {
    const file = S.icons?.[kind]?.[id];
    if (!file) return null;
    // Mobile links icons straight from the wiki; desktop serves its downloaded copies.
    return /^https?:/.test(file) ? file : `dbdicon://icons/${encodeURIComponent(file)}?v=${S.iconVer}`;
  };
}

const iconCount = () => Object.values(S.icons || {}).reduce((n, m) => n + Object.keys(m).length, 0);
function iconSummary() {
  if (!iconCount()) return t('No official icons yet');
  return Object.entries(ICON_KINDS).map(([k, l]) => `${Object.keys(S.icons[k] || {}).length} ${l}`).join(' · ');
}

// Everything that can have an icon, with the wiki page title / file name to match.
function iconEntries() {
  const out = [];
  const add = (kind, id, title) => out.push({ kind, id, title });
  for (const p of S.data.perks) add('perk', p.id, p.name);
  for (const c of [...S.data.killers, ...S.data.survivors]) add('char', c.id, c.name);
  for (const i of S.data.items) {
    for (const v of i.variants) add('item', slugify(v), v);
    for (const a of i.addons) add('addon', slugify(a), a);
  }
  for (const k of S.data.killers) for (const a of k.addons || []) add('addon', slugify(a.name), a.name);
  const o = S.data.offerings;
  for (const v of [...(o.killer || []), ...(o.survivor || []), ...(o.shared || [])]) add('offering', slugify(v), v);
  return out;
}

// ---------- Links & app updates ----------
async function checkUpdate() {
  S.update = await window.api.checkUpdate();
  const pill = $('#update-pill');
  if (S.update?.available) {
    pill.hidden = false;
    pill.innerHTML = `${svgIcon('download', 13)}${esc(t('Update {v}', { v: S.update.latest }))}`;
    pill.title = t('A new version is available. Click to download it.');
    pill.onclick = () => confirmUpdate();
  } else {
    pill.hidden = true;
  }
}

function confirmUpdate() {
  const u = S.update;
  if (!u?.available) return;
  if (!u.oneClick) { window.api.openExternal(u.url); return; }
  modal(`
    <div class="eyebrow">${t('Update')}</div>
    <h2>${esc(t('Update to {v}?', { v: u.latest }))}</h2>
    <p class="muted small">${t('The new version downloads now, then the app restarts by itself. Your matches, builds and settings are kept.')}</p>
    <div class="icon-progress" id="up-progress" hidden><div class="bar-track"><div class="bar-fill" id="up-bar" style="width:0"></div></div><span class="small muted" id="up-pct"></span></div>
    <div id="up-error"></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px">
      <a class="btn ghost" href="${esc(u.url)}" target="_blank" rel="noopener">${t("What's new")}</a>
      <button class="btn primary" id="up-go">${svgIcon('download', 16)}${t('Update & restart')}</button>
    </div>`, (m) => {
    $('#up-go', m).onclick = async (e) => {
      e.currentTarget.disabled = true;
      $('#up-progress', m).hidden = false;
      const r = await window.api.installUpdate();
      if (r.ok) { $('#up-pct', m).textContent = t('Restarting…'); return; }
      if (r.manual) { window.api.openExternal(r.url); return; }
      $('#up-error', m).innerHTML = `<div class="note" style="margin-top:10px">${svgIcon('info', 15)}<span>${esc(r.error || '?')}</span></div>`;
      e.currentTarget.disabled = false;
    };
  });
}

// ---------- Game data from the DBD Wiki ----------
const WIKI_MAX_AGE = 7 * 864e5;
let wikiSyncRunning = false;
async function syncGameData({ quiet = false } = {}) {
  if (wikiSyncRunning) return false;
  wikiSyncRunning = true;
  const btn = $('#ds-wiki');
  if (btn) btn.disabled = true;
  iconStatus(t('Updating game data…'), 0);
  const r = await window.api.syncWiki();
  wikiSyncRunning = false;
  if (!r.ok) {
    S.wikiError = r.error;
    iconStatus('');
    if (!quiet) toast(t('Couldn\'t update game data: {error}', { error: r.error }));
    if (S.view === 'settings') render();
    return false;
  }
  S.wikiError = null;
  iconStatus('');
  await loadData();
  // Rebuild the current roll so it picks up real add-on names.
  if (R.result) { R.result = null; R.squad = null; }
  toast(t('Game data updated: {addons} add-ons for {killers} killers', { addons: r.addonCount, killers: r.addonKillers }));
  render();
  return true;
}

let iconDownloadRunning = false;
// Small chip in the bottom-left corner while icons or game data download in the background. Errors are shown in Settings.
function iconStatus(label, pctDone) {
  const el = $('#bg-task');
  el.hidden = !label;
  el.innerHTML = label ? `<span class="spinner"></span><span>${esc(label)}</span>${pctDone == null ? '' : `<span class="bt-bar"><i style="width:${pctDone}%"></i></span>`}` : '';
}

// Downloads official icons. quiet = background run at startup (no toast unless it worked).
async function downloadIcons({ quiet = false, onlyMissing = false } = {}) {
  if (iconDownloadRunning) return;
  iconDownloadRunning = true;
  const btn = $('#ic-download');
  if (btn) btn.disabled = true;
  iconStatus(t('Getting DBD icons…'), 0);
  downloadIcons.onProgress = (p) => {
    const pctDone = p.total ? Math.round((p.done / p.total) * 100) : 0;
    iconStatus(t('Getting DBD icons…'), pctDone);
    const box = $('#icon-progress');
    if (box) {
      box.hidden = false;
      $('#icon-bar').style.width = `${pctDone}%`;
      $('#icon-pct').textContent = `${p.done}/${p.total}`;
    }
  };
  const entries = onlyMissing ? iconEntries().filter((e) => !S.icons?.[e.kind]?.[e.id]) : iconEntries();
  if (!entries.length) { iconDownloadRunning = false; iconStatus(''); return; }
  const r = await window.api.downloadIcons(entries);
  iconDownloadRunning = false;
  if (!r.ok) {
    S.iconError = r.error;
    iconStatus('');
    if (!quiet) toast(`Couldn't download icons: ${r.error}`);
    if (S.view === 'settings') render();
    return;
  }
  S.iconError = null;
  iconStatus('');
  await reloadIcons();
  toast(t('Loaded {n} official icons', { n: r.found }));
  render();
}

async function init() {
  const [matches, builds, settings, owned, overrides, progress] = await Promise.all(['matches', 'builds', 'settings', 'owned', 'dataOverrides', 'progress'].map(window.api.get));
  S.progress = { spins: 0, modeSpins: {}, shares: 0, streamer: false, days: [], unlocked: {}, ...(progress || {}) };
  Object.assign(S, { matches, builds, settings, owned, overrides });
  setLanguage(S.settings.lang || detectLanguage());
  await loadData();
  await reloadIcons();
  S.app = await window.api.appInfo();
  window.api.onIconProgress((p) => downloadIcons.onProgress?.(p));
  window.api.onStreamHotkey((action) => {
    if (action === 'spin') { if (S.view === 'randomizer') spinAll(); else { rollAll(); publishStream(); track('spin', { mode: R.mode }); } }
    if (action === 'reveal') revealNext();
  });
  window.api.onStreamChanged((st) => { S.stream = st; if (drawerOpen() && $('#st-on')) openStreamDrawer(); if (S.view === 'randomizer') render(); });
  S.stream = S.settings.stream?.on ? await window.api.configureStream(S.settings.stream) : await window.api.streamStatus();
  initShell();
  setRole('killer');
  applyFx();
  go('randomizer');
  animateSlots(['char', 'perk0', 'perk1', 'perk2', 'perk3', 'addon0', 'addon1', 'offering']);
  // Fetch the official icons automatically until we have them.
  window.api.onWikiProgress((p) => {
    if (wikiSyncRunning) iconStatus(t('Updating game data…'), p.total ? Math.round((p.done / p.total) * 100) : 0);
  });
  // Weekly: refresh add-ons and new perks from the wiki, then fetch any icons still missing.
  const stale = !S.data.wikiSyncedAt || Date.now() - new Date(S.data.wikiSyncedAt).getTime() > WIKI_MAX_AGE;
  window.api.onUpdateProgress((p) => {
    const pctDone = p.total ? Math.round((p.done / p.total) * 100) : 0;
    if ($('#up-bar')) { $('#up-bar').style.width = `${pctDone}%`; $('#up-pct').textContent = `${pctDone}% · ${(p.done / 1048576).toFixed(0)} MB`; }
  });
  setTimeout(checkUpdate, 4000);
  checkAchievements({ silent: true }); // catch up on matches logged before achievements existed
  track('open');
  if (stale) await syncGameData({ quiet: true });
  // First start: fetch every icon. Later only retry the few the wiki didn't have, at most once a week.
  const lastTry = S.settings.iconRetryAt ? new Date(S.settings.iconRetryAt).getTime() : 0;
  if (!iconCount() || stale || Date.now() - lastTry > WIKI_MAX_AGE) {
    S.settings.iconRetryAt = new Date().toISOString();
    save('settings');
    downloadIcons({ quiet: true, onlyMissing: iconCount() > 0 });
  }
}

init();
