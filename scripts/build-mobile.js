'use strict';
// Builds the mobile app into dist-mobile/: the same renderer as the desktop app (src/), plus mobile/web-api.js
// in place of Electron's preload. dist-mobile/ is both the PWA (GitHub Pages) and the Android app's web content.
//   node scripts/build-mobile.js            protected build (obfuscated), used for releases
//   node scripts/build-mobile.js --dev      readable build for debugging
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { obfuscateFile } = require('./obfuscate');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, process.env.MOBILE_OUT || 'dist-mobile');
const DEV = process.argv.includes('--dev');
const pkg = require('../package.json');
// Releases (updates, APK) come from releasesRepo when the source repo is private, otherwise from the source repo.
const REPO = pkg.releasesRepo || (pkg.repository?.url || '').match(/github\.com\/([^/]+\/[^/.]+)/)?.[1] || '';
const RENDERER = ['i18n.js', 'icons.js', 'sounds.js', 'achievements.js', 'share.js', 'app.js'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(ROOT, 'mobile/web-api.js')],
  outfile: path.join(OUT, 'web-api.js'),
  bundle: true,
  format: 'iife',
  target: ['chrome90', 'safari15'],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __REPO__: JSON.stringify(REPO), __WIKI_API__: JSON.stringify(process.env.XURQXYS_WIKI_API || '') },
  minify: !DEV,
  legalComments: 'none',
  logLevel: 'warning',
});

for (const f of [...RENDERER, 'styles.css', 'logo.svg']) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(OUT, f));
fs.cpSync(path.join(ROOT, 'src/fonts'), path.join(OUT, 'fonts'), { recursive: true });
fs.cpSync(path.join(ROOT, 'mobile/icons'), path.join(OUT, 'icons'), { recursive: true });
for (const f of ['LICENSE.txt', 'THIRD-PARTY-NOTICES.txt']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));

let html = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
// Production only talks to the wiki and GitHub over https. A dev/test wiki (XURQXYS_WIKI_API) is usually http, so
// allow http there; this never affects release builds, which don't set that variable.
const devWiki = process.env.XURQXYS_WIKI_API ? ' http:' : '';
const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:${devWiki}; connect-src 'self' https:${devWiki}; font-src 'self'; worker-src 'self'`;
html = html
  .replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#07060a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="DBD Tool">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icons/icon-192.png">
  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`)
  .replace('<script src="i18n.js"></script>', '<script src="web-api.js"></script>\n  <script src="i18n.js"></script>');
if (!html.includes('web-api.js') || !html.includes('manifest.webmanifest')) throw new Error('index.html template changed: update build-mobile.js');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: "Xurqxys DBD Tool",
  short_name: 'DBD Tool',
  description: 'Dead by Daylight build randomizer, perk database and match tracker.',
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#07060a',
  theme_color: '#07060a',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

if (!DEV) for (const f of [...RENDERER, 'web-api.js']) obfuscateFile(path.join(OUT, f), { renderer: true });

// Service worker: keeps the app working offline. A new version gets a new cache name, so phones pick up updates.
const files = [];
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (!/\.txt$/.test(ent.name)) files.push(path.relative(OUT, full).split(path.sep).join('/'));
  }
}(OUT));
const sw = `'use strict';
const CACHE = 'xq-${pkg.version}-${Date.now().toString(36)}';
const FILES = ${JSON.stringify(['./', ...files])};
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // wiki and GitHub requests go straight to the network
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
`;
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
console.log(`mobile app built in ${path.relative(ROOT, OUT)}/ (${files.length + 1} files${DEV ? ', dev' : ', protected'})`);
