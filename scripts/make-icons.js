'use strict';
// Renders the app icon (build/icon.svg.js) into every size and format the apps use:
// Windows (.png + multi-size .ico), title-bar logo, website, PWA / iPhone icons, Android launcher icons and splash screens.
// Run with Electron after changing the icon:   npx electron scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');
const { iconSvg } = require('../build/icon.svg.js');

const ROOT = path.join(__dirname, '..');
const out = (rel) => { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); return p; };
const BG = '#07060a';

let win;
// Draws an SVG (optionally inside a coloured canvas, optionally round) and returns PNG bytes.
async function render({ svg, size, width = size, height = size, iconSize = size, color = 'transparent', round = false }) {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await win.webContents.executeJavaScript(`new Promise((done) => {
    document.body.innerHTML = '<div id="c" style="position:absolute;left:0;top:0;width:${width}px;height:${height}px;background:${color};display:grid;place-items:center;overflow:hidden;${round ? 'border-radius:50%;' : ''}"><img id="i" width="${iconSize}" height="${iconSize}"></div>';
    const img = document.getElementById('i');
    img.onload = () => requestAnimationFrame(() => requestAnimationFrame(done));
    img.src = ${JSON.stringify(src)};
  })`);
  const image = await win.webContents.capturePage({ x: 0, y: 0, width, height });
  return image.resize({ width, height, quality: 'best' }).toPNG();
}

// Renders a snippet of HTML at a fixed size and returns the captured image.
async function renderHtml(html, width, height) {
  await win.webContents.executeJavaScript(`new Promise((done) => {
    document.body.innerHTML = ${JSON.stringify(html)};
    Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))])
      .then(() => requestAnimationFrame(() => requestAnimationFrame(done)));
  })`);
  return win.webContents.capturePage({ x: 0, y: 0, width, height });
}

// 24-bit Windows bitmap (what the NSIS installer wants for its sidebar picture).
function toBmp(image) {
  const { width, height } = image.getSize();
  const bgra = image.toBitmap();
  const row = Math.ceil((width * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + row * height);
  buf.write('BM', 0); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(width, 18); buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(row * height, 34);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = ((height - 1 - y) * width + x) * 4; // bitmaps are stored bottom-up
      const dst = 54 + y * row + x * 3;
      buf[dst] = bgra[src]; buf[dst + 1] = bgra[src + 1]; buf[dst + 2] = bgra[src + 2];
    }
  }
  return buf;
}

// .ico with PNG-compressed entries (supported since Windows Vista).
function toIco(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e); header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const pngSize = (file) => { const b = fs.readFileSync(file); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };

async function main() {
  win = new BrowserWindow({ show: false, width: 2048, height: 2048, frame: false, transparent: true, useContentSize: true,
    webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<html><body style="margin:0;background:transparent"></body></html>');

  const squircle = iconSvg();
  const small = iconSvg({ small: true });
  const write = (rel, data) => fs.writeFileSync(out(rel), data);

  // Windows / Linux app icon and installer icon
  write('build/icon.png', await render({ svg: squircle, size: 1024 }));
  const ico = [];
  for (const size of [16, 20, 24, 32, 40, 48, 64, 128, 256]) ico.push({ size, data: await render({ svg: size <= 32 ? small : squircle, size }) });
  write('build/icon.ico', toIco(ico));

  // Title-bar logo in the app (just the emblem, no background tile)
  fs.writeFileSync(out('src/logo.svg'), iconSvg({ background: 'none', scale: 1.12, small: true }));

  // Website
  write('website/img/icon.png', await render({ svg: squircle, size: 512 }));
  write('website/img/favicon.png', await render({ svg: small, size: 64 }));

  // Phone web app (PWA) and iPhone home screen. iOS rounds the corners itself, so it gets a full square.
  write('mobile/icons/icon-192.png', await render({ svg: squircle, size: 192 }));
  write('mobile/icons/icon-512.png', await render({ svg: squircle, size: 512 }));
  write('mobile/icons/maskable-512.png', await render({ svg: iconSvg({ background: 'full', scale: 0.8 }), size: 512 }));
  write('mobile/icons/apple-touch-icon.png', await render({ svg: iconSvg({ background: 'full', scale: 0.92 }), size: 180 }));

  // Android launcher icons (legacy square + round, and the adaptive-icon foreground on a 108dp canvas)
  const res = 'android/app/src/main/res';
  for (const [dpi, k] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const s = Math.round(48 * k);
    write(`${res}/mipmap-${dpi}/ic_launcher.png`, await render({ svg: s <= 72 ? small : squircle, size: s }));
    write(`${res}/mipmap-${dpi}/ic_launcher_round.png`, await render({ svg: iconSvg({ background: 'full', scale: 0.86, small: s <= 72 }), size: s, round: true }));
    write(`${res}/mipmap-${dpi}/ic_launcher_foreground.png`, await render({ svg: iconSvg({ background: 'none', scale: 0.6 }), size: Math.round(108 * k) }));
  }
  // Splash screens keep their existing sizes: dark background, emblem in the middle.
  const emblem = iconSvg({ background: 'none' });
  for (const dir of fs.readdirSync(path.join(ROOT, res)).filter((d) => d.startsWith('drawable'))) {
    const file = path.join(ROOT, res, dir, 'splash.png');
    if (!fs.existsSync(file)) continue;
    const { width, height } = pngSize(file);
    fs.writeFileSync(file, await render({ svg: emblem, width, height, iconSize: Math.round(Math.min(width, height) * 0.36), color: BG }));
  }
  // Installer / uninstaller sidebar (welcome and finish pages), 164 x 314 like NSIS expects.
  const font = fs.readFileSync(path.join(ROOT, 'src/fonts/oxanium-latin-800-normal.woff2')).toString('base64');
  const logo = `data:image/svg+xml;base64,${Buffer.from(iconSvg({ background: 'none' })).toString('base64')}`;
  const sidebar = await renderHtml(`<style>@font-face{font-family:Ox;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:800}</style>
    <div style="position:absolute;left:0;top:0;width:164px;height:314px;overflow:hidden;font-family:Ox,sans-serif;font-weight:800;text-align:center;color:#fff;
      background:radial-gradient(circle at 50% 30%,rgba(255,45,85,.32),transparent 58%),linear-gradient(180deg,#1d0f1a,#07060a 75%)">
      <img src="${logo}" width="118" height="118" style="position:absolute;left:23px;top:46px">
      <div style="position:absolute;left:0;right:0;top:182px;font-size:18px;letter-spacing:4px;padding-left:4px">XURQXYS</div>
      <div style="position:absolute;left:0;right:0;top:208px;font-size:10px;letter-spacing:6px;padding-left:6px;color:#ff4d6d">DBD TOOL</div>
      <div style="position:absolute;left:12px;right:12px;bottom:18px;height:2px;background:linear-gradient(90deg,transparent,#ff2d55,#8b2cf5,transparent)"></div>
    </div>`, 164, 314);
  write('build/installerSidebar.bmp', toBmp(sidebar));

  console.log('icons written');
}

app.whenReady().then(main).then(() => app.exit(0), (err) => { console.error(err); app.exit(1); });
