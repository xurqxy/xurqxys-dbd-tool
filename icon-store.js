'use strict';
// Official DBD icons: downloaded from the DBD Wiki or imported from a local folder,
// cached in the user's data folder and served to the page through the dbdicon:// protocol.
const fs = require('fs');
const path = require('path');
const { net } = require('electron');
const core = require('./wiki-core');

const { normalize } = core;

const CONCURRENCY = 6;     // parallel image downloads
const IMAGE_EXT = /\.(png|webp|jpe?g)$/i;
const UA = 'XurqxysDBDTool/1.6 (free fan-made desktop app)';
core.configure({ fetch: (...a) => net.fetch(...a), headers: { 'User-Agent': UA } });

let dir;
let manifestPath;
let manifest = {};          // kind -> { id: filename }

function init(userData) {
  dir = path.join(userData, 'icons');
  fs.mkdirSync(dir, { recursive: true });
  manifestPath = path.join(dir, 'manifest.json');
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    manifest = {};
  }
}

function saveManifest() {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function setIcon(kind, id, file) {
  (manifest[kind] ||= {})[id] = file;
}

function filePathFor(name) {
  // basename() keeps requests inside the icon folder.
  return path.join(dir, path.basename(name));
}

const getManifest = () => manifest;

function clear() {
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  manifest = {};
}

async function downloadTo(url, file) {
  const res = await net.fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error('Empty image');
  fs.writeFileSync(file, buf);
}

// entries: [{ kind, id, title }]
async function downloadFromWiki(entries, onProgress) {
  const urls = await core.resolveIcons(entries);
  const jobs = entries.filter((e) => urls.has(`${e.kind}:${e.id}`));
  let done = 0;
  let failed = 0;
  onProgress({ done, total: jobs.length });
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const e = queue.shift();
      const url = urls.get(`${e.kind}:${e.id}`);
      const ext = (url.split('?')[0].match(IMAGE_EXT) || ['.png'])[0].toLowerCase();
      const name = `${e.kind}-${e.id}${ext}`;
      try {
        await downloadTo(url, filePathFor(name));
        setIcon(e.kind, e.id, name);
      } catch {
        failed++;
      }
      done++;
      onProgress({ done, total: jobs.length });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveManifest();
  return { found: jobs.length - failed, missing: entries.length - jobs.length, failed };
}

function listImages(root, out = [], depth = 0) {
  if (depth > 6) return out;
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) listImages(full, out, depth + 1);
    else if (IMAGE_EXT.test(ent.name)) out.push(full);
  }
  return out;
}

// Match image files to entries by name. Characters also match portraits like
// "K01_TheTrapper_Portrait.png" or "S01_DwightFairfield_Portrait.png".
function importFolder(root, entries) {
  const files = listImages(root).map((f) => ({ f, key: normalize(path.basename(f)) }));
  const byKey = new Map(files.map((x) => [x.key, x.f]));
  let matched = 0;
  for (const e of entries) {
    const keys = [normalize(e.title), normalize(e.title.replace(/^The\s+/i, ''))];
    let file = keys.map((k) => byKey.get(k)).find(Boolean);
    if (!file && e.kind === 'char') {
      file = files.find((x) => keys.some((k) => k.length > 3 && x.key.includes(k)))?.f;
    }
    if (!file) continue;
    const name = `${e.kind}-${e.id}${path.extname(file).toLowerCase()}`;
    fs.copyFileSync(file, filePathFor(name));
    setIcon(e.kind, e.id, name);
    matched++;
  }
  saveManifest();
  return { matched, scanned: files.length };
}

module.exports = { init, getManifest, clear, downloadFromWiki, importFolder, filePathFor };
