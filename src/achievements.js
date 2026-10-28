'use strict';
/* global SFX, S, R, t, esc, svgIcon, toast, isWin, charsOf, MODES, save */
// Achievements: computed from the match log plus a few usage counters (spins, modes, shares).

function matchesWhere(fn) { return S.matches.filter(fn); }
function distinctChars(role, winOnly = false, mode = null) {
  return new Set(S.matches.filter((m) => m.role === role && (!winOnly || isWin(m)) && (!mode || m.mode === mode)).map((m) => m.characterId)).size;
}
function bestStreak() {
  let best = 0;
  let run = 0;
  for (const m of [...S.matches].sort((a, b) => a.date.localeCompare(b.date))) { run = isWin(m) ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

const ACHIEVEMENTS = [
  { id: 'first-spin', icon: 'dice', name: 'First Spin', desc: 'Spin the Entity once.', goal: 1, value: () => S.progress.spins },
  { id: 'spin-100', icon: 'dice', name: 'Spin Doctor', desc: 'Spin 100 times.', goal: 100, value: () => S.progress.spins },
  { id: 'spin-1000', icon: 'spark', name: "The Entity's Favourite", desc: 'Spin 1,000 times.', goal: 1000, value: () => S.progress.spins },
  { id: 'first-log', icon: 'list', name: 'Dear Diary', desc: 'Log your first match.', goal: 1, value: () => S.matches.length },
  { id: 'log-50', icon: 'list', name: 'Dedicated', desc: 'Log 50 matches.', goal: 50, value: () => S.matches.length },
  { id: 'log-250', icon: 'chart', name: 'Veteran', desc: 'Log 250 matches.', goal: 250, value: () => S.matches.length },
  { id: 'first-4k', icon: 'skull', name: 'Merciless', desc: 'Get a 4K as killer.', goal: 1, value: () => matchesWhere((m) => m.role === 'killer' && m.kills === 4).length },
  { id: 'four-k-10', icon: 'skull', name: 'Massacre', desc: 'Get 10 4Ks.', goal: 10, value: () => matchesWhere((m) => m.role === 'killer' && m.kills === 4).length },
  { id: 'first-escape', icon: 'endgame', name: 'Great Escape', desc: 'Escape through the exit gates.', goal: 1, value: () => matchesWhere((m) => m.result === 'escaped').length },
  { id: 'hatch-5', icon: 'run', name: 'Hatch Hunter', desc: 'Escape through the hatch 5 times.', goal: 5, value: () => matchesWhere((m) => m.result === 'hatch').length },
  { id: 'streak-5', icon: 'haste', name: 'On Fire', desc: 'Win 5 matches in a row.', goal: 5, value: bestStreak },
  { id: 'killers-10', icon: 'skull', name: 'Versatile', desc: 'Play 10 different killers.', goal: 10, value: () => distinctChars('killer') },
  { id: 'all-killers', icon: 'skull', name: 'Master of Fear', desc: 'Play every killer at least once.', goal: () => charsOf('killer').length, value: () => distinctChars('killer') },
  { id: 'all-survivors', icon: 'run', name: 'Every Face in the Fog', desc: 'Play every survivor at least once.', goal: () => charsOf('survivor').length, value: () => distinctChars('survivor') },
  { id: 'nometa-10', icon: 'ban', name: 'No Crutches', desc: 'Win 10 matches in No Meta mode.', goal: 10, value: () => matchesWhere((m) => m.mode === 'nometa' && isWin(m)).length },
  { id: 'adept-1', icon: 'obsession', name: 'Adept', desc: 'Win a match in Adept mode.', goal: 1, value: () => matchesWhere((m) => m.mode === 'adept' && isWin(m)).length },
  { id: 'adept-10', icon: 'obsession', name: 'Adept Collector', desc: 'Win in Adept mode with 10 different characters.', goal: 10, value: () => distinctChars('killer', true, 'adept') + distinctChars('survivor', true, 'adept') },
  { id: 'mystery-win', icon: 'info', name: 'Trust the Fog', desc: 'Win a match in Mystery mode.', goal: 1, value: () => matchesWhere((m) => m.mode === 'mystery' && isWin(m)).length },
  { id: 'all-modes', icon: 'spark', name: 'Theme Park', desc: 'Spin every challenge mode at least once.', goal: () => Object.keys(MODES).length, value: () => Object.keys(S.progress.modeSpins).filter((k) => MODES[k]).length },
  { id: 'squad-10', icon: 'altruism', name: 'Squad Goals', desc: 'Roll a Squad of 4 ten times.', goal: 10, value: () => S.progress.modeSpins.squad || 0 },
  { id: 'builds-10', icon: 'layers', name: 'Collector', desc: 'Save 10 builds.', goal: 10, value: () => S.builds.length },
  { id: 'share-1', icon: 'share', name: 'Sharing is Caring', desc: 'Share a build code or image.', goal: 1, value: () => S.progress.shares },
  { id: 'streamer', icon: 'cast', name: 'Showtime', desc: 'Turn on streamer mode.', goal: 1, value: () => (S.progress.streamer ? 1 : 0) },
  { id: 'days-7', icon: 'chart', name: 'Regular', desc: 'Use the tool on 7 different days.', goal: 7, value: () => S.progress.days.length },
];

const goalOf = (a) => (typeof a.goal === 'function' ? a.goal() : a.goal);
const unlockedCount = () => ACHIEVEMENTS.filter((a) => S.progress.unlocked[a.id]).length;

let saveTimer = null;
function saveProgress() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save('progress'), 400);
}

// Called after anything that can move progress forward. Shows a toast per new unlock.
function checkAchievements({ silent = false } = {}) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (S.progress.unlocked[a.id]) continue;
    if (a.value() >= goalOf(a)) {
      S.progress.unlocked[a.id] = new Date().toISOString();
      fresh.push(a);
    }
  }
  if (fresh.length) {
    saveProgress();
    if (!silent) fresh.forEach((a, i) => setTimeout(() => { SFX.play('achievement'); toast(`🏆 ${t('Achievement unlocked: {name}', { name: t(a.name) })}`); }, i * 2200));
  }
  return fresh;
}

// track('spin', { mode }) · track('share') · track('streamer') · track('open')
function track(event, data = {}) {
  const p = S.progress;
  if (event === 'spin') {
    p.spins += 1;
    p.modeSpins[data.mode || 'standard'] = (p.modeSpins[data.mode || 'standard'] || 0) + 1;
  } else if (event === 'share') {
    p.shares += 1;
  } else if (event === 'streamer') {
    p.streamer = true;
  } else if (event === 'open') {
    const today = new Date().toISOString().slice(0, 10);
    if (!p.days.includes(today)) p.days.push(today);
    if (p.days.length > 400) p.days = p.days.slice(-400);
  }
  saveProgress();
  checkAchievements();
}

function achievementsHtml() {
  const done = unlockedCount();
  const rows = [...ACHIEVEMENTS].sort((a, b) => Number(!!S.progress.unlocked[b.id]) - Number(!!S.progress.unlocked[a.id]));
  return `
    <div class="glass panel ach-summary">
      <div><div class="k-label">${t('Achievements')}</div><div class="k-value">${done} / ${ACHIEVEMENTS.length}</div></div>
      <div class="bar-track" style="flex:1;height:10px"><div class="bar-fill" style="width:${(done / ACHIEVEMENTS.length) * 100}%"></div></div>
    </div>
    <div class="ach-grid">${rows.map((a) => {
      const goal = goalOf(a);
      const val = Math.min(a.value(), goal);
      const got = S.progress.unlocked[a.id];
      return `<div class="glass ach ${got ? 'got' : ''}">
        <div class="ach-ico">${svgIcon(a.icon, 22)}</div>
        <div class="ach-body">
          <div class="ach-name">${esc(t(a.name))}</div>
          <div class="ach-desc">${esc(t(a.desc))}</div>
          ${got ? `<div class="ach-date">${svgIcon('check', 12)} ${esc(new Date(got).toLocaleDateString())}</div>`
            : `<div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${(val / goal) * 100}%"></div></div><span class="num small">${val}/${goal}</span></div>`}
        </div>
      </div>`;
    }).join('')}</div>`;
}
