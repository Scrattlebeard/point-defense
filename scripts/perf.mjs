#!/usr/bin/env node
// The JS-cost gate (README "Performance tooling", core/perf.md).
//
// Runs a seeded headless game and times updateGame + renderFrame per frame against
// a stub 2D context, bucketed by wave. This bounds OUR JavaScript cost and is blind
// to rasterisation — a stub context draws nothing, so this can never tell you why a
// phone is slow. What it CAN do is fail the moment our own loops start costing real
// time, which nothing in this repo previously noticed.
//
// It gates a budget share rather than milliseconds: absolute times depend on the
// machine running CI, and an absolute threshold beside a moving target is this
// codebase's most repeated defect.
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { renderFrame } from '../src/app/render.js';
import { nearestEnemy } from '../src/app/enemies.js';
import { mulberry32 } from '../src/core/rng.js';
import { FRAME_BUDGET_MS } from '../src/core/perf.js';

/** JS may claim at most this share of a frame. Deliberately generous: the point is
 *  to catch an O(n²) landing or a per-frame allocation storm, not to police 0.1ms. */
export const JS_BUDGET_SHARE = 0.25;
const SEED = 20260725;

const METHODS = ['arc', 'beginPath', 'clearRect', 'closePath', 'ellipse', 'fill', 'fillRect',
  'fillText', 'lineTo', 'moveTo', 'quadraticCurveTo', 'restore', 'rotate', 'save', 'scale',
  'setLineDash', 'stroke', 'translate'];

/** A plain no-op context. NOT a Proxy: the render smoke test uses one, and a trap on
 *  every property access costs more than the code being measured. */
function stubCtx() {
  const stats = { calls: 0 };
  const grad = { addColorStop() {} };
  const c = {
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    measureText: () => ({ width: 12 }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '',
    shadowBlur: 0, shadowColor: '', lineCap: '', lineDashOffset: 0,
  };
  for (const m of METHODS) c[m] = () => { stats.calls++; };
  return { ctx: c, stats };
}

/** @returns rows of {wave, ents, sim, render, calls} — per-frame means per wave. */
export function profile(maxWave = 30, { gear = null } = {}) {
  Math.random = mulberry32(SEED);
  const meta = defaultMeta();
  const { ctx, stats } = stubCtx();
  const G = {
    ctx, W: 430, H: 900, cx: 215, cy: 450,
    S: newRun(meta, 'bastion'), fx: makeFx(), meta, mode: 'play', stats,
  };
  // No pre-maxed loadout by default. A maxed build clears the field on contact and
  // profiles an empty screen — measured 2026-07-25, entity counts of 1-11 where a
  // natural build carries 14-38. The rig must reproduce the player's field.
  if (gear) for (const [id, l] of Object.entries(gear)) { G.S.weapons[id] = l; G.S.pool.add(id); }
  resetWeapons(G);
  resetWaveDirector(G);
  G.S.hp = G.S.maxHp = 1e9; // never die: profiling, not playing

  const dt = 1 / 60;
  const rows = [];
  let cur = null;
  const flush = () => { if (cur && cur.frames > 30) rows.push(cur); };

  for (let i = 0; i < 60 * 60 * 40 && G.S.wave <= maxWave; i++) {
    if (!cur || cur.wave !== G.S.wave) { flush(); cur = { wave: G.S.wave, frames: 0, sim: 0, render: 0, ents: 0, calls: 0 }; }
    const tgt = nearestEnemy(G.S, G.cx, G.cy);
    G.aim = tgt ? { x: tgt.x, y: tgt.y } : { x: G.cx, y: G.cy - 100 };

    const t0 = process.hrtime.bigint();
    const sig = updateGame(G, dt);
    updateFx(G.fx, dt);
    const t1 = process.hrtime.bigint();
    const c0 = stats.calls;
    renderFrame(G);
    const t2 = process.hrtime.bigint();

    cur.frames++;
    cur.sim += Number(t1 - t0) / 1e6;
    cur.render += Number(t2 - t1) / 1e6;
    cur.ents += G.S.enemies.length;
    cur.calls += stats.calls - c0;

    if (sig === 'levelup') {
      while (G.S.pendingLevels > 0) { applyChoice(G.S, levelChoices(G.S, Math.random)[0]); G.S.pendingLevels--; }
    }
  }
  flush();
  return rows.map(r => ({
    wave: r.wave, ents: r.ents / r.frames, sim: r.sim / r.frames,
    render: r.render / r.frames, calls: r.calls / r.frames, frames: r.frames,
  }));
}

/** The gate: worst per-wave total, as a share of one frame.
 *  Wave 0 is discarded — it is the pre-wave frames, and it carries the whole
 *  process's JIT warm-up on an empty field (measured 0.082ms at ZERO entities,
 *  three times the cost of wave 22 with 38 of them). Letting warm-up define the
 *  worst case would gate the interpreter, not the game. */
export function scorePerf(rows) {
  let worst = { wave: 0, total: 0, ents: 0 };
  for (const r of rows) {
    if (r.wave === 0) continue;
    const total = r.sim + r.render;
    if (total > worst.total) worst = { wave: r.wave, total, ents: r.ents };
  }
  return { worst, share: worst.total / FRAME_BUDGET_MS, ok: worst.total / FRAME_BUDGET_MS <= JS_BUDGET_SHARE };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const maxWave = Number(process.argv[2] || 30);
  const rows = profile(maxWave);
  console.log('wave  ents   sim ms  render ms   total   budget%   ctx calls');
  for (const r of rows) {
    const tot = r.sim + r.render;
    console.log(
      String(r.wave).padStart(4) + String(Math.round(r.ents)).padStart(6) +
      r.sim.toFixed(3).padStart(9) + r.render.toFixed(3).padStart(11) +
      tot.toFixed(3).padStart(8) + (tot / FRAME_BUDGET_MS * 100).toFixed(1).padStart(9) + '%' +
      String(Math.round(r.calls)).padStart(11));
  }
  const s = scorePerf(rows);
  console.log(`\nworst wave ${s.worst.wave}: ${s.worst.total.toFixed(3)}ms of JS ` +
    `(${(s.share * 100).toFixed(1)}% of a frame, ${Math.round(s.worst.ents)} entities) · ` +
    `budget ≤ ${(JS_BUDGET_SHARE * 100)}% → ${s.ok ? 'OK' : 'OVER'}`);
  console.log('NB: stub canvas — this bounds our JS, and is blind to rasterisation.');
  process.exit(s.ok ? 0 : 1);
}
