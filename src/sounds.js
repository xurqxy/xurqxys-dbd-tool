'use strict';
/* global S */
// Sound effects, synthesized live with the Web Audio API: no audio files, nothing copied from the game.
// SFX.play('lock') etc. Silent when switched off in Settings, while the window isn't focused (so a spin from the
// streamer hotkey doesn't play over the game), and until the first click or key press (no noise on launch).
// The audio engine sleeps two seconds after the last sound, so it costs no CPU in between.

const SFX = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let sleepTimer = 0;
  let armed = false;
  const arm = () => { armed = true; };
  window.addEventListener('pointerdown', arm, { once: true, capture: true });
  window.addEventListener('keydown', arm, { once: true, capture: true });

  const enabled = () => S?.settings?.sfx !== false;
  const volume = () => (S?.settings?.sfxVolume ?? 0.5);

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      // One second of white noise, reused for clicks and whooshes.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    master.gain.value = volume() * 0.9;
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => { if (!rolling) ctx.suspend().catch(() => {}); }, 2000);
    return ctx;
  }

  // ---------- Building blocks ----------
  function env(gain, t, attack, peak, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function tone(type, f0, f1, t, dur, peak, attack = 0.004) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, attack, peak, dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + dur + 0.02);
  }
  function noise(t, dur, peak, filterType, f0, f1 = f0, q = 1) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    env(g, t, 0.003, peak, dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ---------- The sounds ----------
  const SOUNDS = {
    // One click of the slot machine.
    tick(t) {
      noise(t, 0.018, 0.22, 'bandpass', 2600 + Math.random() * 900, 2600, 6);
      tone('square', 1500 + Math.random() * 300, 1200, t, 0.012, 0.025);
    },
    // A slot stops. Each next slot lands a little higher, so a full spin climbs.
    land(t, i = 0) {
      const up = Math.pow(2, (i * 2) / 12);
      tone('sine', 190 * up, 70 * up, t, 0.16, 0.5, 0.002);
      noise(t, 0.04, 0.25, 'lowpass', 1800, 600, 0.7);
    },
    // All slots stopped: an ominous hit for killers, a hopeful chime for survivors.
    done(t) {
      if (S?.role === 'survivor') {
        [659, 988, 1319].forEach((f, n) => tone('triangle', f, f, t + n * 0.045, 0.7, 0.16));
        noise(t, 0.35, 0.05, 'highpass', 5000);
      } else {
        tone('sine', 82, 41, t, 0.9, 0.7, 0.003);
        tone('sawtooth', 110, 104, t, 0.6, 0.06, 0.02);
        tone('triangle', 1245, 1240, t + 0.02, 0.9, 0.06);
        noise(t, 0.5, 0.08, 'bandpass', 900, 300, 1.5);
      }
    },
    lock(t) {
      noise(t, 0.012, 0.3, 'bandpass', 2200, 2200, 4);
      noise(t + 0.045, 0.02, 0.35, 'bandpass', 1300, 1300, 4);
      tone('sine', 520, 480, t + 0.045, 0.06, 0.12);
    },
    unlock(t) {
      noise(t, 0.02, 0.3, 'bandpass', 1300, 1300, 4);
      noise(t + 0.045, 0.012, 0.3, 'bandpass', 2400, 2400, 4);
      tone('sine', 480, 620, t + 0.045, 0.06, 0.1);
    },
    // A hidden perk is revealed (Mystery mode).
    reveal(t) {
      noise(t, 0.32, 0.18, 'bandpass', 350, 3200, 2.5);
      tone('sine', 1400, 1400, t + 0.24, 0.5, 0.12);
      tone('sine', 2100, 2100, t + 0.27, 0.4, 0.05);
    },
    achievement(t) {
      [523, 659, 784, 1047].forEach((f, n) => tone('triangle', f, f, t + n * 0.075, 0.45, 0.2));
      tone('sine', 2093, 2093, t + 0.3, 0.6, 0.06);
    },
    // Small confirmation: saved, copied, logged.
    pop(t) {
      tone('sine', 620, 940, t, 0.07, 0.25, 0.003);
    },
  };

  function play(name, arg) {
    if (!armed || !enabled() || !SOUNDS[name]) return;
    if (!document.hasFocus()) return;
    if (!audio()) return;
    SOUNDS[name](ctx.currentTime + 0.005, arg);
  }

  // Slot-machine ticking that runs while any slot is rolling (one tick stream, not one per slot).
  let rolling = 0;
  let ticker = 0;
  function rollStart() {
    rolling++;
    if (ticker || !enabled()) return;
    play('tick');
    ticker = setInterval(() => (rolling > 0 ? play('tick') : rollStop(true)), 75);
  }
  function rollStop(all = false) {
    rolling = all ? 0 : Math.max(0, rolling - 1);
    if (rolling === 0 && ticker) { clearInterval(ticker); ticker = 0; }
  }

  // Short test sound for the Settings page.
  const preview = () => { play('land', 0); setTimeout(() => play('done'), 160); };

  return { play, rollStart, rollStop, preview };
})();
