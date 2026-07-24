#!/usr/bin/env node
// scripts/conductor — the delegation gate (GDD §3 Law·Delegation; ADR-0006
// Consequences, ADR-0007 Consequences, PINS [phase 2] → this file).
//
// Two headless runs from the same seed, on the strongest slot-budget-legal
// delegation build (BUILD below, chosen by --scan): one with the aim parked at
// its t=0 default and never touched, one with the 0.2s-retargeting robot.
// Two clauses (BAND below), both required, exit non-zero otherwise; wired into
// the prod gate next to calibrate. Fully deterministic given the code: every
// rng call is seeded, so a band trip always means the sim changed.
//
//   node scripts/conductor.mjs [pairs=11]    # the gate
//   node scripts/conductor.mjs --scan [n=3]  # re-derive BUILD: parked survival
//                                            # per candidate build, n seeds each
//
// Method notes:
// - Same seed = same rng stream at t=0; the runs diverge immediately (different
//   aim → different consumption order). The pairing controls early wave
//   composition; the median over pairs does the real noise control.
// - The build is maxed from t=0 (no tech, bastion): the gate measures the
//   weapon layer's ceiling, not the leveling path. Level-ups still fire and
//   both modes spend them on random generics — symmetric by construction.
// - N is a RATCHET (PINS [phase 2]): re-measure and raise when hands get more
//   valuable; never lower it quietly to make a new weapon fit. A law-breaking
//   chassis gets its own declared band, not an exemption (ADR-0007).
import { mulberry32 } from '../src/core/rng.js';
import { defaultMeta, newRun, levelChoices, applyChoice } from '../src/core/state.js';
import { makeFx, updateFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { nearestEnemy } from '../src/app/enemies.js';

// 40 sim-minutes — the DEPTH window. At 15 minutes both modes ride the wave-pace
// ceiling (~wave 30) untouched and the delta is meaningless; the signal lives at
// waves ~45–55 where the parked build cracks. CAP env overrides for exploration.
const CAP_S = Number(process.env.CAP || 2400);

// The two clauses, measured 2026-07-25 post-slot-budget (see README balance
// tooling; both are RATCHETS — raise on re-measure, never quietly lower):
// - hands: median (robot − parked) wave over the pairs. Measured set-medians
//   4/7/10 across three 11-pair sets; band one step under the observed floor.
// - parkedDeaths: the do-nothing run must be ABLE to die — parked deaths per
//   11-pair set measured 7–9; the pre-cap world scored 0, twice, at 100% hp.
//   This clause is what catches a future weapon quietly re-automating the game
//   even if the hands median survives.
const BAND = { hands: 3, parkedDeaths: 2 };

// The delegation-max build: strongest parked performer from --scan, one gun
// (the default bolt) + 5 autos, ≤6/≤1-gun legal under ADR-0006's budget.
const BUILD = { bolt: 6, orbit: 5, nova: 5, frost: 5, tesla: 5, turret: 5 };

// --scan candidates: 5-auto sets over the 12 autos, curated around the
// plausible parked-power axes (self-aiming dps, zones, artillery, aim-readers).
const CANDIDATES = {
  classic:   ['orbit', 'nova', 'frost', 'tesla', 'turret'],
  artillery: ['nova', 'tesla', 'mortar', 'seek', 'turret'],
  aimpark:   ['boomer', 'nova', 'tesla', 'mortar', 'seek'],
  zone:      ['orbit', 'frost', 'mine', 'caltrop', 'nova'],
  chain:     ['tesla', 'cascade', 'nova', 'mortar', 'seek'],
  mixed:     ['nova', 'tesla', 'mortar', 'seek', 'frost'],
  turrets:   ['turret', 'seek', 'tesla', 'nova', 'boomer'],
  grinder:   ['orbit', 'nova', 'tesla', 'mortar', 'frost'],
};

function runOnce(seed, robot, build = BUILD) {
  Math.random = mulberry32(seed);
  const meta = defaultMeta();
  const G = {
    W: 430, H: 900, cx: 215, cy: 450, // phone-shaped, like calibrate
    S: newRun(meta, 'bastion'), fx: makeFx(), meta,
  };
  for (const [id, l] of Object.entries(build)) { G.S.weapons[id] = l; G.S.pool.add(id); }
  resetWeapons(G); // parks the aim at its default: (cx, cy−160)
  resetWaveDirector(G);
  const dt = 1 / 60;
  let tapT = 0;
  for (let t = 0; t < CAP_S; t += dt) {
    if (robot) {
      tapT -= dt;
      if (tapT <= 0) {
        const e = nearestEnemy(G.S, G.cx, G.cy);
        if (e) G.aim = { x: e.x, y: e.y };
        tapT = 0.2;
      }
    }
    const sig = updateGame(G, dt);
    updateFx(G.fx, dt);
    if (sig === 'levelup') {
      while (G.S.pendingLevels > 0) {
        const cs = levelChoices(G.S, Math.random);
        applyChoice(G.S, cs[Math.floor(Math.random() * cs.length)]);
        G.S.pendingLevels--;
      }
    }
    if (sig === 'over') return { wave: G.S.wave, hpPct: 0, died: true, time: Math.round(t) };
  }
  return { wave: G.S.wave, hpPct: Math.round(100 * G.S.hp / G.S.maxHp), died: false, time: CAP_S };
}

const fmt = r => `wave ${String(r.wave).padStart(2)} ${r.died ? `died @${r.time}s` : `alive ${r.hpPct}% hp`}`;

if (process.argv.includes('--scan')) {
  const n = Number(process.argv[3] || 3);
  console.log(`parked-survival scan, ${n} seeds per candidate, cap ${CAP_S}s\n`);
  const rows = [];
  for (const [name, autos] of Object.entries(CANDIDATES)) {
    const build = { bolt: 6, ...Object.fromEntries(autos.map(a => [a, 5])) };
    const waves = [];
    for (let s = 1; s <= n; s++) {
      const r = runOnce(s * 1000 + 7, false, build);
      waves.push(r.wave);
      console.log(`  ${name.padEnd(10)} seed ${s}: ${fmt(r)}`);
    }
    waves.sort((a, b) => a - b);
    rows.push({ name, median: waves[Math.floor(n / 2)], autos });
  }
  rows.sort((a, b) => b.median - a.median);
  console.log('\nparked median by candidate (the gate should use the top one):');
  for (const r of rows) console.log(`  ${r.name.padEnd(10)} ${String(r.median).padStart(2)}  [${r.autos.join(' ')}]`);
  process.exit(0);
}

const pairs = Number(process.argv[2] || 11);
const seed0 = Number(process.env.SEED0 || 0); // exploration only: shift the seed set
const deltas = [];
let parkedDeaths = 0;
for (let i = 1; i <= pairs; i++) {
  const seed = seed0 + i * 1000 + 7;
  const parked = runOnce(seed, false);
  const robot = runOnce(seed, true);
  deltas.push(robot.wave - parked.wave);
  if (parked.died) parkedDeaths++;
  console.log(`pair ${i}: parked ${fmt(parked)} · robot ${fmt(robot)} · hands ${robot.wave - parked.wave >= 0 ? '+' : ''}${robot.wave - parked.wave}`);
}
deltas.sort((a, b) => a - b);
const median = deltas[Math.floor(pairs / 2)];
const handsOk = median >= BAND.hands;
const dieOk = parkedDeaths >= BAND.parkedDeaths;
console.log(`\nhands are worth ${median} waves (median of ${deltas.join(',')}) · ` +
  `band ≥ ${BAND.hands} → ${handsOk ? 'ok' : 'BROKEN'}`);
console.log(`parked deaths ${parkedDeaths}/${pairs} · band ≥ ${BAND.parkedDeaths} → ` +
  `${dieOk ? 'ok' : 'BROKEN (the do-nothing run has become unkillable)'}`);
console.log(handsOk && dieOk ? 'CONDUCTOR HOLDS ✓' : 'DELEGATION LAW BROKEN ✗');
process.exit(handsOk && dieOk ? 0 : 1);
