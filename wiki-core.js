'use strict';
// MediaWiki helpers shared by the desktop app (Node/Electron) and the mobile app (browser / Capacitor):
// queries with continuation, icon matching, name normalization. No Node or Electron APIs in here.

const ENV_API = typeof process !== 'undefined' && process.env ? process.env.XURQXYS_WIKI_API : '';
// Primary wiki first, Fandom mirror as a fallback. XURQXYS_WIKI_API overrides both (used for testing).
const WIKI_APIS = ENV_API ? ENV_API.split(',') : ['https://deadbydaylight.wiki.gg/api.php', 'https://deadbydaylight.fandom.com/api.php'];
const BATCH = 40;          // titles per wiki API request

// The platform plugs in its fetch (Electron's net.fetch on desktop, window.fetch on mobile).
// cors: add origin=* so the wiki allows the request from a web page.
const cfg = { fetch: (...a) => fetch(...a), headers: {}, cors: false };
// apis replaces the wiki list in place (wiki-sync.js holds a reference to WIKI_APIS).
function configure({ apis, ...options }) {
  Object.assign(cfg, options);
  if (apis?.length) WIKI_APIS.splice(0, WIKI_APIS.length, ...apis);
}

function apiUrl(api, params) {
  return `${api}?${new URLSearchParams({ format: 'json', formatversion: '2', ...(cfg.cors ? { origin: '*' } : {}), ...params })}`;
}

async function fetchJson(url) {
  const res = await cfg.fetch(url, { headers: cfg.headers });
  if (!res.ok) throw new Error(`Wiki returned HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error('Wiki returned a web page instead of data (it may be blocking the request)');
  return res.json();
}

// Which files on a wiki page are the icon for each kind of entry.
const FILE_PATTERNS = {
  perk: /^(file:)?icon[ _]?perks?[ _]/i,
  item: /^(file:)?icon[ _]?items?[ _]/i,
  addon: /^(file:)?icon[ _]?add-?ons?[ _]/i,
  offering: /^(file:)?icon[ _]?(favors?|offerings?)[ _]/i,
  char: /^(file:)?[KS]\d+[ _].*portrait/i,
};

// Runs a MediaWiki query, following "continue" and merging page results by title.
async function query(api, params) {
  const pages = new Map();
  const alias = new Map();
  let cont = {};
  for (let guard = 0; guard < 20; guard++) {
    const json = await fetchJson(apiUrl(api, { action: 'query', ...params, ...cont }));
    const q = json.query || {};
    for (const n of q.normalized || []) alias.set(n.to, alias.get(n.from) || n.from);
    for (const r of q.redirects || []) alias.set(r.to, alias.get(r.from) || r.from);
    for (const page of q.pages || []) {
      // Continuation pages return more items for the same page: merge the lists, not replace them.
      const prev = pages.get(page.title) || {};
      const merged = { ...prev, ...page };
      for (const key of ['images', 'links', 'categories']) merged[key] = [...(prev[key] || []), ...(page[key] || [])];
      pages.set(page.title, merged);
    }
    if (!json.continue) break;
    cont = json.continue;
  }
  // Key results by the title we originally asked for.
  const byAsked = new Map();
  for (const [title, page] of pages) byAsked.set(alias.get(title) || title, page);
  return byAsked;
}

function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) || 0) + 1);
  return out;
}
function similarity(a, b) {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let hit = 0;
  for (const [k, n] of A) hit += Math.min(n, B.get(k) || 0);
  return (2 * hit) / Math.max(1, a.length - 1 + b.length - 1);
}

// Pick the file on a page that best matches the entry, e.g. "File:IconPerks_hexRuin.png" for "Hex: Ruin".
function pickFile(entry, files) {
  const candidates = files.filter((f) => FILE_PATTERNS[entry.kind].test(f));
  if (!candidates.length) return null;
  const want = normalize(entry.title.replace(/^The\s+/i, ''));
  let best = null;
  let bestScore = -1;
  for (const f of candidates) {
    const key = normalize(f.replace(/^file:/i, '').replace(/^[KS]\d+[ _]/i, '').replace(/[ _]portrait.*$/i, ''));
    const score = similarity(want, key.replace(/^the/, ''));
    if (score > bestScore) { best = f; bestScore = score; }
  }
  // A page that links many icons (e.g. related perks) needs a reasonably close name.
  return candidates.length === 1 || bestScore >= 0.5 ? best : null;
}

// Finds an image URL for each entry on one wiki. Returns Map(entry key -> URL).
async function resolveOnWiki(api, entries) {
  const found = new Map();
  const titles = [...new Set(entries.map((e) => e.title))];
  const pages = new Map();
  for (let i = 0; i < titles.length; i += BATCH) {
    const res = await query(api, {
      titles: titles.slice(i, i + BATCH).join('|'), redirects: '1',
      prop: 'images|pageimages', imlimit: 'max', piprop: 'thumbnail', pithumbsize: '256', pilimit: String(BATCH),
    });
    for (const [t, page] of res) pages.set(t, page);
  }
  const chosen = new Map(); // entry key -> file title
  for (const e of entries) {
    const page = pages.get(e.title);
    if (!page || page.missing) continue;
    const file = pickFile(e, (page.images || []).map((im) => im.title));
    if (file) chosen.set(`${e.kind}:${e.id}`, file);
    else if (page.thumbnail?.source) found.set(`${e.kind}:${e.id}`, page.thumbnail.source);
  }
  const files = [...new Set(chosen.values())];
  const urls = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const res = await query(api, { titles: files.slice(i, i + 50).join('|'), prop: 'imageinfo', iiprop: 'url', iiurlwidth: '256' });
    for (const [t, page] of res) {
      const info = page.imageinfo?.[0];
      if (info) urls.set(t, info.thumburl || info.url);
    }
  }
  for (const [key, file] of chosen) if (urls.has(file)) found.set(key, urls.get(file));
  return found;
}

// "IconPerks_barbecueAndChilli.png" and "Barbecue & Chilli" both become "barbecueandchilli".
function normalize(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\.(png|webp|jpe?g)$/i, '')
    .replace(/^file:/i, '')
    .replace(/^(icon[_\s]?perks?|icon[_\s]?add-?ons?|icon[_\s]?items?|icon[_\s]?favors?|icon[_\s]?offerings?|iconhelp|t_ui_)[_\s-]*/i, '')
    .replace(/&/g, 'and')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Finds icon URLs for entries on every wiki in turn. Returns Map("kind:id" -> URL).
async function resolveIcons(entries) {
  const urls = new Map();
  const errors = [];
  let remaining = entries;
  for (const api of WIKI_APIS) {
    if (!remaining.length) break;
    try {
      const found = await resolveOnWiki(api, remaining);
      for (const [k, v] of found) urls.set(k, v);
      remaining = remaining.filter((e) => !urls.has(`${e.kind}:${e.id}`));
    } catch (err) {
      errors.push(`${new URL(api).host}: ${err.message}`);
    }
  }
  if (!urls.size) throw new Error(errors.join('; ') || 'No icons found on the wiki');
  return urls;
}

module.exports = { WIKI_APIS, configure, apiUrl, fetchJson, query, normalize, resolveIcons };
