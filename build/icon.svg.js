'use strict';
// The app icon, as code: a perk-style diamond with two claw slashes crossing into an X, glowing in the killer
// red-to-violet of the app. scripts/make-icons.js renders it to every size and format the apps need.
//   background: 'squircle' (desktop/web icon), 'none' (transparent, e.g. Android foreground), 'full' (solid square)
//   scale: size of the emblem inside the canvas (1 = default margins)
//   small: bolder lines and no fine detail, for 16-32 px where thin strokes disappear

function iconSvg({ background = 'squircle', scale = 1, small = false } = {}) {
  // Emblem geometry is drawn for a 1024 canvas and scaled around the centre.
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  const bg = {
    squircle: '<rect x="40" y="40" width="944" height="944" rx="212" fill="url(#bg)"/><rect x="40" y="40" width="944" height="944" rx="212" fill="url(#bgGlow)"/><rect x="41.5" y="41.5" width="941" height="941" rx="210.5" fill="none" stroke="url(#rim)" stroke-width="3"/>',
    full: '<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#bgGlow)"/>',
    none: '',
  }[background];

  // A tapered blade from a to b, bulging to one side (quadratic curves, thicker in the middle).
  const blade = (ax, ay, bx, by, bulge, inner) => {
    const mx = (ax + bx) / 2; const my = (ay + by) / 2;
    const len = Math.hypot(bx - ax, by - ay);
    const nx = (by - ay) / len; const ny = -(bx - ax) / len;
    const c1 = [mx + nx * bulge, my + ny * bulge];
    const c2 = [mx - nx * inner, my - ny * inner];
    return `M${ax} ${ay} Q${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${bx} ${by} Q${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${ax} ${ay}Z`;
  };
  // The slashes cut through the diamond at both ends.
  const [bulge, inner] = small ? [92, 40] : [64, 26];
  const slashA = blade(318, 270, 706, 754, bulge, inner);
  const slashB = blade(706, 270, 318, 754, -bulge, -inner);
  const frameWidth = small ? 66 : 38;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="#22101d"/><stop offset="0.55" stop-color="#110a13"/><stop offset="1" stop-color="#07060a"/>
    </radialGradient>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="48%">
      <stop offset="0" stop-color="#ff3b5c" stop-opacity="0.28"/><stop offset="1" stop-color="#ff3b5c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="frame" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#ff6b81"/><stop offset="0.45" stop-color="#ff2d55"/><stop offset="1" stop-color="#8b2cf5"/>
    </linearGradient>
    <linearGradient id="inner" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="#2a1022"/><stop offset="1" stop-color="#0e0810"/>
    </linearGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#ffd1da"/><stop offset="0.7" stop-color="#ff4d6d"/><stop offset="1" stop-color="#c9184a"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  ${bg}
  <g transform="${t}">
    <!-- glow behind the diamond -->
    ${small ? '' : '<polygon points="512,150 874,512 512,874 150,512" fill="none" stroke="#ff2d55" stroke-opacity="0.55" stroke-width="46" filter="url(#glow)"/>'}
    <!-- perk diamond -->
    <polygon points="512,150 874,512 512,874 150,512" fill="url(#inner)" stroke="url(#frame)" stroke-width="${frameWidth}" stroke-linejoin="round"/>
    ${small ? '' : '<polygon points="512,226 798,512 512,798 226,512" fill="none" stroke="#ff4d6d" stroke-opacity="0.28" stroke-width="6" stroke-linejoin="round"/>'}
    <!-- claw slashes forming the X -->
    ${small ? '' : `<g filter="url(#softGlow)" opacity="0.9"><path d="${slashA}" fill="#ff2d55"/><path d="${slashB}" fill="#ff2d55"/></g>`}
    <path d="${slashA}" fill="url(#blade)"/>
    <path d="${slashB}" fill="url(#blade)"/>
  </g>
</svg>`;
}

module.exports = { iconSvg };
