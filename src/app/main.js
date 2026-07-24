// Entry point: boot, mode state machine, frame loop. Wires core decisions to
// shell modules via plain calls + the ui hooks object. Mode transitions all
// happen here — no other module changes G.mode.
import { newRun, levelChoices, applyChoice, payout, defaultMeta, addScore, evalAchievements } from '../core/state.js';
import { buy } from '../core/tech.js';
import { WEAPONS } from '../core/config.js';
import { loadMeta, saveMeta } from './meta.js';
import { makeFx, updateFx, settleFx, announce } from './fx.js';
import { setMuted, sfx } from './audio.js';
import { resetWeapons } from './weapons/index.js';
import { nearestEnemy } from './enemies.js';
import { resetWaveDirector, updateGame } from './game.js';
import { initInput, updateInput, clearInput } from './input.js';
import { renderFrame } from './render.js';
import * as ui from './ui.js';

const canvas = document.getElementById('field');
const G = {
  canvas, ctx: canvas.getContext('2d'),
  W: 0, H: 0, cx: 0, cy: 0,
  mode: 'menu',
  meta: loadMeta(),
  S: null, fx: makeFx(), wt: null, wd: null,
  traces: new Map(),
};
setMuted(!G.meta.sound);

const PHONE_ZOOM = 0.75; // app.md "Phone zoom (out)" — more arena on small screens
const MAX_FIELD = { w: 1400, h: 1000 }; // app.md "Field size cap" — screen size must not be a difficulty setting

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const zoom = Math.min(window.innerWidth, window.innerHeight) < 600
    ? PHONE_ZOOM
    : Math.max(1, window.innerWidth / MAX_FIELD.w, window.innerHeight / MAX_FIELD.h);
  G.zoom = zoom;
  G.W = window.innerWidth / zoom; G.H = window.innerHeight / zoom;
  G.cx = G.W / 2; G.cy = G.H / 2;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  G.ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- run lifecycle ----------
function startRun() {
  G.S = newRun(G.meta, G.meta.tower);
  G.fx = makeFx();
  G.hudCache = null;
  resetWeapons(G);
  resetWaveDirector(G);
  clearInput(G);
  G.mode = 'play';
  ui.showOnly(null);
  ui.updateHUD(G);
  announce(G.fx, 'DEFEND THE POINT', '#4de8ff');
}

function openLevelUp() {
  G.mode = 'levelup';
  G.currentChoices = levelChoices(G.S, Math.random);
  ui.renderLevelUp(G, G.currentChoices);
  ui.showOnly('levelup');
  sfx('levelup');
}

function finishRun() {
  const { meta: paid, earned } = payout(G.S, G.meta);
  const { meta: scored, rank } = addScore(paid, {
    wave: G.S.wave, kills: G.S.kills, tower: G.S.towerId, ts: Date.now(),
  });
  G.meta = scored;
  announceAchievements(G.S);
  saveMeta(G.meta);
  G.mode = 'over';
  clearInput(G);
  sfx('gameover');
  ui.renderGameOver(G, earned, rank);
  ui.showOnly('over');
}

/** Evaluate achievements after any meta change; toast the new ones. */
function announceAchievements(S = null) {
  const { meta, unlocked } = evalAchievements(G.meta, S);
  G.meta = meta;
  for (const a of unlocked) {
    ui.toast(`🏆 <b>${a.name}</b> — ${a.desc}`);
    sfx('discover');
  }
}

function pauseGame() {
  if (G.mode !== 'play') return;
  G.mode = 'pause';
  clearInput(G);
  ui.renderPause(G);
  ui.showOnly('pause');
}

// ---------- ui hooks ----------
ui.initUI(G, {
  onStart: () => startRun(),
  onPause: () => pauseGame(),
  onResume: () => { if (G.mode === 'pause') { G.mode = 'play'; ui.showOnly(null); } },
  onAbandon: () => finishRun(),
  onChoice: c => {
    applyChoice(G.S, c);
    G.S.pendingLevels--;
    if (G.S.pendingLevels > 0) openLevelUp();
    else { G.mode = 'play'; ui.showOnly(null); }
  },
  onBuy: id => {
    G.meta = buy(id, G.meta);
    announceAchievements();
    saveMeta(G.meta);
  },
  onMute: () => {
    G.meta.sound = !G.meta.sound;
    setMuted(!G.meta.sound);
    saveMeta(G.meta);
    ui.renderMenu(G);
  },
  onMetaChanged: () => saveMeta(G.meta),
  onReset: () => {
    G.meta = defaultMeta();
    saveMeta(G.meta);
    ui.renderMenu(G);
  },
});

initInput(G, canvas);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// ---------- frame loop ----------
let last = performance.now();
function loop(now) {
  // clamp BOTH ends: rAF timestamps can run backward vs performance.now()
  // (seen in headless Firefox), and negative dt turns every "decay toward
  // zero" (enemy flash, cooldowns) into a generator. Sim time never rewinds.
  const dt = Math.max(0, Math.min(0.033, (now - last) / 1000));
  last = now;
  if (G.mode === 'play') {
    updateInput(G);
    const sig = updateGame(G, dt);
    updateFx(G.fx, dt);
    ui.updateHUD(G);
    if (sig === 'over') finishRun();
    else if (sig === 'levelup') openLevelUp();
  } else {
    // Sim is frozen behind an overlay, but camera juice still settles —
    // a paused field must not keep shaking (fx.js settleFx, app.md).
    settleFx(G.fx, dt);
  }
  renderFrame(G);
  requestAnimationFrame(loop);
}

ui.renderMenu(G);
ui.showOnly('menu');
// Dev/smoke hatch: ?lattice opens the Lattice directly; &shards=N fakes a
// balance (in-memory only) so node states are photographable.
if (location.search.includes('lattice')) {
  const sm = location.search.match(/shards=(\d+)/);
  if (sm) G.meta.shards = Number(sm[1]);
  ui.renderTech(G);
  ui.showOnly('tech');
}
// Dev/smoke hatch: ?bestiary opens a fully-revealed bestiary (in-memory only).
if (location.search.includes('bestiary')) {
  import('../core/config.js').then(({ ENEMIES, VARIANTS }) => {
    G.meta.seen = { enemies: Object.keys(ENEMIES), variants: Object.keys(VARIANTS) };
    ui.renderBestiary(G);
    ui.showOnly('bestiary');
  });
}
// Dev/smoke-test hatches: ?autostart skips the menu; ?turbo pre-simulates ~40s
// (auto-picking level-ups) so a headless screenshot lands mid-battle; ?warp=N
// pre-simulates exactly N seconds instead.
const warpMatch = location.search.match(/warp=(\d+)/);
if (location.search.includes('autostart')) {
  startRun();
  // &gear=frost:4,orbit:2 — grant weapon levels for visual dev (README dev hatches)
  const gearMatch = location.search.match(/gear=([\w:,]+)/);
  if (gearMatch) for (const kv of gearMatch[1].split(',')) {
    const [id, l] = kv.split(':');
    if (WEAPONS[id]) G.S.weapons[id] = Math.min(WEAPONS[id].max, Number(l) || 1);
  }
  if (location.search.includes('turbo') || warpMatch) {
    let tapT = 0;
    const bot = location.search.includes('turbo'); // warp alone = time passes, nobody aims
    const frames = warpMatch ? Number(warpMatch[1]) * 60 : 2400;
    for (let i = 0; i < frames; i++) {
      tapT -= 1 / 60;
      if (bot && tapT <= 0) {
        const e = nearestEnemy(G.S, G.cx, G.cy);
        if (e) { G.aim = { x: e.x, y: e.y }; tapT = 0.2; }
      }
      const sig = updateGame(G, 1 / 60);
      updateFx(G.fx, 1 / 60);
      if (sig === 'levelup') {
        while (G.S.pendingLevels > 0) {
          const cs = levelChoices(G.S, Math.random);
          applyChoice(G.S, cs[0]);
          G.S.pendingLevels--;
        }
      } else if (sig === 'over') break;
    }
  }
}
requestAnimationFrame(loop);
