// Tiny WebAudio synth. One-shot sweeps; no assets, no loops.
// AudioContext is created lazily on the first user gesture (autoplay policy).
let AC = null;
export let muted = false;
export function setMuted(m) { muted = m; }

export function initAudio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}

function sweep(f0, f1, dur, type = 'square', vol = 0.06, delay = 0) {
  if (muted || !AC) return;
  try {
    const t = AC.currentTime + delay;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(AC.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* never let audio kill a frame */ }
}

const P = {
  shoot:   [820, 360, 0.05, 'square', 0.022],
  wave:    [300, 80, 0.2, 'sawtooth', 0.06],
  zap:     [1500, 220, 0.07, 'square', 0.028],
  death:   [320, 70, 0.13, 'sawtooth', 0.045],
  boom:    [130, 45, 0.32, 'sawtooth', 0.09],
  hurt:    [210, 80, 0.22, 'square', 0.1],
  nova:    [85, 40, 0.38, 'sine', 0.11],
  seek:    [600, 1100, 0.09, 'triangle', 0.03],
  shield:  [1000, 700, 0.05, 'triangle', 0.035],
  boss:    [55, 130, 0.7, 'sawtooth', 0.1],
};

export function sfx(name) {
  if (name === 'levelup') {
    sweep(520, 520, 0.07, 'triangle', 0.06);
    sweep(660, 660, 0.07, 'triangle', 0.06, 0.08);
    sweep(880, 880, 0.12, 'triangle', 0.07, 0.16);
    return;
  }
  if (name === 'gameover') {
    sweep(440, 110, 0.9, 'sawtooth', 0.08);
    sweep(220, 55, 1.1, 'square', 0.06, 0.15);
    return;
  }
  const p = P[name];
  if (p) sweep(...p);
}
