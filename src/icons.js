'use strict';
// Procedural icons: perk diamonds, character emblems and UI glyphs.
// All glyphs are 24x24 stroke paths so they inherit currentColor.

// Set by app.js once official icons are cached: (kind, id) -> image URL or null.
let iconSrc = () => null;

const GLYPHS = {
  aura: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gen: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  chase: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  stealth: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  hex: '<circle cx="12" cy="10" r="7"/><circle cx="9.5" cy="9.5" r="1.5"/><circle cx="14.5" cy="9.5" r="1.5"/><path d="M9 17v4M12 17v4M15 17v4"/>',
  boon: '<path d="M12 2c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/><path d="M8 22h8"/>',
  scourge: '<path d="M12 2v8"/><path d="M12 10a5 5 0 1 0 5 5"/><path d="M17 15l-2-2M17 15l2-2"/>',
  hook: '<path d="M12 2v9"/><path d="M12 11a5 5 0 1 1-5 5"/><circle cx="12" cy="2.5" r="0.5"/>',
  exhaustion: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  info: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  endgame: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M12 3v18M9 12h.01M15 12h.01"/>',
  slowdown: '<path d="M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10"/>',
  exposed: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  blind: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  totem: '<circle cx="12" cy="6" r="3"/><path d="M12 9v13M7 13h10M8 18h8"/>',
  chest: '<rect x="3" y="8" width="18" height="12" rx="1"/><path d="M3 12h18M5 8a7 4 0 0 1 14 0M11 12v3h2v-3"/>',
  item: '<path d="M9 2h6l1 6H8z"/><rect x="9" y="8" width="6" height="14" rx="1"/><path d="M12 12v3"/>',
  'second-chance': '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z"/><path d="M10 12l2-3 1 4 2-2"/>',
  'anti-tunnel': '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
  protection: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
  'anti-bodyblock': '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 9l6 6M15 9l-6 6"/>',
  obsession: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  'skill-check': '<circle cx="12" cy="12" r="9"/><path d="M12 12l5-5"/><path d="M15 3.5a9 9 0 0 1 5.5 5.5" stroke-width="3.5"/>',
  locker: '<rect x="6" y="2" width="12" height="20" rx="1"/><path d="M9 6h6M9 9h6M14 14v2"/>',
  haste: '<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>',
  oblivious: '<path d="M3 3l18 18"/><path d="M8 4a7 7 0 0 1 11 6c0 2-1 3-2 4M6 9a7 7 0 0 0 0 2c0 3 2 4 2 6a3 3 0 0 0 5 2"/>',
  altruism: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M12 10v5M9.5 12.5h5"/>',
  default: '<path d="M12 3l9 9-9 9-9-9z"/>',
};

// Order decides which glyph a multi-tag perk gets.
const GLYPH_PRIORITY = ['hex', 'boon', 'scourge', 'second-chance', 'anti-tunnel', 'exhaustion', 'slowdown', 'heal', 'aura', 'stealth',
  'blind', 'exposed', 'obsession', 'totem', 'chest', 'locker', 'item', 'endgame', 'haste', 'chase', 'gen', 'skill-check', 'hook',
  'oblivious', 'altruism', 'protection', 'anti-bodyblock', 'info'];

const UI = {
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 12l10 5 10-5M2 17l10 5 10-5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  min: '<path d="M5 12h14"/>',
  max: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  restore: '<rect x="4" y="8" width="12" height="12" rx="1"/><path d="M8 8V4h12v12h-4"/>',
  skull: '<path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V19h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8z"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><circle cx="15" cy="10" r="1.6" fill="currentColor"/><path d="M10 19v3M14 19v3"/>',
  run: '<circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 4 3 1M10 8l-2 5"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  cast: '<path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 20h.01"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  spark: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
};

function svgIcon(name, size = 18, extra = '') {
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${UI[name] || GLYPHS[name] || GLYPHS.default}</svg>`;
}

function glyphFor(tags = []) {
  return GLYPH_PRIORITY.find((t) => tags.includes(t)) || 'default';
}

// Diamond perk badge, coloured by role. Shows the official icon on top when one is cached.
function perkIcon(perk, size = 64) {
  const role = perk?.role || 'none';
  const src = perk && iconSrc('perk', perk.id);
  const glyph = perk ? GLYPHS[glyphFor(perk.tags)] : '';
  if (src) {
    return `<svg class="perk-icon official ${role}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
      <polygon class="pi-outer" points="50,2 98,50 50,98 2,50"/>
      <polygon class="pi-inner" points="50,10 90,50 50,90 10,50"/>
      <image href="${src}" x="4" y="4" width="92" height="92" preserveAspectRatio="xMidYMid meet"/>
    </svg>`;
  }
  return `<svg class="perk-icon ${role}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <polygon class="pi-outer" points="50,2 98,50 50,98 2,50"/>
    <polygon class="pi-inner" points="50,10 90,50 50,90 10,50"/>
    <polygon class="pi-sheen" points="50,10 90,50 50,50 10,50"/>
    <g transform="translate(30 30) scale(1.6667)" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="pi-glyph">${glyph}</g>
  </svg>`;
}

function initials(name) {
  const words = String(name || '?').replace(/^The\s+/i, '').replace(/["“”]/g, '').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)).toUpperCase();
}

// Character portrait in a hex frame, or a drawn sigil when no official portrait is cached.
function emblem(char, size = 160) {
  const role = char?.role || 'killer';
  const src = char?.id && iconSrc('char', char.id);
  if (src) {
    return `<svg class="emblem official ${role}" width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true">
      <defs><clipPath id="hexclip"><polygon points="100,8 180,54 180,146 100,192 20,146 20,54"/></clipPath>
        <radialGradient id="eg-${role}" cx="50%" cy="40%" r="60%"><stop offset="0" class="eg-a"/><stop offset="1" class="eg-b"/></radialGradient></defs>
      <polygon points="100,8 180,54 180,146 100,192 20,146 20,54" fill="url(#eg-${role})"/>
      <image href="${src}" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMin slice" clip-path="url(#hexclip)"/>
      <polygon points="100,8 180,54 180,146 100,192 20,146 20,54" class="em-hex" fill="none"/>
    </svg>`;
  }
  return `<svg class="emblem ${role}" width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="eg-${role}" cx="50%" cy="40%" r="60%">
        <stop offset="0" class="eg-a"/><stop offset="1" class="eg-b"/>
      </radialGradient>
    </defs>
    <polygon points="100,8 180,54 180,146 100,192 20,146 20,54" class="em-hex" fill="url(#eg-${role})"/>
    <polygon points="100,26 164,63 164,137 100,174 36,137 36,63" class="em-ring"/>
    <g transform="translate(100 100)" class="em-rune">
      <path d="M0 -62 L8 -50 L0 -38 L-8 -50Z"/><path d="M0 62 L8 50 L0 38 L-8 50Z"/>
      <path d="M-54 -31 L-40 -31 L-46 -20Z"/><path d="M54 -31 L40 -31 L46 -20Z"/>
      <path d="M-54 31 L-40 31 L-46 20Z"/><path d="M54 31 L40 31 L46 20Z"/>
    </g>
    <text x="100" y="118" text-anchor="middle" class="em-text">${initials(char?.name)}</text>
  </svg>`;
}

// Square icon for items, add-ons and offerings, falling back to a glyph.
function thingIcon(kind, name, glyph, size = 22) {
  const src = name && iconSrc(kind, slugify(name));
  return src ? `<img class="thing-img" src="${src}" width="${size + 14}" height="${size + 14}" alt="">` : svgIcon(glyph, size);
}

function slugify(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GitHub mark (filled, so it isn't part of the stroke icon set).
function githubIcon(size = 18) {
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
}
