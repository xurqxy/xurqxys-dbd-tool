'use strict';
// Prepares the desktop app for packaging: copies it into .build/app and obfuscates every JavaScript file there.
// electron-builder packs .build/app (see "directories.app" in package.json), so the source in the repo stays readable
// while the shipped app is not. Run through `npm run dist:win`.
const fs = require('fs');
const path = require('path');
const { obfuscateFile } = require('./obfuscate');

const ROOT = path.join(__dirname, '..');
const STAGE = path.join(ROOT, '.build', 'app');
const pkg = require('../package.json');

const MAIN_FILES = ['main.js', 'preload.js', 'icon-store.js', 'wiki-core.js', 'wiki-sync.js', 'streamer.js', 'updater.js'];
const COPY = [...MAIN_FILES, 'data', 'src', 'build/icon.png'];

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });
for (const rel of COPY) {
  const from = path.join(ROOT, rel);
  const to = path.join(STAGE, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

// Only what the running app needs from package.json (no scripts, build config or dev tools).
const appPkg = {};
for (const key of ['name', 'productName', 'version', 'description', 'author', 'license', 'homepage', 'main', 'repository', 'releasesRepo']) {
  if (pkg[key] !== undefined) appPkg[key] = pkg[key];
}
fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify(appPkg, null, 2));

let count = 0;
for (const f of MAIN_FILES) { obfuscateFile(path.join(STAGE, f)); count++; }
for (const f of fs.readdirSync(path.join(STAGE, 'data')).filter((x) => x.endsWith('.js'))) { obfuscateFile(path.join(STAGE, 'data', f)); count++; }
for (const f of fs.readdirSync(path.join(STAGE, 'src')).filter((x) => x.endsWith('.js'))) { obfuscateFile(path.join(STAGE, 'src', f), { renderer: true }); count++; }
console.log(`protected ${count} files in ${path.relative(ROOT, STAGE)}`);
