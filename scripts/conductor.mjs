#!/usr/bin/env node
// scripts/conductor — the delegation gate (GDD §3 Law·Delegation; ADR-0006
// Consequences, ADR-0007 Consequences, ADR-0010 for the metric).
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
// - COVERAGE GAP (ADR-0010 Consequences): the robot only *aims*. Hold and swipe
//   hands are unmeasured, so this gate proves one of Law·Delegation's three
//   input dimensions. The survival metric no longer inverts if the robot is
//   taught the other two — which is what makes that work possible.
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

// The two clauses, measured 2026-07-25 over three 11-pair sets (README balance
// tooling; ADR-0010). Both are RATCHETS — raise on re-measure, never quietly lower:
// - ratio: median (robot.time / parked.time). Survival time, NOT wave reached —
//   wave-reached punishes time-purchasing play and is quantized to the boss
//   cadence. Set medians measured 1.176/1.204/1.194; band one step under the floor.
// - parkedDeaths: the do-nothing run must be ABLE to die — measured 11/11 in every
//   set; the pre-cap world scored 0, twice, at 100% hp. This clause is what catches
//   a future weapon quietly re-automating the game even if the ratio survives.
export const BAND = { ratio: 1.12, parkedDeaths: 2 };

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// The scoring rule, pure and unit-tested (test/conductor.test.mjs) so the
// 40-minute sims stay gate-only. Runs still alive at the cap are scored AT the
// cap — that understates hands, which is the safe direction for a floor
// (ADR-0010 Decision 3): it can produce a false BROKEN, never a false HOLDS.
export function scoreConductor(pairs, band = BAND) {
  const ratio = median(pairs.map(p => p.robot.time / p.parked.time));
  const parkedDeaths = pairs.filter(p => p.parked.died).length;
  const handsOk = ratio >= band.ratio;
  const dieOk = parkedDeaths >= band.parkedDeaths;
  return {
    ratio, parkedDeaths, handsOk, dieOk, ok: handsOk && dieOk,
    // Reported, never gated: deaths land on boss waves, so this is quantized to 5.
    waveDelta: median(pairs.map(p => p.robot.wave - p.parked.wave)),
  };
}

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

function scan() {
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
}

function gate() {
  const n = Number(process.argv[2] || 11);
  const seed0 = Number(process.env.SEED0 || 0); // exploration only: shift the seed set
  const pairs = [];
  for (let i = 1; i <= n; i++) {
    const seed = seed0 + i * 1000 + 7;
    const parked = runOnce(seed, false);
    const robot = runOnce(seed, true);
    pairs.push({ parked, robot });
    console.log(`pair ${i}: parked ${fmt(parked)} · robot ${fmt(robot)} · ` +
      `survived ×${(robot.time / parked.time).toFixed(2)}`);
  }
  const s = scoreConductor(pairs);
  console.log(`\nhands buy ×${s.ratio.toFixed(3)} survival time · band ≥ ${BAND.ratio} → ` +
    `${s.handsOk ? 'ok' : 'BROKEN'}`);
  console.log(`parked deaths ${s.parkedDeaths}/${n} · band ≥ ${BAND.parkedDeaths} → ` +
    `${s.dieOk ? 'ok' : 'BROKEN (the do-nothing run has become unkillable)'}`);
  console.log(`(Δwave median ${s.waveDelta} — reported, not gated: quantized to 5, ADR-0010)`);
  console.log(s.ok ? 'CONDUCTOR HOLDS ✓' : 'DELEGATION LAW BROKEN ✗');
  return s.ok;
}

// CLI only when run directly — the test imports scoreConductor and must not
// trigger 22 forty-minute sims.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.includes('--scan')) { scan(); process.exit(0); }
  process.exit(gate() ? 0 : 1);
}
