// Entry point: boot, mode state machine, frame loop. Wires core decisions to
// shell modules via plain calls + the ui hooks object. Mode transitions all
// happen here — no other module changes G.mode.
import { newRun, levelChoices, applyChoice, payout } from '../core/state.js';
import { buy } from '../core/tech.js';
import { loadMeta, saveMeta } from './meta.js';
import { makeFx, updateFx, announce } from './fx.js';
import { setMuted, sfx } from './audio.js';
import { resetWeapons } from './weapons.js';
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

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  G.W = window.innerWidth; G.H = window.innerHeight;
  G.cx = G.W / 2; G.cy = G.H / 2;
  canvas.width = Math.round(G.W * dpr);
  canvas.height = Math.round(G.H * dpr);
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  const { meta, earned } = payout(G.S, G.meta);
  G.meta = meta;
  saveMeta(G.meta);
  G.mode = 'over';
  clearInput(G);
  sfx('gameover');
  ui.renderGameOver(G, earned);
  ui.showOnly('over');
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
  onBuy: id => { G.meta = buy(id, G.meta); saveMeta(G.meta); },
  onMute: () => {
    G.meta.sound = !G.meta.sound;
    setMuted(!G.meta.sound);
    saveMeta(G.meta);
    ui.renderMenu(G);
  },
  onMetaChanged: () => saveMeta(G.meta),
});

initInput(G, canvas);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// ---------- frame loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (G.mode === 'play') {
    updateInput(G);
    const sig = updateGame(G, dt);
    updateFx(G.fx, dt);
    ui.updateHUD(G);
    if (sig === 'over') finishRun();
    else if (sig === 'levelup') openLevelUp();
  }
  renderFrame(G);
  requestAnimationFrame(loop);
}

ui.renderMenu(G);
ui.showOnly('menu');
// Dev/smoke-test hatches: ?autostart skips the menu; ?turbo pre-simulates ~14s
// (auto-picking level-ups) so a headless screenshot lands mid-battle.
if (location.search.includes('autostart')) {
  startRun();
  if (location.search.includes('turbo')) {
    let tapT = 0;
    for (let i = 0; i < 2400; i++) {
      tapT -= 1 / 60;
      if (tapT <= 0) {
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
