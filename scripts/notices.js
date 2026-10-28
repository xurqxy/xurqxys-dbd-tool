'use strict';
// Regenerates THIRD-PARTY-NOTICES.txt from the license files of the components the app ships with.
// Run after updating Electron, Capacitor or the fonts: node scripts/notices.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').trim();
const ver = (pkg) => require(path.join(ROOT, 'node_modules', pkg, 'package.json')).version;
const line = '-'.repeat(78);

const parts = [
  `THIRD-PARTY NOTICES for Xurqxys DBD Tool

Xurqxys DBD Tool includes the open-source components listed below. Each remains under its own
license, reproduced here. These licenses apply to those components only, not to the rest of the app
(see LICENSE.txt).`,
  `Electron ${ver('electron')} (Windows app) - MIT License
https://github.com/electron/electron

${read('node_modules/electron/dist/LICENSE')}`,
  `Chromium and Node.js (part of Electron, Windows app) - BSD-style, MIT and other open-source licenses
The full list of licenses for Chromium and its dependencies is in the file LICENSES.chromium.html,
installed next to the app (in the same folder as "Xurqxys DBD Tool.exe").`,
  `Capacitor ${ver('@capacitor/core')} and plugins @capacitor/app, @capacitor/share, @capacitor/filesystem
(Android app) - MIT License
https://github.com/ionic-team/capacitor

${read('node_modules/@capacitor/core/LICENSE')}`,
  `Inter font (https://github.com/rsms/inter) - SIL Open Font License 1.1

${read('src/fonts/OFL-Inter.txt')}`,
  `Oxanium font (https://github.com/sevmeyer/oxanium) - SIL Open Font License 1.1

${read('src/fonts/OFL-Oxanium.txt')}`,
];
// Plain ASCII so it shows correctly everywhere (installer pages, Notepad).
const text = parts.join(`\n\n${line}\n\n`).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x00-\x7F]/g, '');
fs.writeFileSync(path.join(ROOT, 'THIRD-PARTY-NOTICES.txt'), `${text}\n`);
console.log(`THIRD-PARTY-NOTICES.txt written (${text.length} chars)`);
