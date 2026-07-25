// SPIKE (disposable, outside the loop): where does per-frame JS time go, by wave?
// Measures OUR javascript only — a stub context cannot see the browser's
// rasterisation, so this bounds the JS half and says nothing about fill rate.
import { defaultMeta, newRun, levelChoices, applyChoice } from './src/core/state.js';
import { makeFx, updateFx } from './src/app/fx.js';
import { resetWeapons } from './src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from './src/app/game.js';
import { renderFrame } from './src/app/render.js';
import { mulberry32 } from './src/core/rng.js';
import { nearestEnemy } from './src/app/enemies.js';

const METHODS = ['arc','beginPath','clearRect','closePath','ellipse','fill','fillRect','fillText',
  'lineTo','moveTo','quadraticCurveTo','restore','rotate','save','scale','setLineDash','stroke','translate'];
function fastCtx() {
  // Counts the operations a GPU actually pays for, not the ones we happen to call.
  const stats = { calls: 0, grads: 0, fills: 0, strokes: 0, blurFills: 0, blurStrokes: 0, blurSet: 0, texts: 0 };
  const g = { addColorStop() {} };
  let blur = 0;
  const c = {
    createRadialGradient: () => { stats.grads++; return g; },
    createLinearGradient: () => { stats.grads++; return g; },
    measureText: () => ({ width: 12 }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '',
    shadowColor: '', lineCap: '', lineDashOffset: 0,
    get shadowBlur() { return blur; },
    set shadowBlur(v) { blur = v; if (v > 0) stats.blurSet++; },
  };
  for (const m of METHODS) c[m] = () => { stats.calls++; };
  c.fill = () => { stats.calls++; stats.fills++; if (blur > 0) stats.blurFills++; };
  c.fillRect = () => { stats.calls++; stats.fills++; if (blur > 0) stats.blurFills++; };
  c.stroke = () => { stats.calls++; stats.strokes++; if (blur > 0) stats.blurStrokes++; };
  c.fillText = () => { stats.calls++; stats.texts++; if (blur > 0) stats.blurFills++; };
  return { ctx: c, stats };
}

const MAXWAVE = Number(process.argv[2] || 30);
Math.random = mulberry32(20260725);
const meta = defaultMeta();
const { ctx, stats } = fastCtx();
const G = { ctx, W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta, mode: 'play', stats };
// NO pre-maxed build: a maxed loadout clears the field instantly and profiles an
// empty screen. Natural level-ups reproduce the build a real fresh run carries.
resetWeapons(G); resetWaveDirector(G);
G.S.hp = G.S.maxHp = 1e9; // never die: we are profiling, not playing

const dt = 1 / 60;
let wave = 0, acc = null;
const rows = [];
function flush() {
  if (acc && acc.frames > 30) rows.push({
    wave: acc.wave, frames: acc.frames,
    sim: acc.sim / acc.frames, render: acc.render / acc.frames,
    ents: acc.ents / acc.frames, calls: acc.calls / acc.frames,
    grads: acc.grads / acc.frames, blurF: acc.blurF / acc.frames, blurS: acc.blurS / acc.frames,
    fills: acc.fills / acc.frames, strokes: acc.strokes / acc.frames,
  });
}
for (let i = 0; i < 60 * 60 * 40 && G.S.wave <= MAXWAVE; i++) {
  if (G.S.wave !== wave) { flush(); wave = G.S.wave; acc = { wave, frames: 0, sim: 0, render: 0, ents: 0, calls: 0, grads: 0, blurF: 0, blurS: 0, fills: 0, strokes: 0 }; }
  const tgt = nearestEnemy(G.S, G.cx, G.cy);
  G.aim = tgt ? { x: tgt.x, y: tgt.y } : { x: G.cx, y: G.cy - 100 };
  let t0 = process.hrtime.bigint();
  const sig = updateGame(G, dt);
  updateFx(G.fx, dt);
  let t1 = process.hrtime.bigint();
  const c0 = stats.calls, g0 = stats.grads, bf0 = stats.blurFills, bs0 = stats.blurStrokes, f0 = stats.fills, s0 = stats.strokes;
  renderFrame(G);
  let t2 = process.hrtime.bigint();
  if (acc) {
    acc.frames++;
    acc.sim += Number(t1 - t0) / 1e6;
    acc.render += Number(t2 - t1) / 1e6;
    acc.ents += G.S.enemies.length;
    acc.calls += stats.calls - c0;
    acc.grads += stats.grads - g0; acc.blurF += stats.blurFills - bf0; acc.blurS += stats.blurStrokes - bs0;
    acc.fills += stats.fills - f0; acc.strokes += stats.strokes - s0;
  }
  if (sig === 'levelup') { while (G.S.pendingLevels > 0) { applyChoice(G.S, levelChoices(G.S, Math.random)[0]); G.S.pendingLevels--; } }
}
flush();
console.log('wave  ents   fills strokes  GRADIENTS  blur-fill  blur-strk   calls');
for (const r of rows) {
  const tot = r.sim + r.render;
  console.log(
    String(r.wave).padStart(4) + String(Math.round(r.ents)).padStart(6) +
    String(Math.round(r.fills)).padStart(8) + String(Math.round(r.strokes)).padStart(8) +
    String(Math.round(r.grads)).padStart(11) + String(Math.round(r.blurF)).padStart(11) +
    String(Math.round(r.blurS)).padStart(11) + String(Math.round(r.calls)).padStart(8));
}
