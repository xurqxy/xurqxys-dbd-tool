'use strict';
// Pulls game data that changes every patch from the DBD Wiki (MediaWiki API), on the user's PC:
//  - every killer's add-ons with their rarity
//  - perks still missing from the bundled data, with their owner
//  - descriptions for perks that don't have one yet
// It only relies on standard MediaWiki features (categories, links, redirects, extracts),
// not on page layout, so small wiki redesigns don't break it.
const { query, fetchJson, apiUrl, WIKI_APIS, normalize } = require('./wiki-core');

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Ultra Rare', 'Visceral', 'Event'];
const PERK_CATEGORIES = ['Category:Perks', 'Category:Killer Perks', 'Category:Survivor Perks', 'Category:Unique Perks'];
const SKIP_ADDON = /retired|unused|removed|cut content/i;

async function categoryMembers(api, title) {
  const out = [];
  let cont = {};
  for (let guard = 0; guard < 30; guard++) {
    const json = await fetchJson(apiUrl(api, { action: 'query', list: 'categorymembers', cmtitle: title, cmlimit: '500', cmnamespace: '0', ...cont }));
    out.push(...(json.query?.categorymembers || []).map((m) => m.title));
    if (!json.continue) break;
    cont = json.continue;
  }
  return out;
}

async function pagesInfo(api, titles, params) {
  const all = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const res = await query(api, { titles: titles.slice(i, i + 50).join('|'), redirects: '1', ...params });
    for (const [k, v] of res) all.set(k, v);
  }
  return all;
}

const shortName = (name) => name.replace(/^The\s+/i, '');

function guessTags(name, desc) {
  const t = `${name} ${desc}`.toLowerCase();
  const tags = [];
  const add = (tag, re) => { if (re.test(t)) tags.push(tag); };
  add('hex', /^hex:|\bhex\b/);
  add('boon', /^boon:|\bboon\b/);
  add('scourge', /scourge hook/);
  add('aura', /aura/);
  add('gen', /generator/);
  add('heal', /\bheal/);
  add('haste', /haste/);
  add('exhaustion', /exhaust/);
  add('totem', /totem/);
  add('chest', /chest/);
  add('locker', /locker/);
  add('stealth', /undetectable|scratch marks|silent/);
  add('altruism', /^teamwork|unhook/);
  add('exposed', /exposed/);
  add('blind', /blind/);
  return [...new Set(tags)];
}

// data: the dataset the app currently uses. onProgress({ step, done, total }).
async function syncOnWiki(api, data, onProgress) {
  const result = { api, fetchedAt: new Date().toISOString(), addons: {}, perks: [], descs: {} };

  // 1. Add-on titles and rarities from the rarity categories.
  onProgress({ step: 'addons', done: 0, total: 3 });
  const rarityOf = new Map();
  for (const r of RARITIES) {
    for (const title of await categoryMembers(api, `Category:${r} Add-ons`)) if (!rarityOf.has(title)) rarityOf.set(title, r);
  }
  if (!rarityOf.size) throw new Error('No add-on categories found on the wiki');

  // 2. Every name a killer goes by: "The Trapper", "Trapper", the power, and the wiki's page title.
  const killerPages = await pagesInfo(api, data.killers.map((k) => k.name), {});
  const killerKeys = data.killers.map((k) => {
    const keys = new Set([normalize(k.name), normalize(shortName(k.name))]);
    if (k.power) keys.add(normalize(k.power));
    const page = killerPages.get(k.name);
    if (page && !page.missing) keys.add(normalize(page.title));
    return { k, keys, short: normalize(shortName(k.name)), power: k.power ? normalize(k.power) : null };
  });

  // 3. Each add-on page's links and categories decide which killer it belongs to.
  onProgress({ step: 'addons', done: 1, total: 3 });
  const addonPages = await pagesInfo(api, [...rarityOf.keys()], { prop: 'links|categories', plnamespace: '0', pllimit: 'max', cllimit: 'max' });
  onProgress({ step: 'addons', done: 2, total: 3 });
  const assign = () => {
    const out = {};
    for (const [title, page] of addonPages) {
      const cats = (page.categories || []).map((c) => c.title);
      if (cats.some((c) => SKIP_ADDON.test(c))) continue;
      const links = new Set((page.links || []).map((l) => normalize(l.title)));
      const catKeys = new Set(cats.map((c) => normalize(c.replace(/^Category:/i, ''))));
      const catText = [...catKeys].join(' ');
      let best = null;
      let bestScore = 0;
      let tie = false;
      for (const kk of killerKeys) {
        let linked = 0;
        for (const key of kk.keys) if (links.has(key)) linked += 3;
        // "Category:Bear Trap Add-ons" / "Category:Trapper Add-ons" name the owner exactly.
        const exactCat = [...kk.keys].some((key) => catKeys.has(`${key}addons`)) ? 2 : 0;
        const powerCat = kk.power && kk.power.length > 3 && catText.includes(kk.power) ? 2 : 0;
        // A short name inside a longer category only breaks ties: names like "First" are too common alone.
        const shortCat = kk.short.length > 3 && catText.includes(kk.short) ? 1 : 0;
        if (!linked && !exactCat && !powerCat) continue;
        const score = linked + exactCat + powerCat + shortCat;
        if (score > bestScore) { best = kk; bestScore = score; tie = false; } else if (score === bestScore) tie = true;
      }
      if (best && !tie) (out[best.k.id] ||= []).push({ name: title, rarity: rarityOf.get(title), links: [...links] });
    }
    return out;
  };

  // Pass 1, then learn each killer's power page: a link shared by several of its add-ons
  // that no other killer's add-ons use. Pass 2 then catches add-ons that only link the power.
  let assigned = assign();
  const linkOwners = new Map();
  for (const [kid, list] of Object.entries(assigned)) for (const a of list) for (const l of a.links) {
    if (!linkOwners.has(l)) linkOwners.set(l, new Map());
    const m = linkOwners.get(l);
    m.set(kid, (m.get(kid) || 0) + 1);
  }
  let learned = 0;
  for (const kk of killerKeys) {
    let bestLink = null;
    let bestCount = 2;
    for (const [l, m] of linkOwners) {
      if (m.size !== 1 || !m.has(kk.k.id) || kk.keys.has(l)) continue;
      if (m.get(kk.k.id) > bestCount) { bestLink = l; bestCount = m.get(kk.k.id); }
    }
    if (bestLink) { kk.keys.add(bestLink); learned++; }
  }
  if (learned) assigned = assign();
  for (const [kid, list] of Object.entries(assigned)) result.addons[kid] = list.map(({ name, rarity }) => ({ name, rarity }));
  for (const list of Object.values(result.addons)) {
    list.sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.name.localeCompare(b.name));
  }
  onProgress({ step: 'addons', done: 3, total: 3 });

  // 4. Missing unique perks: perks the character's page links to that link back to the character.
  const known = new Set(data.perks.map((p) => normalize(p.name)));
  const chars = [...data.killers.map((c) => ({ ...c, role: 'killer' })), ...data.survivors.map((c) => ({ ...c, role: 'survivor' }))];
  const incomplete = chars.filter((c) => (c.perks || []).length < 3);
  if (incomplete.length) {
    onProgress({ step: 'perks', done: 0, total: incomplete.length });
    const perkTitles = new Set();
    for (const cat of PERK_CATEGORIES) for (const tt of await categoryMembers(api, cat)) perkTitles.add(tt);
    const charPages = await pagesInfo(api, incomplete.map((c) => c.name), { prop: 'links', plnamespace: '0', pllimit: 'max' });
    let n = 0;
    for (const c of incomplete) {
      const page = charPages.get(c.name);
      const candidates = (page?.links || []).map((l) => l.title).filter((tt) => perkTitles.has(tt) && !known.has(normalize(tt)));
      if (candidates.length) {
        const perkPages = await pagesInfo(api, candidates, { prop: 'links', plnamespace: '0', pllimit: 'max' });
        const charKeys = new Set([normalize(c.name), normalize(shortName(c.name)), page && !page.missing ? normalize(page.title) : '']);
        const owned = candidates.filter((tt) => (perkPages.get(tt)?.links || []).some((l) => charKeys.has(normalize(l.title))));
        for (const name of owned.slice(0, 3 - c.perks.length)) {
          result.perks.push({ name, owner: c.name, role: c.role, desc: '', tags: [] });
          known.add(normalize(name));
        }
      }
      onProgress({ step: 'perks', done: ++n, total: incomplete.length });
    }
  }

  // 5. Descriptions for perks that don't have one (TextExtracts allows 20 intros per request).
  const needDesc = [...data.perks.filter((p) => !p.desc).map((p) => p.name), ...result.perks.map((p) => p.name)];
  onProgress({ step: 'descriptions', done: 0, total: needDesc.length });
  for (let i = 0; i < needDesc.length; i += 20) {
    try {
      const res = await query(api, { titles: needDesc.slice(i, i + 20).join('|'), redirects: '1', prop: 'extracts', exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20' });
      for (const [title, page] of res) {
        const text = (page.extract || '').replace(/\s+/g, ' ').trim();
        if (text) result.descs[normalize(title)] = text.length > 260 ? `${text.slice(0, 257)}…` : text;
      }
    } catch {
      break; // extracts not available on this wiki; keep the names without descriptions
    }
    onProgress({ step: 'descriptions', done: Math.min(i + 20, needDesc.length), total: needDesc.length });
  }
  for (const p of result.perks) {
    p.desc = result.descs[normalize(p.name)] || '';
    p.tags = guessTags(p.name, p.desc);
  }
  return result;
}

async function syncFromWiki(data, onProgress = () => {}) {
  const errors = [];
  for (const api of WIKI_APIS) {
    try {
      return await syncOnWiki(api, data, onProgress);
    } catch (err) {
      errors.push(`${new URL(api).host}: ${err.message}`);
    }
  }
  throw new Error(errors.join('; '));
}

// Applies synced wiki data on top of a dataset (before the user's own edits).
function applyWikiData(data, wiki, slug) {
  if (!wiki) return data;
  for (const k of data.killers) {
    const list = wiki.addons?.[k.id];
    if (list?.length >= 2) k.addons = list;
  }
  const byName = new Map([...data.killers, ...data.survivors].map((c) => [c.name, c]));
  const have = new Set(data.perks.map((p) => p.id));
  for (const p of wiki.perks || []) {
    const id = slug(p.name);
    const owner = byName.get(p.owner);
    if (have.has(id) || !owner) continue;
    data.perks.push({ id, name: p.name, role: p.role, owner: p.owner, tags: p.tags || [], desc: p.desc || '', fromWiki: true });
    owner.perks = [...(owner.perks || []), id];
    have.add(id);
  }
  for (const p of data.perks) {
    if (!p.desc) {
      const d = wiki.descs?.[normalize(p.name)];
      if (d) { p.desc = d; if (!p.tags?.length) p.tags = guessTags(p.name, d); }
    }
  }
  return data;
}

module.exports = { syncFromWiki, applyWikiData, RARITIES };
